/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";
import { ActiveSession, KillPermissions, SessionSnapshot } from "../types";
import { toRows } from "../rows";

/**
 * Permisos de la conexión actual para terminar sesiones.
 *
 * `HAS_PERMS_BY_NAME(NULL, NULL, 'ALTER ANY CONNECTION')` ya devuelve 1 para quien pertenece a
 * `sysadmin` o a `processadmin`, así que por sí sola bastaría. Los roles se leen aparte para poder
 * explicar **de dónde** sale el permiso, que es lo que el usuario quiere saber antes de pulsar.
 */
export const KILL_PERMISSIONS_SQL = `
SELECT @@SPID                                                                  AS current_session_id,
       ISNULL(SUSER_SNAME(), N'')                                              AS login_name,
       CONVERT(int, ISNULL(IS_SRVROLEMEMBER('sysadmin'), 0))                   AS is_sysadmin,
       CONVERT(int, ISNULL(IS_SRVROLEMEMBER('processadmin'), 0))               AS is_processadmin,
       CONVERT(int, ISNULL(HAS_PERMS_BY_NAME(NULL, NULL, 'ALTER ANY CONNECTION'), 0))
                                                                               AS has_alter_any_connection;
`;

/** Mapea el resultado a `KillPermissions`. Función pura. */
export function mapKillPermissions(
    result: SimpleExecuteResult | undefined,
): KillPermissions | undefined {
    const rows = toRows(result);
    if (rows.length === 0) {
        return undefined;
    }
    const row = rows[0];
    return {
        currentSessionId: row.number("current_session_id"),
        loginName: row.text("login_name"),
        isSysadmin: row.boolean("is_sysadmin"),
        isProcessAdmin: row.boolean("is_processadmin"),
        hasAlterAnyConnection: row.boolean("has_alter_any_connection"),
    };
}

/** `true` si la conexión actual puede terminar sesiones ajenas. */
export function canKillSessions(permissions: KillPermissions | undefined): boolean {
    if (!permissions) {
        return false;
    }
    return (
        permissions.isSysadmin || permissions.isProcessAdmin || permissions.hasAlterAnyConnection
    );
}

/**
 * Valida un identificador de sesión antes de que entre en una sentencia.
 *
 * Es el primer sitio del fork donde algo de fuera se concatena en T-SQL: `KILL` y las vistas de
 * dinámicas no aceptan parámetros. La regla 11.2 del brief se cumple aquí **validando y
 * abortando**, nunca escapando a mano: un identificador de sesión es un entero positivo, y
 * cualquier otra cosa es un error de programación o un intento de inyección.
 *
 * @throws Si `sessionId` no es un entero positivo.
 */
function assertSessionId(sessionId: number): number {
    if (typeof sessionId !== "number" || !Number.isSafeInteger(sessionId) || sessionId <= 0) {
        throw new Error(`Identificador de sesión no válido: ${String(sessionId)}`);
    }
    return sessionId;
}

/**
 * Construye la sentencia `KILL`.
 *
 * Va suelta, sin `BEGIN TRANSACTION`, y eso es obligatorio, no una decisión: SQL Server la rechaza
 * dentro de una transacción de usuario con el error 6115, «KILL command cannot be used inside user
 * transactions». Es uno de los casos que el §11.6 del brief prevé, y por eso la vista previa la
 * marca como irreversible.
 *
 * @throws Si `sessionId` no es un entero positivo.
 */
export function buildKillStatement(sessionId: number): string {
    return `KILL ${assertSessionId(sessionId)};`;
}

/**
 * Consulta que vuelve a leer la identidad de una sesión concreta.
 *
 * @throws Si `sessionId` no es un entero positivo.
 */
export function buildSessionSnapshotStatement(sessionId: number): string {
    return `
SELECT s.session_id,
       ISNULL(s.login_name, N'')                 AS login_name,
       ISNULL(s.host_name, N'')                  AS host_name,
       ISNULL(s.program_name, N'')               AS program_name,
       CONVERT(varchar(33), s.login_time, 126)   AS login_time
FROM sys.dm_exec_sessions AS s
WHERE s.session_id = ${assertSessionId(sessionId)};
`;
}

/** Mapea el resultado de `buildSessionSnapshotStatement`. Función pura. */
export function mapSessionSnapshot(
    result: SimpleExecuteResult | undefined,
): SessionSnapshot | undefined {
    const rows = toRows(result);
    if (rows.length === 0) {
        return undefined;
    }
    const row = rows[0];
    return {
        sessionId: row.number("session_id"),
        loginName: row.text("login_name"),
        hostName: row.text("host_name"),
        programName: row.text("program_name"),
        loginTime: row.text("login_time"),
    };
}

/**
 * `true` si la sesión que hay ahora en el servidor es la misma que el usuario está mirando.
 *
 * El momento de inicio de sesión es el que descarta una reutilización del identificador; el login y
 * el equipo se comparan además porque una reutilización casi siempre viene de otro cliente.
 * Función pura.
 */
export function isSameSession(snapshot: SessionSnapshot, session: ActiveSession): boolean {
    return (
        snapshot.sessionId === session.sessionId &&
        snapshot.loginTime === session.loginTime &&
        snapshot.loginName === session.loginName &&
        snapshot.hostName === session.hostName
    );
}
