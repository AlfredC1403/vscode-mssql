/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { PlannedStatement } from "./plan";
import { PermissionScope, assertPermission } from "./permissionNames";
import { assertIdentifier, quoteIdentifier, quoteQualifiedName } from "../../../util/identifiers";

/**
 * Generadores de `GRANT`, `DENY` y `REVOKE`. Funciones puras: construyen texto y **abortan** si algo
 * no pasa la validación (regla 11.2 del brief). No ejecutan nada.
 *
 * Dos cosas que decide este archivo, y conviene que estén dichas:
 *
 * 1. **El ámbito de servidor se enruta por `master`.** SQL Server rechaza un `GRANT` de servidor
 *    desde otra base con el error 4621, y el panel no puede hacer `USE` porque comparte la conexión
 *    con el editor del usuario. La sentencia no lleva `USE`: la `database` del paso es `master` y el
 *    ejecutor la enruta con `EXEC [master].sys.sp_executesql`.
 * 2. **No se emite `AS <concedente>` ni `CASCADE`.** El `AS` cambia quién consta como concedente, y
 *    el `CASCADE` propaga la revocación a todo lo que ese principal haya concedido a su vez: las dos
 *    son decisiones con consecuencias que el panel no puede explicar en una casilla.
 */

/** A quién se le concede. */
export interface PermissionTarget {
    /** Nombre del principal: login, usuario o rol. Se valida y se entrecomilla. */
    principal: string;
}

/** Sobre qué se concede. */
export type Securable =
    | { scope: "SERVER" }
    | { scope: "DATABASE" }
    | { scope: "SCHEMA"; schema: string }
    | { scope: "OBJECT"; schema: string; object: string; column?: string };

/** Qué se hace con el permiso. */
export type PermissionAction = "GRANT" | "GRANT_WITH_GRANT_OPTION" | "DENY" | "REVOKE";

/** Datos de un cambio de permiso. */
export interface PermissionChange {
    action: PermissionAction;
    permission: string;
    securable: Securable;
    target: PermissionTarget;
    /**
     * Base sobre la que se aplica. Para el ámbito de servidor **se ignora**: siempre `master`.
     */
    database: string;
    /**
     * `true` si el permiso que se va a revocar estaba concedido `WITH GRANT OPTION`.
     *
     * SQL Server exige `CASCADE` para revocar un permiso concedible, y `CASCADE` revoca también todo
     * lo que ese principal haya concedido a otros. Eso no se hace desde una casilla: se aborta y el
     * panel lo explica.
     */
    grantable?: boolean;
}

/** Texto del securable para la sentencia, ya validado y entrecomillado. */
function renderSecurable(securable: Securable): string {
    switch (securable.scope) {
        case "SERVER":
        case "DATABASE":
            // `GRANT CONNECT TO [x]` a secas es de base; el de servidor tampoco lleva ON.
            return "";
        case "SCHEMA":
            return ` ON SCHEMA::${quoteIdentifier(securable.schema, "esquema")}`;
        case "OBJECT": {
            const name = quoteQualifiedName(securable.schema, securable.object);
            // Permiso de columna: `ON OBJECT::[esquema].[objeto]([columna])`.
            //
            // Se distingue «sin columna» (el campo no viene) de «columna vacía» (viene y no vale).
            // Tratar lo segundo como lo primero convertiría un permiso de columna en un permiso
            // sobre la tabla entera, en silencio: un GRANT más ancho del que se pidió.
            const column =
                securable.column === undefined
                    ? ""
                    : `(${quoteIdentifier(securable.column, "columna")})`;
            return ` ON OBJECT::${name}${column}`;
        }
        default:
            throw new Error("Ámbito de permiso no soportado.");
    }
}

/** Descripción del securable para la etiqueta que ve la persona. */
function describeSecurable(securable: Securable): string {
    switch (securable.scope) {
        case "SERVER":
            return "el servidor";
        case "DATABASE":
            return "la base de datos";
        case "SCHEMA":
            return `el esquema ${securable.schema}`;
        case "OBJECT":
            return securable.column
                ? `la columna ${securable.schema}.${securable.object}.${securable.column}`
                : `el objeto ${securable.schema}.${securable.object}`;
        default:
            return "";
    }
}

/**
 * Construye la sentencia de un cambio de permiso.
 *
 * @throws Si el permiso no está en la lista cerrada de su ámbito, si un identificador no pasa la
 * validación, o si se pide revocar un permiso concedible (haría falta `CASCADE`).
 */
export function buildPermissionStatement(change: PermissionChange): PlannedStatement {
    const scope: PermissionScope = change.securable.scope;
    const permission = assertPermission(scope, change.permission);
    const principal = quoteIdentifier(change.target.principal, "principal");
    const securable = renderSecurable(change.securable);
    const target = describeSecurable(change.securable);

    // El ámbito de servidor exige contexto master (error 4621 si no). En los demás, el nombre se
    // valida aquí para abortar al montar el cambio y no al ejecutarlo.
    const database =
        scope === "SERVER"
            ? "master"
            : assertIdentifier(change.database, "nombre de base de datos");

    if (change.action === "REVOKE" && change.grantable) {
        throw new Error(
            "Ese permiso está concedido con opción de conceder, y revocarlo exige CASCADE, que también revocaría lo que ese principal haya concedido a otros. No se hace desde aquí.",
        );
    }

    switch (change.action) {
        case "GRANT":
            return {
                label: `Conceder ${permission} sobre ${target} a ${change.target.principal}`,
                sql: `GRANT ${permission}${securable} TO ${principal}`,
                database,
            };
        case "GRANT_WITH_GRANT_OPTION":
            return {
                label: `Conceder ${permission} sobre ${target} a ${change.target.principal}, con opción de conceder`,
                sql: `GRANT ${permission}${securable} TO ${principal} WITH GRANT OPTION`,
                database,
            };
        case "DENY":
            return {
                label: `Denegar ${permission} sobre ${target} a ${change.target.principal}`,
                sql: `DENY ${permission}${securable} TO ${principal}`,
                database,
            };
        case "REVOKE":
            return {
                label: `Revocar ${permission} sobre ${target} a ${change.target.principal}`,
                sql: `REVOKE ${permission}${securable} FROM ${principal}`,
                database,
            };
        default:
            throw new Error("Acción de permiso no soportada.");
    }
}
