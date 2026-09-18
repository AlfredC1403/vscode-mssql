/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";
import { DatabaseUser, DatabaseUserKind, RoleMembership } from "../types";
import { Row, toRows } from "../rows";
import { quoteIdentifier } from "../../../util/identifiers";

/**
 * Usuarios de una base de datos (§8.3.1 del brief).
 *
 * **No hay `USE`.** La consulta llega al catálogo de otra base con nombre de tres partes
 * (`[base].sys.database_principals`), porque el panel comparte la conexión con el editor de
 * consultas del usuario: un `USE` cambiaría la base activa de esa conexión y el usuario se
 * encontraría sus consultas ejecutándose contra otra base. Comprobado contra SQL Server 2022: el
 * catálogo de otra base se lee sin cambiar de contexto.
 *
 * `principal_id <= 4` son los cuatro principales que crea SQL Server en toda base: `public` (0),
 * `dbo` (1), `guest` (2), `INFORMATION_SCHEMA` (3) y `sys` (4). Se muestran, como hace SSMS, pero
 * marcados, para que no se confundan con usuarios que alguien creó.
 */
export function buildDatabaseUsersStatement(database: string): string {
    const db = quoteIdentifier(database, "nombre de base de datos");
    return `
SELECT p.name,
       p.type_desc,
       ISNULL(p.default_schema_name, N'')               AS default_schema,
       ISNULL(p.authentication_type_desc, N'NONE')      AS authentication,
       CONVERT(varchar(33), p.create_date, 126)         AS create_date,
       ISNULL(SUSER_SNAME(p.sid), N'')                  AS login_name,
       CONVERT(int, CASE WHEN p.principal_id <= 4 THEN 1 ELSE 0 END) AS is_system
FROM ${db}.sys.database_principals AS p
WHERE p.type IN ('S', 'U', 'G', 'E', 'X', 'K', 'C')
  AND p.name NOT LIKE '##%'
ORDER BY p.name;
`;
}

/**
 * Pertenencias a roles de la base, en las dos direcciones que el panel necesita.
 *
 * Trae también los roles que son miembros de otros roles: es lo que permite calcular la herencia
 * encadenada (§10 del brief).
 */
export function buildRoleMembershipStatement(database: string): string {
    const db = quoteIdentifier(database, "nombre de base de datos");
    return `
SELECT r.name        AS role_name,
       m.name        AS member_name,
       m.type_desc   AS member_type
FROM ${db}.sys.database_role_members AS rm
JOIN ${db}.sys.database_principals AS r ON r.principal_id = rm.role_principal_id
JOIN ${db}.sys.database_principals AS m ON m.principal_id = rm.member_principal_id
WHERE r.name NOT LIKE '##%' AND m.name NOT LIKE '##%'
ORDER BY r.name, m.name;
`;
}

/** Normaliza `type_desc` al tipo del dominio. */
function toUserKind(typeDescription: string): DatabaseUserKind {
    switch (typeDescription.trim().toUpperCase()) {
        case "SQL_USER":
            return "SQL_USER";
        case "WINDOWS_USER":
            return "WINDOWS_USER";
        case "WINDOWS_GROUP":
            return "WINDOWS_GROUP";
        case "EXTERNAL_USER":
            return "EXTERNAL_USER";
        case "EXTERNAL_GROUP":
            return "EXTERNAL_GROUP";
        case "ASYMMETRIC_KEY_MAPPED_USER":
            return "ASYMMETRIC_KEY_USER";
        case "CERTIFICATE_MAPPED_USER":
            return "CERTIFICATE_USER";
        default:
            return "OTHER";
    }
}

/** Mapea el resultado de `buildRoleMembershipStatement`. Función pura. */
export function mapRoleMemberships(result: SimpleExecuteResult | undefined): RoleMembership[] {
    return toRows(result).map((row: Row) => ({
        role: row.text("role_name"),
        member: row.text("member_name"),
        memberType: row.text("member_type"),
    }));
}

/** Invierte las pertenencias: para cada miembro, los roles a los que pertenece. Función pura. */
export function mapRolesByMember(memberships: RoleMembership[]): Map<string, string[]> {
    const byMember = new Map<string, string[]>();
    for (const membership of memberships) {
        const existing = byMember.get(membership.member);
        if (existing) {
            existing.push(membership.role);
        } else {
            byMember.set(membership.member, [membership.role]);
        }
    }
    return byMember;
}

/** Mapea el resultado a `DatabaseUser[]`, con sus roles directos. Función pura. */
export function mapDatabaseUsers(
    result: SimpleExecuteResult | undefined,
    rolesByMember: Map<string, string[]>,
): DatabaseUser[] {
    return toRows(result).map((row: Row) => {
        const name = row.text("name");
        return {
            name,
            type: toUserKind(row.text("type_desc")),
            loginName: row.text("login_name"),
            defaultSchema: row.text("default_schema"),
            authentication: row.text("authentication"),
            createDate: row.text("create_date"),
            system: row.boolean("is_system"),
            roles: rolesByMember.get(name) ?? [],
        };
    });
}
