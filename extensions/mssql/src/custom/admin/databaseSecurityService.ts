/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { AdminQueryRunner } from "./sql/execute";
import { DATABASES_SQL, mapDatabases } from "./sql/queries/databases";
import {
    buildDatabaseUsersStatement,
    buildRoleMembershipStatement,
    mapDatabaseUsers,
    mapRoleMemberships,
    mapRolesByMember,
} from "./sql/queries/databaseUsers";
import { buildDatabaseRolesStatement, mapDatabaseRoles } from "./sql/queries/databaseRoles";
import { buildSchemasStatement, mapSchemas } from "./sql/queries/schemas";
import {
    buildDatabasePermissionsStatement,
    mapDatabasePermissions,
} from "./sql/queries/databasePermissions";
import {
    DatabaseChoice,
    DatabaseRole,
    DatabaseUser,
    PermissionMatrixData,
    SchemaInfo,
} from "./sql/types";
import { SectionResult } from "./serverSecurityService";

/**
 * Lee la seguridad de **una base de datos**, en solo lectura (hito M4).
 *
 * Igual que `ServerSecurityService`: una lectura por sección, cada una con su propio error, para que
 * un permiso que falte no deje el panel entero en blanco.
 *
 * Ninguna consulta hace `USE`: todas llegan al catálogo con nombre de tres partes. El panel comparte
 * la conexión con el editor de consultas del usuario, y cambiar la base activa de esa conexión sería
 * un efecto secundario inaceptable.
 */
export class DatabaseSecurityService {
    constructor(private readonly runner: AdminQueryRunner) {}

    /** Bases de datos de la instancia, para el selector. */
    public async loadDatabases(): Promise<SectionResult<DatabaseChoice[]>> {
        const outcome = await this.runner.tryRun(DATABASES_SQL);
        return outcome.errorMessage
            ? { errorMessage: outcome.errorMessage }
            : { data: mapDatabases(outcome.result) };
    }

    /** Usuarios de la base, con los roles a los que pertenecen. */
    public async loadUsers(database: string): Promise<SectionResult<DatabaseUser[]>> {
        const users = await this.runner.tryRun(buildDatabaseUsersStatement(database));
        if (users.errorMessage) {
            return { errorMessage: users.errorMessage };
        }

        // La pertenencia a roles es un añadido: si falla, los usuarios se ven igual, sin roles.
        const memberships = await this.runner.tryRun(buildRoleMembershipStatement(database));
        const rolesByMember = memberships.result
            ? mapRolesByMember(mapRoleMemberships(memberships.result))
            : new Map<string, string[]>();

        return { data: mapDatabaseUsers(users.result, rolesByMember) };
    }

    /** Roles de la base, fijos, de usuario y de aplicación, con sus miembros. */
    public async loadRoles(database: string): Promise<SectionResult<DatabaseRole[]>> {
        const roles = await this.runner.tryRun(buildDatabaseRolesStatement(database));
        if (roles.errorMessage) {
            return { errorMessage: roles.errorMessage };
        }
        const memberships = await this.runner.tryRun(buildRoleMembershipStatement(database));
        return {
            data: mapDatabaseRoles(
                roles.result,
                memberships.result ? mapRoleMemberships(memberships.result) : [],
            ),
        };
    }

    /** Esquemas con su propietario. */
    public async loadSchemas(database: string): Promise<SectionResult<SchemaInfo[]>> {
        const outcome = await this.runner.tryRun(buildSchemasStatement(database));
        return outcome.errorMessage
            ? { errorMessage: outcome.errorMessage }
            : { data: mapSchemas(outcome.result) };
    }

    /**
     * Todo lo que la matriz de permisos necesita, en una sola sección.
     *
     * Van juntos a propósito: la matriz no se puede calcular con los permisos sin las pertenencias,
     * así que tenerlos en secciones distintas solo permitiría mostrarla a medias.
     */
    public async loadPermissionData(
        database: string,
    ): Promise<SectionResult<PermissionMatrixData>> {
        const permissions = await this.runner.tryRun(buildDatabasePermissionsStatement(database));
        if (permissions.errorMessage) {
            return { errorMessage: permissions.errorMessage };
        }

        const memberships = await this.runner.tryRun(buildRoleMembershipStatement(database));
        if (memberships.errorMessage) {
            return { errorMessage: memberships.errorMessage };
        }

        const users = await this.runner.tryRun(buildDatabaseUsersStatement(database));
        const roles = await this.runner.tryRun(buildDatabaseRolesStatement(database));
        const membershipList = mapRoleMemberships(memberships.result);

        return {
            data: {
                permissions: mapDatabasePermissions(permissions.result),
                memberships: membershipList,
                users: mapDatabaseUsers(users.result, new Map()).map((user) => ({
                    name: user.name,
                    system: user.system,
                })),
                roles: mapDatabaseRoles(roles.result, membershipList).map((role) => ({
                    name: role.name,
                    fixed: role.fixed,
                })),
            },
        };
    }
}
