/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { AdminQueryRunner } from "./sql/execute";
import {
    KILL_PERMISSIONS_SQL,
    buildKillStatement,
    buildSessionSnapshotStatement,
    mapKillPermissions,
    mapSessionSnapshot,
} from "./sql/queries/killSession";
import { KillPermissions, SessionSnapshot } from "./sql/types";

/** Resultado de leer los permisos de terminación. */
export interface PermissionsOutcome {
    permissions?: KillPermissions;
    errorMessage?: string;
}

/** Resultado de volver a leer una sesión por su identificador. */
export interface SnapshotOutcome {
    snapshot?: SessionSnapshot;
    errorMessage?: string;
}

/** Resultado de ejecutar el `KILL`. */
export interface KillOutcome {
    errorMessage?: string;
}

/**
 * **El único sitio del fork que ejecuta algo que no es un `SELECT`.**
 *
 * Esta clase no pregunta ni confirma nada: eso lo hace `AdminPanelController`, que es quien muestra
 * la sentencia y pide confirmación antes de llamar a `kill` (regla 11.1 del brief). Aquí solo está
 * la ejecución, aislada a propósito para que auditar «qué escribe el fork» sea leer un archivo.
 */
export class SessionAdminService {
    constructor(private readonly runner: AdminQueryRunner) {}

    /** Permisos de la conexión actual para terminar sesiones. */
    public async loadPermissions(): Promise<PermissionsOutcome> {
        const outcome = await this.runner.tryRun(KILL_PERMISSIONS_SQL);
        if (outcome.errorMessage) {
            return { errorMessage: outcome.errorMessage };
        }
        return { permissions: mapKillPermissions(outcome.result) };
    }

    /**
     * Vuelve a leer la identidad de una sesión. Devuelve `undefined` en `snapshot` cuando la sesión
     * ya no existe, que no es un error: puede haber terminado sola.
     */
    public async readSnapshot(sessionId: number): Promise<SnapshotOutcome> {
        const outcome = await this.runner.tryRun(buildSessionSnapshotStatement(sessionId));
        if (outcome.errorMessage) {
            return { errorMessage: outcome.errorMessage };
        }
        return { snapshot: mapSessionSnapshot(outcome.result) };
    }

    /**
     * Ejecuta `KILL`. **Solo se llama después de confirmar con el usuario.**
     *
     * Va suelta, sin transacción: SQL Server rechaza `KILL` dentro de una transacción de usuario
     * (error 6115). Ver `buildKillStatement`.
     */
    public async kill(sessionId: number): Promise<KillOutcome> {
        const outcome = await this.runner.tryRun(buildKillStatement(sessionId));
        return outcome.errorMessage ? { errorMessage: outcome.errorMessage } : {};
    }
}
