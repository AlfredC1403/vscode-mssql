/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { PRECONDITION_ERRORS, StatementPrecondition } from "./plan";
import { quoteLiteral } from "../../../util/identifiers";

/**
 * Precondiciones: comprobaciones que van **dentro de la transacción**, justo antes de su sentencia.
 *
 * ## Por qué dentro y no en el cliente
 *
 * Comprobar en el cliente deja una ventana entre la comprobación y la escritura. Dentro de la
 * transacción no la hay: la comprobación y el cambio confirman o se revierten juntos. Es la misma
 * clase de problema que en las sesiones se resolvió comparando identidad antes del `KILL`, pero
 * resuelto donde no puede fallar.
 *
 * ## Qué identifica a un objeto, medido
 *
 * Contra SQL Server 2022, dentro de una transacción revertida: al borrar y volver a crear un
 * **usuario** asignado a un login, `principal_id` **se conserva** (9 → 9) y el `sid` se conserva
 * byte a byte; la única columna que cambia es `create_date`. En un **login** sí cambian
 * `principal_id` y `sid`. Conclusión: el testigo de identidad es
 * `(nombre, tipo, create_date)`, y `create_date` es obligatoria, no un adorno.
 *
 * `quoteLiteral` valida el nombre con las reglas del 11.2 antes de meterlo en el literal, así que
 * estas comprobaciones tampoco pueden llevar una comilla.
 */

/** Momento de creación en el formato ISO 8601 que devuelven las consultas de M3 y M4. */
function createDateLiteral(isoCreateDate: string): string {
    // La fecha viene de `CONVERT(varchar(33), create_date, 126)`, así que es ASCII y sin comillas.
    // Se valida igual: si no encaja con el patrón esperado, se aborta antes de construir nada.
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?$/.test(isoCreateDate)) {
        throw new Error("El momento de creación del objeto no tiene el formato esperado.");
    }
    return `N'${isoCreateDate}'`;
}

/**
 * El login sigue existiendo y sigue siendo el mismo.
 *
 * @throws Si el nombre o la fecha no pasan la validación.
 */
export function loginUnchanged(login: string, isoCreateDate: string): StatementPrecondition {
    return {
        check: `EXISTS (SELECT 1 FROM sys.server_principals WHERE name = ${quoteLiteral(
            login,
            "login",
        )} AND CONVERT(varchar(33), create_date, 126) = ${createDateLiteral(isoCreateDate)})`,
        errorNumber: PRECONDITION_ERRORS.objectChanged,
        message:
            "El login ya no es el mismo que se leyó: se borró y se volvió a crear, o no existe.",
    };
}

/**
 * El usuario de base sigue existiendo y sigue siendo el mismo.
 *
 * Se compara por `create_date` porque es **la única** columna que cambia al borrar y recrear un
 * usuario: `principal_id` y `sid` se conservan.
 *
 * @throws Si el nombre o la fecha no pasan la validación.
 */
export function userUnchanged(user: string, isoCreateDate: string): StatementPrecondition {
    return {
        check: `EXISTS (SELECT 1 FROM sys.database_principals WHERE name = ${quoteLiteral(
            user,
            "usuario",
        )} AND CONVERT(varchar(33), create_date, 126) = ${createDateLiteral(isoCreateDate)})`,
        errorNumber: PRECONDITION_ERRORS.objectChanged,
        message:
            "El usuario ya no es el mismo que se leyó: se borró y se volvió a crear, o no existe.",
    };
}

/**
 * La pertenencia a un rol está como se leyó: presente si se va a quitar, ausente si se va a añadir.
 *
 * Evita el caso tonto de que dos personas hagan el mismo cambio y la segunda vea un error del motor
 * en lugar de «esto ya estaba hecho».
 */
export function membershipState(
    role: string,
    member: string,
    scope: "server" | "database",
    expected: "present" | "absent",
): StatementPrecondition {
    const principals = scope === "server" ? "sys.server_principals" : "sys.database_principals";
    const members = scope === "server" ? "sys.server_role_members" : "sys.database_role_members";
    const exists = `EXISTS (SELECT 1 FROM ${members} AS rm
        JOIN ${principals} AS r ON r.principal_id = rm.role_principal_id
        JOIN ${principals} AS m ON m.principal_id = rm.member_principal_id
        WHERE r.name = ${quoteLiteral(role, "rol")} AND m.name = ${quoteLiteral(member, "miembro")})`;

    return {
        check: expected === "present" ? exists : `NOT ${exists}`,
        errorNumber: PRECONDITION_ERRORS.stateChanged,
        message:
            expected === "present"
                ? "Esa pertenencia al rol ya no existe: alguien la quitó mientras el panel estaba abierto."
                : "Esa pertenencia al rol ya existe: alguien la añadió mientras el panel estaba abierto.",
    };
}

/**
 * El permiso de ámbito de servidor está como se leyó.
 *
 * `expectedState` es el código del catálogo: `G`, `D`, `W`, o `NONE` para «no hay fila», que es lo
 * que significa un permiso sin conceder ni denegar.
 */
export function serverPermissionState(
    principal: string,
    permission: string,
    expectedState: "G" | "D" | "W" | "NONE",
): StatementPrecondition {
    const row = `EXISTS (SELECT 1 FROM sys.server_permissions AS perm
        JOIN sys.server_principals AS pr ON pr.principal_id = perm.grantee_principal_id
        WHERE pr.name = ${quoteLiteral(principal, "principal")}
          AND perm.permission_name = ${quoteLiteral(permission, "permiso")}
          AND perm.class = 100`;

    return {
        check:
            expectedState === "NONE"
                ? `NOT ${row})`
                : `${row} AND perm.state = ${quoteLiteral(expectedState, "estado")})`,
        errorNumber: PRECONDITION_ERRORS.rowChanged,
        message:
            "Ese permiso ya no está como se leyó: alguien lo cambió mientras el panel estaba abierto.",
    };
}
