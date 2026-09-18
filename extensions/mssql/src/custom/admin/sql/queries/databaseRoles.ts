/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";
import { DatabaseRole, RoleMembership } from "../types";
import { Row, toRows } from "../rows";
import { quoteIdentifier } from "../../../util/identifiers";

/**
 * Roles de una base de datos (§8.3.2 del brief), fijos, de usuario y de aplicación.
 *
 * Los de aplicación (`type = 'A'`) se marcan aparte: llevan contraseña, se activan con
 * `sp_setapprole` y **no tienen miembros**, así que su columna de miembros vacía no es un dato que
 * falte.
 *
 * Se trae `principal_id` porque `public` tiene `is_fixed_role = 0` y llamarlo «de usuario» sería
 * falso: nadie lo creó y no se puede borrar. Es el principal 0 de toda base, y se etiqueta aparte.
 *
 * Sin `USE`: nombre de tres partes, por la razón que explica `databaseUsers.ts`.
 */
export function buildDatabaseRolesStatement(database: string): string {
    const db = quoteIdentifier(database, "nombre de base de datos");
    return `
SELECT r.name,
       r.type,
       r.principal_id,
       CONVERT(int, r.is_fixed_role)                    AS is_fixed,
       ISNULL(o.name, N'')                              AS owner,
       CONVERT(varchar(33), r.create_date, 126)         AS create_date
FROM ${db}.sys.database_principals AS r
LEFT JOIN ${db}.sys.database_principals AS o
       ON o.principal_id = r.owning_principal_id
WHERE r.type IN ('R', 'A')
  AND r.name NOT LIKE '##%'
ORDER BY r.name;
`;
}

/** Agrupa los miembros por rol, conservando el orden de llegada. Función pura. */
export function mapMembersByRole(memberships: RoleMembership[]): Map<string, string[]> {
    const byRole = new Map<string, string[]>();
    for (const membership of memberships) {
        const existing = byRole.get(membership.role);
        if (existing) {
            existing.push(membership.member);
        } else {
            byRole.set(membership.role, [membership.member]);
        }
    }
    return byRole;
}

/** Mapea el resultado a `DatabaseRole[]`, con sus miembros. Función pura. */
export function mapDatabaseRoles(
    result: SimpleExecuteResult | undefined,
    memberships: RoleMembership[],
): DatabaseRole[] {
    const membersByRole = mapMembersByRole(memberships);
    return toRows(result).map((row: Row) => {
        const name = row.text("name");
        return {
            name,
            fixed: row.boolean("is_fixed"),
            // `public` es el principal 0 de toda base de datos.
            builtIn: row.number("principal_id") === 0,
            applicationRole: row.text("type").trim().toUpperCase() === "A",
            owner: row.text("owner"),
            createDate: row.text("create_date"),
            members: membersByRole.get(name) ?? [],
        };
    });
}
