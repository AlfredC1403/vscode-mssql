/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { AdminQueryRunner } from "./sql/execute";
import { LOGINS_SQL, mapLogins } from "./sql/queries/logins";
import {
    SERVER_ROLES_SQL,
    SERVER_ROLE_MEMBERS_SQL,
    mapServerRoleMembership,
    mapServerRoles,
} from "./sql/queries/serverRoles";
import { SERVER_PERMISSIONS_SQL, mapServerPermissions } from "./sql/queries/serverPermissions";
import {
    INSTANCE_PROPERTIES_SQL,
    INSTANCE_RUNTIME_SQL,
    mapInstanceProperties,
} from "./sql/queries/instanceProperties";
import { ACTIVE_SESSIONS_SQL, mapActiveSessions } from "./sql/queries/sessions";
import {
    ActiveSession,
    InstanceProperties,
    Login,
    ServerPermission,
    ServerRole,
} from "./sql/types";

/** Lo que devuelve cada carga: los datos, o el motivo por el que no se pudieron leer. */
export interface SectionResult<T> {
    data?: T;
    errorMessage?: string;
}

/**
 * Lee la seguridad del servidor, en solo lectura (hito M3).
 *
 * Cada sección se carga por separado y con su propio error. Un login sin `VIEW SERVER STATE` ve
 * logins, roles y permisos, y solo pierde sesiones y los datos de ejecución de la instancia; si
 * todo fuera una sola operación, un permiso que falta dejaría el panel entero en blanco.
 */
export class ServerSecurityService {
    constructor(private readonly runner: AdminQueryRunner) {}

    /** Logins del servidor, con sus roles resueltos. */
    public async loadLogins(): Promise<SectionResult<Login[]>> {
        const logins = await this.runner.tryRun(LOGINS_SQL);
        if (logins.errorMessage) {
            return { errorMessage: logins.errorMessage };
        }

        // La pertenencia a roles es un añadido: si falla, los logins se muestran igual, sin roles.
        const members = await this.runner.tryRun(SERVER_ROLE_MEMBERS_SQL);
        const rolesByMember = members.result
            ? mapServerRoleMembership(members.result)
            : new Map<string, string[]>();

        return { data: mapLogins(logins.result, rolesByMember) };
    }

    /** Roles de servidor, fijos y de usuario, con sus miembros. */
    public async loadServerRoles(): Promise<SectionResult<ServerRole[]>> {
        const roles = await this.runner.tryRun(SERVER_ROLES_SQL);
        if (roles.errorMessage) {
            return { errorMessage: roles.errorMessage };
        }
        const members = await this.runner.tryRun(SERVER_ROLE_MEMBERS_SQL);
        return { data: mapServerRoles(roles.result, members.result) };
    }

    /** Permisos explícitos a nivel de servidor. */
    public async loadServerPermissions(): Promise<SectionResult<ServerPermission[]>> {
        const outcome = await this.runner.tryRun(SERVER_PERMISSIONS_SQL);
        return outcome.errorMessage
            ? { errorMessage: outcome.errorMessage }
            : { data: mapServerPermissions(outcome.result) };
    }

    /** Propiedades de la instancia. Los datos de ejecución son opcionales. */
    public async loadInstanceProperties(): Promise<SectionResult<InstanceProperties>> {
        const properties = await this.runner.tryRun(INSTANCE_PROPERTIES_SQL);
        if (properties.errorMessage) {
            return { errorMessage: properties.errorMessage };
        }

        // Exige VIEW SERVER STATE. Si falla, se pierden CPU, memoria física y arranque, no el resto.
        const runtime = await this.runner.tryRun(INSTANCE_RUNTIME_SQL);
        const data = mapInstanceProperties(properties.result, runtime.result);

        return data
            ? { data }
            : { errorMessage: "El servidor no devolvió las propiedades de la instancia." };
    }

    /** Sesiones activas de usuario. */
    public async loadActiveSessions(): Promise<SectionResult<ActiveSession[]>> {
        const outcome = await this.runner.tryRun(ACTIVE_SESSIONS_SQL);
        return outcome.errorMessage
            ? { errorMessage: outcome.errorMessage }
            : { data: mapActiveSessions(outcome.result) };
    }
}
