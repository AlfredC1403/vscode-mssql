/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { DatabaseSecurableClass } from "../types";

/**
 * Listas **cerradas** de nombres de permiso, por ámbito.
 *
 * Un nombre de permiso no es un identificador: no se puede entrecorchetar, así que `QUOTENAME` no
 * sirve y `identifiers.ts` tampoco. Es texto que entra directo en la sentencia, y por tanto es el
 * único punto de interpolación de la ruta de escritura que no está cubierto por la regla 11.2. Se
 * cubre con pertenencia exacta a una lista cerrada, y **abortando** si el nombre no está.
 *
 * Las cuatro listas salen de `sys.fn_builtin_permissions` de SQL Server 2022 (16.0.4295.3):
 * 51 de servidor, 105 de base, 13 de esquema y 13 de objeto. Hay un test que las contrasta con el
 * servidor para detectar la deriva: si una versión futura añade permisos, el test lo dice en lugar
 * de que el panel falle en producción.
 */

/** 51 permisos de ámbito de servidor. */
export const SERVER_PERMISSION_NAMES: readonly string[] = [
    "ADMINISTER BULK OPERATIONS",
    "ALTER ANY AVAILABILITY GROUP",
    "ALTER ANY CONNECTION",
    "ALTER ANY CREDENTIAL",
    "ALTER ANY DATABASE",
    "ALTER ANY ENDPOINT",
    "ALTER ANY EVENT NOTIFICATION",
    "ALTER ANY EVENT SESSION",
    "ALTER ANY EVENT SESSION ADD EVENT",
    "ALTER ANY EVENT SESSION ADD TARGET",
    "ALTER ANY EVENT SESSION DISABLE",
    "ALTER ANY EVENT SESSION DROP EVENT",
    "ALTER ANY EVENT SESSION DROP TARGET",
    "ALTER ANY EVENT SESSION ENABLE",
    "ALTER ANY EVENT SESSION OPTION",
    "ALTER ANY LINKED SERVER",
    "ALTER ANY LOGIN",
    "ALTER ANY SERVER AUDIT",
    "ALTER ANY SERVER ROLE",
    "ALTER RESOURCES",
    "ALTER SERVER STATE",
    "ALTER SETTINGS",
    "ALTER TRACE",
    "AUTHENTICATE SERVER",
    "CONNECT ANY DATABASE",
    "CONNECT SQL",
    "CONTROL SERVER",
    "CREATE ANY DATABASE",
    "CREATE ANY EVENT SESSION",
    "CREATE AVAILABILITY GROUP",
    "CREATE DDL EVENT NOTIFICATION",
    "CREATE ENDPOINT",
    "CREATE LOGIN",
    "CREATE SERVER ROLE",
    "CREATE TRACE EVENT NOTIFICATION",
    "DROP ANY EVENT SESSION",
    "EXTERNAL ACCESS ASSEMBLY",
    "IMPERSONATE ANY LOGIN",
    "SELECT ALL USER SECURABLES",
    "SHUTDOWN",
    "UNSAFE ASSEMBLY",
    "VIEW ANY CRYPTOGRAPHICALLY SECURED DEFINITION",
    "VIEW ANY DATABASE",
    "VIEW ANY DEFINITION",
    "VIEW ANY ERROR LOG",
    "VIEW ANY PERFORMANCE DEFINITION",
    "VIEW ANY SECURITY DEFINITION",
    "VIEW SERVER PERFORMANCE STATE",
    "VIEW SERVER SECURITY AUDIT",
    "VIEW SERVER SECURITY STATE",
    "VIEW SERVER STATE",
];

