/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { initializeTelemetryReporter, telemetryReporter } from "extension-toolkit/vscode";

/**
 * Nombre de la variable de entorno que el `TelemetryReporter` del extension-toolkit consulta
 * como respaldo cuando no recibe cadena de conexión. Es la segunda puerta de entrada de la
 * telemetría y hay que cerrarla explícitamente.
 *
 * Ver `packages/extension-toolkit/src/vscode/telemetry/telemetryReporter.ts`.
 */
const APP_INSIGHTS_ENV_VAR = "MSSQL_APP_INSIGHTS_KEY";

/**
 * Desactiva por completo la telemetría del fork.
 *
 * El upstream tiene tres emisores y **los tres comparten un único `telemetryReporter`** del
 * extension-toolkit, así que basta con dejar ese reporter sin transporte:
 *
 * 1. Eventos de la extensión: `sendActionEvent`, `sendErrorEvent`, `startActivity`.
 * 2. Eventos del SQL Tools Service: la notificación `telemetry/sqlevent` que
 *    `serviceclient.ts` reenvía con `sendActionEvent`.
 * 3. Marcadores de rendimiento: `Perf`, que acaba en el mismo reporter.
 *
 * Hay dos formas de que llegue una clave de Application Insights, y cerramos las dos:
 *
 * - `package.json` → `aiKey`, que `scripts/inject-telemetry-key.mjs` inyecta en la build
 *   oficial de Microsoft. No lo pasamos.
 * - La variable de entorno de arriba, que el constructor del reporter consulta como respaldo.
 *   La borramos antes de reconstruirlo.
 *
 * Sin clave, `TelemetryReporter` deja su transporte interno en `undefined` y todos los envíos
 * pasan a ser operaciones nulas (`this.reporter?.sendTelemetryEvent(...)`). En la consola
 * aparecen dos avisos del propio upstream que confirman el corte:
 *
 * ```
 * No telemetry connection string found; telemetry will not be sent.
 * Error initializing TelemetryReporter: ...
 * ```
 *
 * No queda ninguna vía de red abierta. El único `http.request` restante en el árbol es el sink
 * de `src/diagnostics/sinks.ts`, que requiere `PERF_MODE=1` más `PERF_MARKER_URL` y
 * `PERF_CONTROL_TOKEN`: es el arnés local de `tools/perftest`, no un canal hacia el exterior.
 *
 * @returns `true` si el reporter quedó sin transporte, que es lo que se espera siempre.
 */
export function disableTelemetry(): boolean {
    delete process.env[APP_INSIGHTS_ENV_VAR];
    initializeTelemetryReporter(undefined);
    return !isTelemetryTransportActive();
}

/**
 * Indica si el reporter activo tiene transporte, es decir, si podría enviar algo.
 *
 * Solo para verificación y tests: se apoya en el campo privado `_telemetryReporter` del
 * extension-toolkit, que no está expuesto en su API pública.
 */
export function isTelemetryTransportActive(): boolean {
    const internal = telemetryReporter as unknown as { _telemetryReporter?: unknown };
    return internal?._telemetryReporter !== undefined;
}
