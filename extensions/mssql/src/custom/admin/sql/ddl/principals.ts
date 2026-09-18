/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { PlannedStatement } from "./plan";
import { assertIdentifier, quoteIdentifier } from "../../../util/identifiers";

/**
 * Generadores para los cambios sobre principales que M5 entrega. Funciones puras que **abortan** si
 * un identificador no pasa la validación (regla 11.2 del brief).
 *
 * **Ninguno lleva contraseña.** `CREATE LOGIN` y `ALTER LOGIN ... WITH PASSWORD` viven en
 * `createPrincipals.ts` desde M6, con el mecanismo de ranura de `secrets.ts`: la cláusula `PASSWORD`
 * no acepta variable ni parámetro (error 102, medido) y `query/simpleexecute` no tiene canal de
 * parámetros, así que el secreto viaja dentro del texto del lote y lo que se controla es quién lo ve
 * y cuándo. Ver FORK.md §23.2.
 *
 * Las tres sentencias son plenamente transaccionales: medido contra SQL Server 2022, tras un
 * `ROLLBACK` el login vuelve a estar habilitado, el esquema por omisión vuelve al anterior y el
 * usuario borrado reaparece con su tipo y su esquema (ver FORK.md §22).
 */

/** Habilitar o deshabilitar un login. */
export function buildLoginEnableStatement(login: string, enabled: boolean): PlannedStatement {
    const name = quoteIdentifier(login, "login");
    return {
        label: enabled ? `Habilitar el login ${login}` : `Deshabilitar el login ${login}`,
        sql: `ALTER LOGIN ${name} ${enabled ? "ENABLE" : "DISABLE"}`,
        // Ámbito de servidor: se enruta por master, igual que los GRANT de servidor.
        database: "master",
    };
}

/** Cambiar el esquema por omisión de un usuario de base de datos. */
export function buildUserDefaultSchemaStatement(
    database: string,
    user: string,
    schema: string,
): PlannedStatement {
    const name = quoteIdentifier(user, "usuario");
    const target = quoteIdentifier(schema, "esquema");
    return {
        label: `Cambiar el esquema por omisión de ${user} a ${schema}`,
        sql: `ALTER USER ${name} WITH DEFAULT_SCHEMA = ${target}`,
        database: assertIdentifier(database, "nombre de base de datos"),
    };
}

/**
 * Borrar un usuario de base de datos.
 *
 * **Es la única operación destructiva de M5**, así que es la que ejercita la regla 11.5: el
 * controlador pide escribir el nombre antes de ejecutar. Reversible por `ROLLBACK` dentro del lote
 * —comprobado—, pero irreversible en cuanto el lote confirma.
 */
export function buildDropUserStatement(database: string, user: string): PlannedStatement {
    const name = quoteIdentifier(user, "usuario");
    return {
        label: `Borrar el usuario ${user}`,
        sql: `DROP USER ${name}`,
        database: assertIdentifier(database, "nombre de base de datos"),
    };
}