/** 105 permisos de ámbito de base de datos. */
export const DATABASE_PERMISSION_NAMES: readonly string[] = [
    "ADMINISTER DATABASE BULK OPERATIONS",
    "ALTER",
    "ALTER ANY APPLICATION ROLE",
    "ALTER ANY ASSEMBLY",
    "ALTER ANY ASYMMETRIC KEY",
    "ALTER ANY CERTIFICATE",
    "ALTER ANY COLUMN ENCRYPTION KEY",
    "ALTER ANY COLUMN MASTER KEY",
    "ALTER ANY CONTRACT",
    "ALTER ANY DATABASE AUDIT",
    "ALTER ANY DATABASE DDL TRIGGER",
    "ALTER ANY DATABASE EVENT NOTIFICATION",
    "ALTER ANY DATABASE EVENT SESSION",
    "ALTER ANY DATABASE EVENT SESSION ADD EVENT",
    "ALTER ANY DATABASE EVENT SESSION ADD TARGET",
    "ALTER ANY DATABASE EVENT SESSION DISABLE",
    "ALTER ANY DATABASE EVENT SESSION DROP EVENT",
    "ALTER ANY DATABASE EVENT SESSION DROP TARGET",
    "ALTER ANY DATABASE EVENT SESSION ENABLE",
    "ALTER ANY DATABASE EVENT SESSION OPTION",
    "ALTER ANY DATABASE SCOPED CONFIGURATION",
    "ALTER ANY DATASPACE",
    "ALTER ANY EXTERNAL DATA SOURCE",
    "ALTER ANY EXTERNAL FILE FORMAT",
    "ALTER ANY EXTERNAL JOB",
    "ALTER ANY EXTERNAL LANGUAGE",
    "ALTER ANY EXTERNAL LIBRARY",
    "ALTER ANY EXTERNAL STREAM",
    "ALTER ANY FULLTEXT CATALOG",
    "ALTER ANY MASK",
    "ALTER ANY MESSAGE TYPE",
    "ALTER ANY REMOTE SERVICE BINDING",
    "ALTER ANY ROLE",
    "ALTER ANY ROUTE",
    "ALTER ANY SCHEMA",
    "ALTER ANY SECURITY POLICY",
    "ALTER ANY SENSITIVITY CLASSIFICATION",
    "ALTER ANY SERVICE",
    "ALTER ANY SYMMETRIC KEY",
    "ALTER ANY USER",
    "ALTER LEDGER",
    "ALTER LEDGER CONFIGURATION",
    "AUTHENTICATE",
    "BACKUP DATABASE",
    "BACKUP LOG",
    "CHECKPOINT",
    "CONNECT",
    "CONNECT REPLICATION",
    "CONTROL",
    "CREATE AGGREGATE",
    "CREATE ANY DATABASE EVENT SESSION",
    "CREATE ASSEMBLY",
    "CREATE ASYMMETRIC KEY",
    "CREATE CERTIFICATE",
    "CREATE CONTRACT",
    "CREATE DATABASE",
    "CREATE DATABASE DDL EVENT NOTIFICATION",
    "CREATE DEFAULT",
    "CREATE EXTERNAL LANGUAGE",
    "CREATE EXTERNAL LIBRARY",
    "CREATE FULLTEXT CATALOG",
    "CREATE FUNCTION",
    "CREATE MESSAGE TYPE",
    "CREATE PROCEDURE",
    "CREATE QUEUE",
    "CREATE REMOTE SERVICE BINDING",
    "CREATE ROLE",
    "CREATE ROUTE",
    "CREATE RULE",
    "CREATE SCHEMA",
    "CREATE SERVICE",
    "CREATE SYMMETRIC KEY",
    "CREATE SYNONYM",
    "CREATE TABLE",
    "CREATE TYPE",
    "CREATE USER",
    "CREATE VIEW",
    "CREATE XML SCHEMA COLLECTION",
    "DELETE",
    "DROP ANY DATABASE EVENT SESSION",
    "ENABLE LEDGER",
    "EXECUTE",
    "EXECUTE ANY EXTERNAL ENDPOINT",
    "EXECUTE ANY EXTERNAL SCRIPT",
    "INSERT",
    "KILL DATABASE CONNECTION",
    "REFERENCES",
    "SELECT",
    "SHOWPLAN",
    "SUBSCRIBE QUERY NOTIFICATIONS",
    "TAKE OWNERSHIP",
    "UNMASK",
    "UPDATE",
    "VIEW ANY COLUMN ENCRYPTION KEY DEFINITION",
    "VIEW ANY COLUMN MASTER KEY DEFINITION",
    "VIEW ANY SENSITIVITY CLASSIFICATION",
    "VIEW CRYPTOGRAPHICALLY SECURED DEFINITION",
    "VIEW DATABASE PERFORMANCE STATE",
    "VIEW DATABASE SECURITY AUDIT",
    "VIEW DATABASE SECURITY STATE",
    "VIEW DATABASE STATE",
    "VIEW DEFINITION",
    "VIEW LEDGER CONTENT",
    "VIEW PERFORMANCE DEFINITION",
    "VIEW SECURITY DEFINITION",
];

