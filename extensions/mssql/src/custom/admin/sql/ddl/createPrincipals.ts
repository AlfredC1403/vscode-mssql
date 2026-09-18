/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { PlannedStatement } from "./plan";
import { SECRET_MARKER } from "./secrets";
import { assertIdentifier, quoteIdentifier } from "../../../util/identifiers";

/**
 * Creación de principales (M6). Funciones puras que **abortan** si algo no pasa la validación.
 *
 * Todas las sentencias de este archivo son **transaccionales**, medido contra SQL Server 2022: tras
 * un `ROLLBACK`, el login, el usuario y los roles creados desaparecen, y el `DROP LOGIN` revertido
 * devuelve el login con su contraseña anterior intacta (FORK.md §23.1). Por eso van en el lote
 * normal y no por la vía irreversible, donde solo quedan el DDL de base de datos y `KILL`.
 *
 * ## Las contraseñas no están aquí
 *
 * `buildCreateLoginStatement` no recibe la contraseña: pone `SECRET_MARKER` en su sitio y declara la
 * ranura. El valor lo pide el host al ejecutar y lo sustituye el ejecutor con `QUOTENAME` en el
 * servidor. El motivo, medido, está en `secrets.ts`: la cláusula `PASSWORD` no acepta variable
 * (error 102), así que el secreto tiene que ser un literal, y lo único que se puede controlar es
 * quién lo ve y cuándo.
 */

/** Opciones de política de contraseña de un login de SQL Server. */
export interface LoginPasswordPolicy {
    /** `CHECK_POLICY`: aplica la política de contraseñas de Windows. */
    checkPolicy: boolean;
    /** `CHECK_EXPIRATION`: aplica la caducidad. */
    checkExpiration: boolean;
    /** `MUST_CHANGE`: obliga a cambiarla en el primer inicio de sesión. */
    mustChange: boolean;
}

/** Datos de un login nuevo. La contraseña **no** viaja aquí. */
export interface NewLogin {
    name: string;
    policy: LoginPasswordPolicy;
    /** Base de datos por omisión. Vacío deja la del servidor. */
    defaultDatabase?: string;
    /** Crear el login deshabilitado, para prepararlo sin dejarlo usable todavía. */
    disabled?: boolean;
}

/**
 * `CREATE LOGIN [nombre] WITH PASSWORD = <ranura>, ...`
 *
 * `MUST_CHANGE` **exige** `CHECK_EXPIRATION = ON`: medido, con `OFF` el motor devuelve el error
 * 15099. En lugar de dejar que el usuario mande una sentencia que el servidor va a rechazar, se
 * aborta aquí con un motivo que explica la combinación.
 *
 * @throws Si el nombre no pasa la validación, o si las opciones son incompatibles.
 */
export function buildCreateLoginStatement(login: NewLogin): PlannedStatement {
    const name = quoteIdentifier(login.name, "login");

    if (login.policy.mustChange && !login.policy.checkExpiration) {
        throw new Error(
            "MUST_CHANGE exige CHECK_EXPIRATION = ON: SQL Server rechaza la combinación con el error 15099.",
        );
    }
    if (login.policy.mustChange && !login.policy.checkPolicy) {
        // Mismo caso que el anterior: el motor lo rechaza, así que no se envía.
        throw new Error("MUST_CHANGE exige CHECK_POLICY = ON.");
    }

    const options = [
        `CHECK_POLICY = ${login.policy.checkPolicy ? "ON" : "OFF"}`,
        `CHECK_EXPIRATION = ${login.policy.checkExpiration ? "ON" : "OFF"}`,
    ];
    if (login.defaultDatabase) {
        options.push(
            `DEFAULT_DATABASE = ${quoteIdentifier(login.defaultDatabase, "base de datos por omisión")}`,
        );
    }

    // `MUST_CHANGE` va pegado a PASSWORD, antes de la coma, no en la lista de opciones.
    const mustChange = login.policy.mustChange ? " MUST_CHANGE" : "";

    return {
        label: `Crear el login ${login.name}`,
        sql: `CREATE LOGIN ${name} WITH PASSWORD = ${SECRET_MARKER}${mustChange}, ${options.join(", ")}`,
        database: "master",
        secret: {
            prompt: `Contraseña del login ${login.name}`,
            subject: `el login ${login.name}`,
        },
    };
}

/**
 * `ALTER LOGIN [nombre] WITH PASSWORD = <ranura>` para restablecer una contraseña.
 *
 * Es la operación de administrador, distinta del diálogo del upstream: ese solo salta cuando **tu
 * propia** contraseña ha caducado al conectar (`SqlConnectionErrorType.PasswordExpired`) y no sirve
 * para cambiar la de otro login. Ver la corrección de FORK.md §23.5.
 *
 * Transaccional: medido, tras un `ROLLBACK` la contraseña vieja sigue siendo válida.
 *
 * @throws Si el nombre no pasa la validación.
 */
export function buildResetPasswordStatement(
    login: string,
    options: { mustChange?: boolean; unlock?: boolean } = {},
): PlannedStatement {
    const name = quoteIdentifier(login, "login");
    // `MUST_CHANGE` y `UNLOCK` son cláusulas que van pegadas a `PASSWORD`, sin coma y sin `=`. No
    // se pueden combinar entre sí: `MUST_CHANGE` con `UNLOCK` lo rechaza el motor.
    if (options.mustChange && options.unlock) {
        throw new Error(
            "MUST_CHANGE y UNLOCK no se pueden pedir a la vez en el mismo ALTER LOGIN.",
        );
    }
    const suffix = options.mustChange ? " MUST_CHANGE" : options.unlock ? " UNLOCK" : "";

    return {
        label: options.unlock
            ? `Restablecer la contraseña y desbloquear el login ${login}`
            : `Restablecer la contraseña del login ${login}`,
        sql: `ALTER LOGIN ${name} WITH PASSWORD = ${SECRET_MARKER}${suffix}`,
        database: "master",
        secret: {
            prompt: `Contraseña nueva para el login ${login}`,
            subject: `el login ${login}`,
        },
    };
}

