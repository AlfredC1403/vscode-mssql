/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";
import { Login, LoginKind } from "../types";
import { Row, toRows } from "../rows";

/**
 * Logins del servidor. Punto de partida del §10 del brief, con dos añadidos:
 *
 * - `is_policy_checked` e `is_expiration_checked` solo existen para logins SQL, así que se
 *   normalizan a 0 en los de Windows en lugar de devolver NULL.
 * - Se excluyen los principales de certificado y de clave asimétrica (`type` C y K), que no son
 *   logins con los que alguien inicie sesión.
 *
 * Los `##%` que filtra el brief son los principales internos que crea SQL Server para firmar
 * procedimientos del sistema.
 */
export const LOGINS_SQL = `
SELECT sp.name,
       CONVERT(varchar(85), sp.sid, 1)              AS sid,
       sp.type_desc,
       ISNULL(sp.default_database_name, N'')        AS default_database_name,
       sp.is_disabled,
       CONVERT(varchar(33), sp.create_date, 126)    AS create_date,
       ISNULL(sl.is_policy_checked, 0)              AS is_policy_checked,
       ISNULL(sl.is_expiration_checked, 0)          AS is_expiration_checked
FROM sys.server_principals AS sp
LEFT JOIN sys.sql_logins AS sl
       ON sl.principal_id = sp.principal_id
WHERE sp.type IN ('S', 'U', 'G')
  AND sp.name NOT LIKE '##%'
ORDER BY sp.name;
`;

/** Traduce `type_desc` de `sys.server_principals` al tipo del dominio. */
function toLoginKind(typeDescription: string): LoginKind {
    switch (typeDescription) {
        case "SQL_LOGIN":
            return "SQL_LOGIN";
        case "WINDOWS_LOGIN":
            return "WINDOWS_LOGIN";
        case "WINDOWS_GROUP":
            return "WINDOWS_GROUP";
        default:
            // El motor no debería devolver otra cosa con el WHERE de arriba, pero si añade un
            // tipo nuevo es mejor mostrarlo como login SQL que romper el panel.
            return "SQL_LOGIN";
    }
}

function mapRow(row: Row, rolesByMember: Map<string, string[]>): Login {
    const name = row.text("name");
    return {
        name,
        sid: row.text("sid"),
        type: toLoginKind(row.text("type_desc")),
        defaultDatabase: row.text("default_database_name"),
        disabled: row.boolean("is_disabled"),
        passwordPolicy: row.boolean("is_policy_checked"),
        passwordExpiration: row.boolean("is_expiration_checked"),
        createDate: row.text("create_date"),
        serverRoles: rolesByMember.get(name) ?? [],
    };
}

/**
 * Mapea el resultado de `LOGINS_SQL` a `Login[]`. Función pura.
 *
 * @param result Resultado de la consulta de logins.
 * @param rolesByMember Roles de servidor por nombre de miembro, de
 *   `mapServerRoleMembership`. Si no se pasa, cada login queda con `serverRoles: []`.
 */
export function mapLogins(
    result: SimpleExecuteResult | undefined,
    rolesByMember: Map<string, string[]> = new Map(),
): Login[] {
    return toRows(result).map((row) => mapRow(row, rolesByMember));
}