/** 13 permisos de ámbito de esquema. */
export const SCHEMA_PERMISSION_NAMES: readonly string[] = [
    "ALTER",
    "CONTROL",
    "CREATE SEQUENCE",
    "DELETE",
    "EXECUTE",
    "INSERT",
    "REFERENCES",
    "SELECT",
    "TAKE OWNERSHIP",
    "UNMASK",
    "UPDATE",
    "VIEW CHANGE TRACKING",
    "VIEW DEFINITION",
];

/** 13 permisos de ámbito de objeto. */
export const OBJECT_PERMISSION_NAMES: readonly string[] = [
    "ALTER",
    "CONTROL",
    "DELETE",
    "EXECUTE",
    "INSERT",
    "RECEIVE",
    "REFERENCES",
    "SELECT",
    "TAKE OWNERSHIP",
    "UNMASK",
    "UPDATE",
    "VIEW CHANGE TRACKING",
    "VIEW DEFINITION",
];

/** Ámbito sobre el que se concede un permiso, tal como lo expresa la sentencia. */
export type PermissionScope = "SERVER" | "DATABASE" | "SCHEMA" | "OBJECT";

const NAMES_BY_SCOPE: Record<PermissionScope, readonly string[]> = {
    SERVER: SERVER_PERMISSION_NAMES,
    DATABASE: DATABASE_PERMISSION_NAMES,
    SCHEMA: SCHEMA_PERMISSION_NAMES,
    OBJECT: OBJECT_PERMISSION_NAMES,
};

/**
 * Traduce la clase que muestra el panel (leída del catálogo en M4) al ámbito de la sentencia.
 *
 * Devuelve `undefined` para las clases que M4 **muestra** pero M5 no sabe expresar todavía:
 * `DATABASE_PRINCIPAL` (los permisos sobre otro usuario o rol, como `IMPERSONATE`) y `TYPE`. Eso es
 * un **aborto explícito**, no una omisión silenciosa: el panel tiene que decir que esa fila no se
 * puede cambiar desde aquí, en lugar de ofrecer un botón que genere una sentencia mal formada.
 */
export function toPermissionScope(
    securableClass: DatabaseSecurableClass | "SERVER",
): PermissionScope | undefined {
    switch (securableClass) {
        case "SERVER":
            return "SERVER";
        case "DATABASE":
            return "DATABASE";
        case "SCHEMA":
            return "SCHEMA";
        case "OBJECT_OR_COLUMN":
            return "OBJECT";
        default:
            return undefined;
    }
}

/** `true` si el nombre de permiso existe en ese ámbito. Comparación exacta, en mayúsculas. */
export function isKnownPermission(scope: PermissionScope, permission: string): boolean {
    if (typeof permission !== "string") {
        return false;
    }
    return NAMES_BY_SCOPE[scope]?.includes(permission.trim().toUpperCase()) ?? false;
}

/**
 * Devuelve el nombre de permiso listo para la sentencia, y **lanza si no está en la lista**.
 *
 * El mensaje nombra el ámbito pero **no repite el valor rechazado**, por la misma razón que
 * `identifiers.ts`: un mensaje de error acaba en un registro (regla 11.3).
 *
 * @throws Si el permiso no pertenece a la lista cerrada de ese ámbito.
 */
export function assertPermission(scope: PermissionScope, permission: string): string {
    if (!isKnownPermission(scope, permission)) {
        throw new Error(
            `Ese permiso no está en la lista de permisos de ámbito ${scope} que SQL Server 2022 reconoce, así que no se construye ninguna sentencia.`,
        );
    }
    return permission.trim().toUpperCase();
}

/** Número de permisos por ámbito, para el test de deriva contra el servidor. */
export const PERMISSION_COUNTS: Record<PermissionScope, number> = {
    SERVER: SERVER_PERMISSION_NAMES.length,
    DATABASE: DATABASE_PERMISSION_NAMES.length,
    SCHEMA: SCHEMA_PERMISSION_NAMES.length,
    OBJECT: OBJECT_PERMISSION_NAMES.length,
};