/** Qué clase de usuario de base de datos se crea. */
export type NewUserKind =
    /** Asignado a un login del servidor: el caso normal. */
    | { kind: "login"; login: string }
    /** Sin login: para pertenencias y permisos que no se conectan. */
    | { kind: "withoutLogin" };

/** Datos de un usuario de base nuevo. */
export interface NewUser {
    name: string;
    database: string;
    source: NewUserKind;
    /** Esquema por omisión. Vacío deja `dbo`. */
    defaultSchema?: string;
}

/**
 * `CREATE USER [nombre] FOR LOGIN [login]` o `... WITHOUT LOGIN`.
 *
 * No admite contraseña: un usuario **contenido** (con su propia contraseña) es otro tipo de objeto y
 * solo existe en bases con `CONTAINMENT = PARTIAL`, que este panel no gestiona. Si algún día se
 * añade, será una función aparte con su propia ranura, no un parámetro opcional aquí.
 *
 * @throws Si algún identificador no pasa la validación.
 */
export function buildCreateUserStatement(user: NewUser): PlannedStatement {
    const name = quoteIdentifier(user.name, "usuario");
    const clauses: string[] =
        user.source.kind === "login"
            ? [`FOR LOGIN ${quoteIdentifier(user.source.login, "login")}`]
            : ["WITHOUT LOGIN"];

    if (user.defaultSchema) {
        clauses.push(
            `WITH DEFAULT_SCHEMA = ${quoteIdentifier(user.defaultSchema, "esquema por omisión")}`,
        );
    }

    return {
        label:
            user.source.kind === "login"
                ? `Crear el usuario ${user.name} para el login ${user.source.login}`
                : `Crear el usuario ${user.name} sin login`,
        sql: `CREATE USER ${name} ${clauses.join(" ")}`,
        database: assertIdentifier(user.database, "nombre de base de datos"),
    };
}

/**
 * `CREATE SERVER ROLE [nombre]`, opcionalmente con propietario.
 *
 * @throws Si algún identificador no pasa la validación.
 */
export function buildCreateServerRoleStatement(role: string, owner?: string): PlannedStatement {
    const name = quoteIdentifier(role, "rol de servidor");
    const authorization = owner
        ? ` AUTHORIZATION ${quoteIdentifier(owner, "propietario del rol")}`
        : "";
    return {
        label: `Crear el rol de servidor ${role}`,
        sql: `CREATE SERVER ROLE ${name}${authorization}`,
        database: "master",
    };
}

/**
 * `CREATE ROLE [nombre]` en una base de datos, opcionalmente con propietario.
 *
 * @throws Si algún identificador no pasa la validación.
 */
export function buildCreateDatabaseRoleStatement(
    database: string,
    role: string,
    owner?: string,
): PlannedStatement {
    const name = quoteIdentifier(role, "rol de base de datos");
    const authorization = owner
        ? ` AUTHORIZATION ${quoteIdentifier(owner, "propietario del rol")}`
        : "";
    return {
        label: `Crear el rol ${role}`,
        sql: `CREATE ROLE ${name}${authorization}`,
        database: assertIdentifier(database, "nombre de base de datos"),
    };
}

/**
 * `DROP LOGIN [nombre]`.
 *
 * Destructiva: el controlador pide **escribir el nombre** antes de ejecutar (regla 11.5). Y tiene un
 * efecto que el usuario no ve venir, así que la etiqueta lo dice: borrar un login **no** borra los
 * usuarios de base que lo tenían asignado; se quedan huérfanos y hay que arreglarlos aparte.
 *
 * Transaccional: medido, tras un `ROLLBACK` el login vuelve con su contraseña.
 *
 * @throws Si el nombre no pasa la validación.
 */
export function buildDropLoginStatement(login: string): PlannedStatement {
    const name = quoteIdentifier(login, "login");
    return {
        label: `Borrar el login ${login}`,
        sql: `DROP LOGIN ${name}`,
        database: "master",
    };
}

/**
 * `DROP SERVER ROLE` / `DROP ROLE`.
 *
 * SQL Server rechaza borrar un rol que todavía tiene miembros: medido, **error 15144**, «The role has
 * members. It must be empty before it can be dropped». Así que quien llame tiene que quitar los
 * miembros primero, **en el mismo lote**. Eso es justo lo que la transacción hace posible —medido: el
 * lote «quitar miembro + borrar rol» se aplica entero— y sin ella habría que hacerlo en dos pasos,
 * con el rol vacío y sin borrar si el segundo fallara.
 *
 * @throws Si algún identificador no pasa la validación.
 */
export function buildDropRoleStatement(
    scope: "server" | "database",
    role: string,
    database?: string,
): PlannedStatement {
    if (scope === "server") {
        return {
            label: `Borrar el rol de servidor ${role}`,
            sql: `DROP SERVER ROLE ${quoteIdentifier(role, "rol de servidor")}`,
            database: "master",
        };
    }
    return {
        label: `Borrar el rol ${role}`,
        sql: `DROP ROLE ${quoteIdentifier(role, "rol de base de datos")}`,
        database: assertIdentifier(database, "nombre de base de datos"),
    };
}
