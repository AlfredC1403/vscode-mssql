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
 *
 * ## `containment` se lee con `DATABASEPROPERTYEX`, no con la columna (M10)
 *
 * La columna `sys.databases.containment` existe desde SQL Server 2012, y esta consulta es la que
 * llena el selector de bases: si fallara, el panel se quedaría **sin ninguna base**. Un fork que va
 * a servidores ajenos no puede permitirse que una función menor tumbe la pantalla principal.
 *
 * `DATABASEPROPERTYEX` devuelve `NULL` para una propiedad que el motor no conoce, en lugar de dar un
 * error, así que en un servidor antiguo la base sale como no contenida y la creación de usuarios
 * contenidos simplemente no se ofrece. Es la degradación que se quiere: perder una función, no la
 * lista.
 */
export const DATABASES_SQL = `
SELECT d.name,
       d.database_id,
       ISNULL(SUSER_SNAME(d.owner_sid), N'')            AS owner,
       CONVERT(int, ISNULL(HAS_DBACCESS(d.name), 0))    AS has_access,
       CONVERT(int, ISNULL(DATABASEPROPERTYEX(d.name, N'Containment'), 0)) AS containment
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
        // 0 es «sin contención»; 1 es parcial y 2 sería completa, que todavía no existe en el
        // motor. Cualquier valor distinto de 0 admite usuarios con contraseña propia.
        contained: row.number("containment") !== 0,
    }));
}
