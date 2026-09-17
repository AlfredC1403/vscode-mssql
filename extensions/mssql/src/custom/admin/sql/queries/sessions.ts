/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";
import { ActiveSession } from "../types";
import { toRows } from "../rows";

/**
 * Sesiones activas (§8.5 del brief). Sobre la consulta del brief, con cinco cambios:
 *
 * - Se marca la sesión propia con `@@SPID`, para que el usuario vea que una de las filas es él.
 * - Se recorta `last_statement` a 4000 caracteres: un lote grande puede traer megas de texto por
 *   fila y no aporta nada en una rejilla.
 * - Se añaden CPU, lecturas lógicas y transacciones abiertas, que es lo que se mira para decidir
 *   si una sesión está haciendo daño.
 * - `OUTER APPLY` sobre `dm_exec_sql_text` puede fallar si el handle se invalidó entre lecturas;
 *   con `OUTER APPLY` la fila sigue saliendo con el texto en NULL, que es lo que se quiere.
 * - **Tiempo de la transacción abierta más antigua de cada sesión.** `open_transaction_count` dice
 *   cuántas hay, pero no desde cuándo, y para encontrar al que está bloqueando al resto lo que
 *   importa es el tiempo. Sale de `dm_tran_session_transactions` cruzada con
 *   `dm_tran_active_transactions`: una sesión puede tener varias transacciones abiertas a la vez,
 *   así que se toma la de comienzo más antiguo, que es la que lleva más tiempo bloqueando.
 *
 * El orden también cambia por eso: primero las de transacción más vieja, y solo después por última
 * petición. Quien abre el panel buscando un bloqueo lo encuentra en la primera fila.
 *
 * Exige `VIEW SERVER STATE`. Sin ese permiso el motor devuelve solo la sesión propia en lugar de
 * un error, así que el panel avisa cuando ve una sola fila y es la suya. Las dos vistas de
 * transacciones se comportan igual: filtran, no fallan.
 */
export const ACTIVE_SESSIONS_SQL = `
SELECT s.session_id,
       ISNULL(s.login_name, N'')                                  AS login_name,
       ISNULL(s.host_name, N'')                                   AS host_name,
       ISNULL(s.program_name, N'')                                AS program_name,
       ISNULL(s.status, N'')                                      AS status,
       ISNULL(DB_NAME(s.database_id), N'')                        AS database_name,
       CONVERT(varchar(33), s.login_time, 126)                    AS login_time,
       CONVERT(varchar(33), s.last_request_start_time, 126)        AS last_request_start_time,
       CONVERT(nvarchar(4000), ISNULL(t.text, N''))               AS last_statement,
       CASE WHEN s.session_id = @@SPID THEN 1 ELSE 0 END          AS is_current_session,
       ISNULL(s.cpu_time, 0)                                      AS cpu_time,
       ISNULL(s.logical_reads, 0)                                 AS logical_reads,
       ISNULL(s.open_transaction_count, 0)                        AS open_transaction_count,
       CONVERT(varchar(33), tx.oldest_transaction_start, 126)     AS oldest_transaction_start,
       ISNULL(DATEDIFF(second, tx.oldest_transaction_start, SYSDATETIME()), 0)
                                                                  AS longest_open_transaction_seconds
FROM sys.dm_exec_sessions AS s
LEFT JOIN sys.dm_exec_connections AS c
       ON c.session_id = s.session_id
OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) AS t
OUTER APPLY (
       SELECT MIN(tat.transaction_begin_time) AS oldest_transaction_start
       FROM sys.dm_tran_session_transactions AS tst
       JOIN sys.dm_tran_active_transactions AS tat
             ON tat.transaction_id = tst.transaction_id
       WHERE tst.session_id = s.session_id
) AS tx
WHERE s.is_user_process = 1
ORDER BY longest_open_transaction_seconds DESC, s.last_request_start_time DESC;
`;

/** Mapea el resultado a `ActiveSession[]`. Función pura. */
export function mapActiveSessions(result: SimpleExecuteResult | undefined): ActiveSession[] {
    return toRows(result).map((row) => ({
        sessionId: row.number("session_id"),
        loginName: row.text("login_name"),
        hostName: row.text("host_name"),
        programName: row.text("program_name"),
        status: row.text("status"),
        databaseName: row.text("database_name"),
        loginTime: row.text("login_time"),
        lastRequestStartTime: row.text("last_request_start_time"),
        // El texto del lote suele venir con saltos de línea y sangría delante.
        lastStatement: row.text("last_statement").trim(),
        isCurrentSession: row.boolean("is_current_session"),
        cpuTimeMs: row.number("cpu_time"),
        logicalReads: row.number("logical_reads"),
        openTransactionCount: row.number("open_transaction_count"),
        oldestTransactionStart: row.optionalText("oldest_transaction_start") ?? "",
        longestOpenTransactionSeconds: row.number("longest_open_transaction_seconds"),
    }));
}

/**
 * `true` cuando lo único que se ve es la propia sesión, que es el síntoma de no tener
 * `VIEW SERVER STATE`: el motor no da error, simplemente oculta las demás.
 */
export function looksLikeMissingViewServerState(sessions: ActiveSession[]): boolean {
    return sessions.length === 1 && sessions[0].isCurrentSession;
}
