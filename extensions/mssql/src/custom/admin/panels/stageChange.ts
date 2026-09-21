/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { PlannedStatement } from "../sql/ddl/plan";
import { buildPermissionStatement } from "../sql/ddl/permissions";
import {
    buildDatabaseRoleMembershipStatement,
    buildServerRoleMembershipStatement,
} from "../sql/ddl/roleMembership";
import {
    buildDropUserStatement,
    buildLoginEnableStatement,
    buildUserDefaultSchemaStatement,
} from "../sql/ddl/principals";
import {
    buildCreateDatabaseRoleStatement,
    buildCreateLoginStatement,
    buildCreateServerRoleStatement,
    buildCreateContainedUserStatement,
    buildCreateUserStatement,
    buildDropLoginStatement,
    buildDropRoleStatement,
    buildResetPasswordStatement,
} from "../sql/ddl/createPrincipals";
import { toPermissionScope } from "../sql/ddl/permissionNames";
import {
    databaseIsContained,
    loginUnchanged,
    membershipState,
    serverPermissionState,
    userUnchanged,
} from "../sql/ddl/preconditions";
import { DatabaseSecurableClass } from "../sql/types";
import { PendingChange } from "../../sharedInterfaces/pendingChanges";
import { StageChangeRequest } from "../../sharedInterfaces/adminPanel";

/**
 * Traduce lo que pide el webview a una sentencia.
 *
 * **El webview manda datos, nunca T-SQL.** Aquí es donde esos datos se convierten en una sentencia,
 * usando los generadores de `admin/sql/ddl/`, que validan y **abortan**. Si algo no pasa, esta
 * función devuelve el motivo y no hay cambio que montar.
 *
 * Cada cambio lleva su precondición, que se comprueba **dentro de la transacción**: así el objeto
 * sobre el que se escribe es el que el usuario vio, sin ventana entre comprobar y escribir.
 */
export interface StageResult {
    statement?: PlannedStatement;
    /** Datos del cambio para la lista de pendientes, ya con su texto para mostrar. */
    change?: Omit<PendingChange, "id">;
    /** Motivo por el que no se pudo montar, listo para mostrar. */
    errorMessage?: string;
}

/** Texto de la transición, para la fila del cajón de cambios. */
function permissionTransition(action: string): string {
    switch (action) {
        case "GRANT":
            return "→ Concedido";
        case "GRANT_WITH_GRANT_OPTION":
            return "→ Concedido con opción de conceder";
        case "DENY":
            return "→ Denegado";
        default:
            return "→ Sin conceder";
    }
}

