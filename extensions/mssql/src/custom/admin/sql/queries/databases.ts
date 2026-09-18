/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";
import { DatabaseChoice } from "../types";
import { toRows } from "../rows";

/** Identificadores de las cuatro bases del sistema: `master`, `tempdb`, `model` y `msdb`. */
const SYSTEM_DATABASE_LIMIT = 4;

/**
 * Bases de datos de la instancia, para el selector del panel.
 *
 * `HAS_DBACCESS` devuelve NULL cuando el login no puede entrar, así que la base sale en la lista
 * marcada como inaccesible en lugar de desaparecer: que exista y no se pueda abrir es información.
 *
 * Solo las que están en línea. Una base en `RESTORING` o `OFFLINE` no tiene catálogo que leer, y
 * consultarla daría un error que no aporta nada.
 */
export const DATABASES_SQL = `
SELECT d.name,
       d.database_id,
       ISNULL(SUSER_SNAME(d.owner_sid), N'')            AS owner,
       CONVERT(int, ISNULL(HAS_DBACCESS(d.name), 0))    AS has_access
FROM sys.databases AS d
WHERE d.state_desc = N'ONLINE'
ORDER BY CASE WHEN d.database_id <= ${SYSTEM_DATABASE_LIMIT} THEN 1 ELSE 0 END, d.name;
`;

/** Mapea el resultado a `DatabaseChoice[]`. Función pura. */
export function mapDatabases(result: SimpleExecuteResult | undefined): DatabaseChoice[] {
    return toRows(result).map((row) => ({
        name: row.text("name"),
        system: row.number("database_id") <= SYSTEM_DATABASE_LIMIT,
        accessible: row.boolean("has_access"),
        owner: row.text("owner"),
    }));
}
