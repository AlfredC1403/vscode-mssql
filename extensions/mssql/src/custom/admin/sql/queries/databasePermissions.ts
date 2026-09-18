/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";
import { DatabasePermission, DatabaseSecurableClass, PermissionGrantState } from "../types";
import { Row, toRows } from "../rows";
import { quoteIdentifier } from "../../../util/identifiers";

/**
 * Permisos **explícitos** de una base de datos, con el objeto sobre el que caen ya resuelto.
 *
 * Dos cosas que no son obvias y que salieron de ejecutarla contra un servidor real:
 *
 * 1. **`public` tiene cientos de `GRANT SELECT` sobre vistas del sistema.** Esas vistas viven en la
 *    base de recursos, no en `sys.objects` de la base, así que `is_ms_shipped` no las filtra: no
 *    están ahí. El filtro que funciona es exigir que el objeto **exista** en `sys.objects` de la
 *    base cuando la clase es 1. Sin eso, la rejilla trae 200 filas de ruido y ninguna útil.
 * 2. **`SCHEMA_NAME()` y `OBJECT_NAME()` sin base resuelven en la conexión activa**, y esta consulta
 *    lee otra base. Cada clase resuelve su nombre con un `JOIN` al catálogo de la base correcta.
 *
 * Clases que aparecen a nivel de base: 0 `DATABASE`, 1 `OBJECT_OR_COLUMN`, 3 `SCHEMA`,
 * 4 `DATABASE_PRINCIPAL`, 6 `TYPE`. Cualquier otra sale con su `class_desc` y sin nombre.
 */
export function buildDatabasePermissionsStatement(database: string): string {
    const db = quoteIdentifier(database, "nombre de base de datos");
    return `
SELECT pr.name                                          AS grantee,
       pr.type_desc                                     AS grantee_type,
       perm.permission_name,
       perm.state,
       perm.state_desc,
       perm.class_desc,
       CASE perm.class
            WHEN 1 THEN ISNULL(sch.name + N'.', N'') + ISNULL(obj.name, N'')
            WHEN 3 THEN ISNULL(target_schema.name, N'')
            WHEN 4 THEN ISNULL(target_principal.name, N'')
            WHEN 6 THEN ISNULL(target_type.name, N'')
            ELSE N''
       END                                              AS securable,
       ISNULL(col.name, N'')                            AS column_name
FROM ${db}.sys.database_permissions AS perm
JOIN ${db}.sys.database_principals AS pr
      ON pr.principal_id = perm.grantee_principal_id
LEFT JOIN ${db}.sys.objects AS obj
      ON perm.class = 1 AND obj.object_id = perm.major_id
LEFT JOIN ${db}.sys.schemas AS sch
      ON sch.schema_id = obj.schema_id
LEFT JOIN ${db}.sys.columns AS col
      ON perm.class = 1 AND perm.minor_id > 0
     AND col.object_id = perm.major_id AND col.column_id = perm.minor_id
LEFT JOIN ${db}.sys.schemas AS target_schema
      ON perm.class = 3 AND target_schema.schema_id = perm.major_id
LEFT JOIN ${db}.sys.database_principals AS target_principal
      ON perm.class = 4 AND target_principal.principal_id = perm.major_id
LEFT JOIN ${db}.sys.types AS target_type
      ON perm.class = 6 AND target_type.user_type_id = perm.major_id
WHERE pr.name NOT LIKE '##%'
  AND (perm.class <> 1 OR obj.object_id IS NOT NULL)
ORDER BY pr.name, perm.permission_name, securable;
`;
}

/** Traduce el código de estado del catálogo. `G`, `D`, `W` y `R`. */
function toGrantState(stateCode: string): PermissionGrantState {
    switch (stateCode.trim().toUpperCase()) {
        case "G":
            return "GRANT";
        case "D":
            return "DENY";
        case "W":
            return "GRANT_WITH_GRANT_OPTION";
        default:
            return "REVOKE";
    }
}

/** Normaliza `class_desc` a la clase del dominio. */
function toSecurableClass(classDescription: string): DatabaseSecurableClass {
    switch (classDescription.trim().toUpperCase()) {
        case "DATABASE":
            return "DATABASE";
        case "OBJECT_OR_COLUMN":
            return "OBJECT_OR_COLUMN";
        case "SCHEMA":
            return "SCHEMA";
        case "DATABASE_PRINCIPAL":
            return "DATABASE_PRINCIPAL";
        case "TYPE":
            return "TYPE";
        default:
            return "OTHER";
    }
}

/** Mapea el resultado a `DatabasePermission[]`. Función pura. */
export function mapDatabasePermissions(
    result: SimpleExecuteResult | undefined,
): DatabasePermission[] {
    return toRows(result).map((row: Row) => ({
        grantee: row.text("grantee"),
        granteeType: row.text("grantee_type"),
        permission: row.text("permission_name"),
        state: toGrantState(row.text("state")),
        stateDescription: row.text("state_desc"),
        securableClass: toSecurableClass(row.text("class_desc")),
        securable: row.text("securable"),
        columnName: row.text("column_name"),
    }));
}
