/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { PlannedStatement } from "./plan";
import { assertIdentifier, quoteIdentifier } from "../../../util/identifiers";

/**
 * Generadores de pertenencia a roles. Funciones puras que **abortan** si un nombre no pasa la
 * validación (regla 11.2 del brief).
 *
 * Las cuatro sentencias son plenamente transaccionales: medido contra SQL Server 2022, tras un
 * `ROLLBACK` la pertenencia vuelve exactamente a como estaba (ver FORK.md §22).
 */

/** Qué se hace con la pertenencia. */
export type MembershipAction = "ADD" | "DROP";

/** Un cambio de pertenencia a un rol de servidor. */
export interface ServerRoleMembershipChange {
    action: MembershipAction;
    role: string;
    member: string;
}

/** Un cambio de pertenencia a un rol de base de datos. */
export interface DatabaseRoleMembershipChange extends ServerRoleMembershipChange {
    database: string;
}

/**
 * `ALTER SERVER ROLE [rol] ADD|DROP MEMBER [miembro]`.
 *
 * Enrutada por `master`: es una sentencia de ámbito de servidor.
 *
 * @throws Si el rol o el miembro no pasan la validación.
 */
export function buildServerRoleMembershipStatement(
    change: ServerRoleMembershipChange,
): PlannedStatement {
    const role = quoteIdentifier(change.role, "rol de servidor");
    const member = quoteIdentifier(change.member, "miembro");
    const verb = change.action === "ADD" ? "ADD" : "DROP";
    const label =
        change.action === "ADD"
            ? `Añadir ${change.member} al rol de servidor ${change.role}`
            : `Quitar ${change.member} del rol de servidor ${change.role}`;

    return {
        label,
        sql: `ALTER SERVER ROLE ${role} ${verb} MEMBER ${member}`,
        database: "master",
    };
}

/**
 * `ALTER ROLE [rol] ADD|DROP MEMBER [miembro]` en la base indicada.
 *
 * @throws Si el rol, el miembro o la base no pasan la validación.
 */
export function buildDatabaseRoleMembershipStatement(
    change: DatabaseRoleMembershipChange,
): PlannedStatement {
    const role = quoteIdentifier(change.role, "rol de base de datos");
    const member = quoteIdentifier(change.member, "miembro");
    const verb = change.action === "ADD" ? "ADD" : "DROP";
    const label =
        change.action === "ADD"
            ? `Añadir ${change.member} al rol ${change.role}`
            : `Quitar ${change.member} del rol ${change.role}`;

    return {
        label,
        sql: `ALTER ROLE ${role} ${verb} MEMBER ${member}`,
        // Se valida aquí aunque el ejecutor lo vuelva a hacer: así el aborto ocurre al montar el
        // cambio, no al ejecutar.
        database: assertIdentifier(change.database, "nombre de base de datos"),
    };
}
