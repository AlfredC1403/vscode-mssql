/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";
import { SchemaInfo } from "../types";
import { Row, toRows } from "../rows";
import { quoteIdentifier } from "../../../util/identifiers";

/**
 * Esquemas con su propietario (§8.3.3 del brief), y cuántos objetos tiene cada uno.
 *
 * Dos rangos de `schema_id` son del sistema: del 1 al 4 (`dbo`, `guest`, `INFORMATION_SCHEMA`,
 * `sys`) y a partir de 16384, que son los esquemas que SQL Server crea para cada rol fijo
 * (`db_owner`, `db_datareader`…). Se muestran marcados en lugar de esconderlos, porque un objeto
 * colocado por error en uno de ellos es justo lo que hay que poder ver.
 *
 * `SCHEMA_NAME()` **no sirve aquí**: resuelve en la base activa de la conexión, y esta consulta lee
 * el catálogo de otra base. El nombre sale del propio `sys.schemas` de esa base.
 */
export function buildSchemasStatement(database: string): string {
    const db = quoteIdentifier(database, "nombre de base de datos");
    return `
SELECT s.name,
       s.schema_id,
       ISNULL(p.name, N'')                              AS owner,
       (SELECT COUNT(*)
        FROM ${db}.sys.objects AS o
        WHERE o.schema_id = s.schema_id)                AS object_count
FROM ${db}.sys.schemas AS s
LEFT JOIN ${db}.sys.database_principals AS p
       ON p.principal_id = s.principal_id
ORDER BY s.name;
`;
}

/** Primer `schema_id` de los esquemas que SQL Server crea para los roles fijos. */
const FIXED_ROLE_SCHEMA_START = 16384;

/** Mapea el resultado a `SchemaInfo[]`. Función pura. */
export function mapSchemas(result: SimpleExecuteResult | undefined): SchemaInfo[] {
    return toRows(result).map((row: Row) => {
        const schemaId = row.number("schema_id");
        return {
            name: row.text("name"),
            owner: row.text("owner"),
            system: schemaId <= 4 || schemaId >= FIXED_ROLE_SCHEMA_START,
            objectCount: row.number("object_count"),
        };
    });
}
