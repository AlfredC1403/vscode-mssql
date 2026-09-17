/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";
import { ServerRole } from "../types";
import { toRows } from "../rows";

/**
 * Roles de servidor, fijos y definidos por el usuario.
 *
 * El brief (§10) solo trae la consulta de **miembros**, que no lista los roles sin miembros. Esta
 * parte de `sys.server_principals` con `type = 'R'` para que salgan todos, y resuelve el
 * propietario y si el rol es fijo.
 *
 * Los roles fijos de servidor tienen `is_fixed_role = 1`. `public` no es fijo pero tampoco es un
 * rol de usuario al uso: se marca como fijo porque el usuario no lo creó y no puede eliminarlo.
 *
 * Se excluyen los `##MS_…##`, que son roles internos que SQL Server 2022 crea para los permisos
 * granulares del motor (`##MS_DatabaseConnector##`, `##MS_LoginManager##`…). SSMS no los muestra
 * en Seguridad → Roles de servidor, y el criterio de cierre de M3 es coincidir con SSMS.
 */
export const SERVER_ROLES_SQL = `
SELECT r.name,
       CASE WHEN r.is_fixed_role = 1 OR r.name = N'public' THEN 1 ELSE 0 END AS is_fixed,
       ISNULL(o.name, N'')                                                   AS owner_name
FROM sys.server_principals AS r
LEFT JOIN sys.server_principals AS o
       ON o.principal_id = r.owning_principal_id
WHERE r.type = 'R'
  AND r.name NOT LIKE '##%'
ORDER BY r.name;
`;

/** Miembros de los roles de servidor. Tal cual el §10 del brief. */
export const SERVER_ROLE_MEMBERS_SQL = `
SELECT r.name AS role_name,
       m.name AS member_name
FROM sys.server_role_members AS rm
JOIN sys.server_principals AS r ON r.principal_id = rm.role_principal_id
JOIN sys.server_principals AS m ON m.principal_id = rm.member_principal_id
ORDER BY r.name, m.name;
`;

/**
 * Agrupa los miembros por rol. Función pura.
 *
 * @returns Mapa nombre de rol → nombres de sus miembros, en el orden que devolvió el motor.
 */
export function mapMembersByRole(
    membersResult: SimpleExecuteResult | undefined,
): Map<string, string[]> {
    const byRole = new Map<string, string[]>();
    for (const row of toRows(membersResult)) {
        const role = row.text("role_name");
        const member = row.text("member_name");
        const existing = byRole.get(role);
        if (existing) {
            existing.push(member);
        } else {
            byRole.set(role, [member]);
        }
    }
    return byRole;
}

/**
 * Invierte el mapa anterior: roles por miembro. Es lo que necesita cada `Login` para rellenar su
 * `serverRoles`. Función pura.
 */
export function mapServerRoleMembership(
    membersResult: SimpleExecuteResult | undefined,
): Map<string, string[]> {
    const byMember = new Map<string, string[]>();
    for (const row of toRows(membersResult)) {
        const role = row.text("role_name");
        const member = row.text("member_name");
        const existing = byMember.get(member);
        if (existing) {
            existing.push(role);
        } else {
            byMember.set(member, [role]);
        }
    }
    return byMember;
}

/**
 * Mapea roles y miembros a `ServerRole[]`. Función pura.
 *
 * @param rolesResult Resultado de `SERVER_ROLES_SQL`.
 * @param membersResult Resultado de `SERVER_ROLE_MEMBERS_SQL`.
 */
export function mapServerRoles(
    rolesResult: SimpleExecuteResult | undefined,
    membersResult: SimpleExecuteResult | undefined,
): ServerRole[] {
    const membersByRole = mapMembersByRole(membersResult);
    return toRows(rolesResult).map((row) => {
        const name = row.text("name");
        return {
            name,
            fixed: row.boolean("is_fixed"),
            owner: row.text("owner_name"),
            members: membersByRole.get(name) ?? [],
        };
    });
}