export function stageRequestToStatement(
    request: StageChangeRequest,
    database: string,
): StageResult {
    try {
        switch (request.kind) {
            case "serverPermission": {
                const statement = buildPermissionStatement({
                    action: request.action,
                    permission: request.permission,
                    securable: { scope: "SERVER" },
                    target: { principal: request.principal },
                    database: "master",
                    grantable: request.grantable,
                });
                statement.precondition = serverPermissionState(
                    request.principal,
                    request.permission,
                    request.currentState,
                );
                return {
                    statement,
                    change: {
                        kind: "serverPermission",
                        subject: `${request.principal} · ${request.permission}`,
                        transition: permissionTransition(request.action),
                        scope: "Servidor",
                        sql: statement.sql,
                        destructive: false,
                    },
                };
            }

            case "databasePermission": {
                const scope = toPermissionScope(request.securableClass as DatabaseSecurableClass);
                if (!scope || scope === "SERVER") {
                    // Aborto explícito, no omisión silenciosa: M4 muestra clases que M5 no sabe
                    // expresar (permisos sobre otro usuario o rol, y sobre tipos).
                    return {
                        errorMessage:
                            "Ese tipo de permiso se puede ver pero todavía no se puede cambiar desde el panel.",
                    };
                }

                const securable =
                    scope === "DATABASE"
                        ? ({ scope: "DATABASE" } as const)
                        : scope === "SCHEMA"
                          ? ({ scope: "SCHEMA", schema: request.securable } as const)
                          : splitObjectName(request.securable, request.columnName);

                if (!securable) {
                    return {
                        errorMessage:
                            "El nombre del objeto del permiso no tiene la forma esquema.objeto, así que no se construyó ninguna sentencia.",
                    };
                }

                const statement = buildPermissionStatement({
                    action: request.action,
                    permission: request.permission,
                    securable,
                    target: { principal: request.principal },
                    database,
                    grantable: request.grantable,
                });
                return {
                    statement,
                    change: {
                        kind: "databasePermission",
                        subject: `${request.principal} · ${request.permission}`,
                        transition: permissionTransition(request.action),
                        scope: database,
                        sql: statement.sql,
                        destructive: false,
                    },
                };
            }

            case "serverRoleMembership": {
                const statement = buildServerRoleMembershipStatement(request);
                statement.precondition = membershipState(
                    request.role,
                    request.member,
                    "server",
                    request.action === "ADD" ? "absent" : "present",
                );
                return {
                    statement,
                    change: {
                        kind: "serverRoleMembership",
                        subject: `${request.member} · ${request.role}`,
                        transition: request.action === "ADD" ? "→ Miembro" : "→ Sin pertenencia",
                        scope: "Servidor",
                        sql: statement.sql,
                        destructive: false,
                    },
                };
            }

            case "databaseRoleMembership": {
                const statement = buildDatabaseRoleMembershipStatement({ ...request, database });
                statement.precondition = membershipState(
                    request.role,
                    request.member,
                    "database",
                    request.action === "ADD" ? "absent" : "present",
                );
                return {
                    statement,
                    change: {
                        kind: "databaseRoleMembership",
                        subject: `${request.member} · ${request.role}`,
                        transition: request.action === "ADD" ? "→ Miembro" : "→ Sin pertenencia",
                        scope: database,
                        sql: statement.sql,
                        destructive: false,
                    },
                };
            }

            case "loginEnabled": {
                const statement = buildLoginEnableStatement(request.login, request.enabled);
                statement.precondition = loginUnchanged(request.login, request.createDate);
                return {
                    statement,
                    change: {
                        kind: "loginEnabled",
                        subject: request.login,
                        transition: request.enabled ? "→ Habilitado" : "→ Deshabilitado",
                        scope: "Servidor",
                        sql: statement.sql,
                        destructive: false,
                    },
                };
            }

            case "userDefaultSchema": {
                const statement = buildUserDefaultSchemaStatement(
                    database,
                    request.user,
                    request.schema,
                );
                statement.precondition = userUnchanged(request.user, request.createDate);
                return {
                    statement,
                    change: {
                        kind: "userDefaultSchema",
                        subject: request.user,
                        transition: `→ Esquema ${request.schema}`,
                        scope: database,
                        sql: statement.sql,
                        destructive: false,
                    },
                };
            }

            case "dropUser": {
                const statement = buildDropUserStatement(database, request.user);
                statement.precondition = userUnchanged(request.user, request.createDate);
                return {
                    statement,
                    change: {
                        kind: "dropUser",
                        subject: request.user,
                        transition: "→ Borrado",
                        scope: database,
                        sql: statement.sql,
                        // La única destructiva de M5: obliga a escribir el nombre (regla 11.5).
                        destructive: true,
                    },
                };
            }

            // ----------------------------------------------------------------
            // M6: creación de principales. La contraseña **no llega aquí**: el generador pone la
            // ranura y el host pide el valor al ejecutar (regla 11.3).
            // ----------------------------------------------------------------
            case "createLogin": {
                const statement = buildCreateLoginStatement({
                    name: request.login,
                    policy: {
                        checkPolicy: request.checkPolicy,
                        checkExpiration: request.checkExpiration,
                        mustChange: request.mustChange,
                    },
                    defaultDatabase: request.defaultDatabase,
                });
                return {
                    statement,
                    change: {
                        kind: "createLogin",
                        subject: request.login,
                        transition: "→ Login nuevo",
                        scope: "Servidor",
                        sql: statement.sql,
                        destructive: false,
                    },
                };
            }

            case "resetPassword": {
                const statement = buildResetPasswordStatement(request.login, {
                    mustChange: request.mustChange,
                    unlock: request.unlock,
                });
                return {
                    statement,
                    change: {
                        kind: "resetPassword",
                        subject: request.login,
                        transition: "→ Contraseña nueva",
                        scope: "Servidor",
                        sql: statement.sql,
                        // Cambiar una contraseña no borra nada, pero deja fuera a quien la usara, así
                        // que se trata como destructiva: obliga a escribir el nombre (regla 11.5).
                        destructive: true,
                    },
                };
            }

            case "dropLogin": {
                const statement = buildDropLoginStatement(request.login);
                statement.precondition = loginUnchanged(request.login, request.createDate);
                return {
                    statement,
                    change: {
                        kind: "dropLogin",
                        subject: request.login,
                        transition: "→ Borrado",
                        scope: "Servidor",
                        sql: statement.sql,
                        destructive: true,
                    },
                };
            }

            case "createUser": {
                const statement = buildCreateUserStatement({
                    name: request.user,
                    database,
                    source: request.login
                        ? { kind: "login", login: request.login }
                        : { kind: "withoutLogin" },
                    defaultSchema: request.defaultSchema,
                });
                return {
                    statement,
                    change: {
                        kind: "createUser",
                        subject: request.user,
                        transition: request.login ? `→ Para ${request.login}` : "→ Sin login",
                        scope: database,
                        sql: statement.sql,
                        destructive: false,
                    },
                };
            }

            case "createContainedUser": {
                const statement = buildCreateContainedUserStatement({
                    name: request.user,
                    database,
                    defaultSchema: request.defaultSchema,
                });
                // La contención se comprueba **dentro de la transacción**: el panel pinta la lista
                // de bases una vez, y entre eso y ejecutar alguien puede haberla quitado.
                statement.precondition = databaseIsContained(database);
                return {
                    statement,
                    change: {
                        kind: "createContainedUser",
                        subject: request.user,
                        transition: "→ Con contraseña propia",
                        scope: database,
                        sql: statement.sql,
                        destructive: false,
                    },
                };
            }

            case "createServerRole": {
                const statement = buildCreateServerRoleStatement(request.role, request.owner);
                return {
                    statement,
                    change: {
                        kind: "createServerRole",
                        subject: request.role,
                        transition: "→ Rol nuevo",
                        scope: "Servidor",
                        sql: statement.sql,
                        destructive: false,
                    },
                };
            }

            case "createDatabaseRole": {
                const statement = buildCreateDatabaseRoleStatement(
                    database,
                    request.role,
                    request.owner,
                );
                return {
                    statement,
                    change: {
                        kind: "createDatabaseRole",
                        subject: request.role,
                        transition: "→ Rol nuevo",
                        scope: database,
                        sql: statement.sql,
                        destructive: false,
                    },
                };
            }

            case "dropServerRole": {
                const statement = buildDropRoleStatement("server", request.role);
                return {
                    statement,
                    change: {
                        kind: "dropServerRole",
                        subject: request.role,
                        transition: "→ Borrado",
                        scope: "Servidor",
                        sql: statement.sql,
                        destructive: true,
                    },
                };
            }

            case "dropDatabaseRole": {
                const statement = buildDropRoleStatement("database", request.role, database);
                return {
                    statement,
                    change: {
                        kind: "dropDatabaseRole",
                        subject: request.role,
                        transition: "→ Borrado",
                        scope: database,
                        sql: statement.sql,
                        destructive: true,
                    },
                };
            }

            default:
                return { errorMessage: "El panel pidió un cambio que no existe." };
        }
    } catch (error) {
        // Los generadores abortan con un mensaje que **no repite el valor rechazado**, así que se
        // puede mostrar tal cual.
        return {
            errorMessage: error instanceof Error ? error.message : "No se pudo montar el cambio.",
        };
    }
}

/** Parte `esquema.objeto` en sus dos mitades. Devuelve `undefined` si no tiene esa forma. */
function splitObjectName(
    qualified: string,
    column?: string,
): { scope: "OBJECT"; schema: string; object: string; column?: string } | undefined {
    const parts = qualified.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return undefined;
    }
    return column
        ? { scope: "OBJECT", schema: parts[0], object: parts[1], column }
        : { scope: "OBJECT", schema: parts[0], object: parts[1] };
}
