/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";
import { PermissionGrantState, ServerPermission, ServerSecurableClass } from "../types";
import { Row, toRows } from "../rows";

/**
 * Permisos explícitos a nivel de servidor. Del §10 del brief, con el tipo del concedido añadido
 * para poder distinguir en el panel un login de un rol.
 *
 * Son **solo los explícitos**: lo que un principal obtiene por pertenecer a un rol no aparece
 * aquí. Eso es correcto para este panel, que muestra qué se concedió de forma directa.
 *
 * El objeto sobre el que cae el permiso **hay que resolverlo**, y no es un adorno: `public` tiene
 * `CONNECT` concedido sobre los cuatro puntos de conexión de fábrica, así que sin esa columna el
 * panel muestra cuatro filas «public · CONNECT · Concedido» idénticas y sin explicación.
 *
 * Las clases que aparecen a nivel de servidor son 100 (`SERVER`), 101 (`SERVER_PRINCIPAL`, el caso
 * de `IMPERSONATE` sobre otro login) y 105 (`ENDPOINT`).
 */
export const SERVER_PERMISSIONS_SQL = `
SELECT pr.name        AS grantee,
       pr.type_desc   AS grantee_type,
       perm.permission_name,
       perm.state_desc,
       perm.state,
       perm.class_desc,
       CASE perm.class
            WHEN 101 THEN ISNULL((SELECT target.name
                                  FROM sys.server_principals AS target
                                  WHERE target.principal_id = perm.major_id), N'')
            WHEN 105 THEN ISNULL((SELECT ep.name
                                  FROM sys.endpoints AS ep
                                  WHERE ep.endpoint_id = perm.major_id), N'')
            ELSE N''
       END            AS securable
FROM sys.server_permissions AS perm
JOIN sys.server_principals AS pr
      ON pr.principal_id = perm.grantee_principal_id
WHERE pr.name NOT LIKE '##%'
ORDER BY pr.name, perm.permission_name, securable;
`;

/**
 * Traduce el código de estado de `sys.server_permissions` al tipo del dominio.
 *
 * Los códigos del motor son: `G` = GRANT, `D` = DENY, `W` = GRANT WITH GRANT OPTION,
 * `R` = REVOKE.
 */
function toGrantState(stateCode: string): PermissionGrantState {
    switch (stateCode.trim().toUpperCase()) {
        case "G":
            return "GRANT";
        case "D":
            return "DENY";
        case "W":
            return "GRANT_WITH_GRANT_OPTION";
        case "R":
            return "REVOKE";
        default:
            return "REVOKE";
    }
}

/** Normaliza `class_desc` a la clase del dominio. */
function toSecurableClass(classDescription: string): ServerSecurableClass {
    switch (classDescription.trim().toUpperCase()) {
        case "SERVER":
            return "SERVER";
        case "ENDPOINT":
            return "ENDPOINT";
        case "SERVER_PRINCIPAL":
            return "SERVER_PRINCIPAL";
        default:
            return "OTHER";
    }
}

/** Mapea el resultado a `ServerPermission[]`. Función pura. */
export function mapServerPermissions(result: SimpleExecuteResult | undefined): ServerPermission[] {
    return toRows(result).map((row: Row) => ({
        grantee: row.text("grantee"),
        permission: row.text("permission_name"),
        state: toGrantState(row.text("state")),
        stateDescription: row.text("state_desc"),
        securableClass: toSecurableClass(row.text("class_desc")),
        securable: row.text("securable"),
    }));
}
