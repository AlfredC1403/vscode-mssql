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
 * **Dos** de los emisores del upstream comparten un único `telemetryReporter` del
 * extension-toolkit, así que basta con dejar ese reporter sin transporte:
 *
 * 1. Eventos de la extensión: `sendActionEvent`, `sendErrorEvent`, `startActivity`.
 * 2. Eventos del SQL Tools Service: la notificación `telemetry/sqlevent` que
 *    `serviceclient.ts` reenvía con `sendActionEvent`.
 *
 * Cortar en el reporter y no evento a evento es lo que hace que esto siga valiendo cuando el
 * upstream añade emisores: los tres puntos de entrada leen el enlace de módulo en cada llamada.
 * Medido en el merge de M9, que trajo ~9.600 líneas nuevas con tres `sendActionEvent` más: todos
 * quedaron cortados sin tocar nada aquí (FORK.md §26).
 *
 * Hay dos formas de que llegue una clave de Application Insights, y cerramos las dos:
 *
 * - `package.json` → `aiKey`, que `scripts/inject-telemetry-key.mjs` inyecta en la build
 *   oficial de Microsoft. No lo pasamos.
 * - La variable de entorno de arriba, que el constructor del reporter consulta como respaldo.
 *   La borramos antes de reconstruirlo.
 *
 * **Cómo queda sin transporte, exactamente.** No es que `TelemetryReporter` lo deje en `undefined`
 * con buenos modales: `new VsCodeTelemetryReporter(undefined)` **lanza** un `TypeError` desde
 * `TelemetryUtil.shouldUseOneDataSystemSDK`, que hace `key.length` sobre `undefined`. Ese throw lo
 * traga el `try/catch` del extension-toolkit (`telemetryReporter.ts:152-157`) y `_telemetryReporter`
 * se queda sin asignar. De ahí que en la consola aparezcan estos dos avisos:
 *
 * ```
 * No telemetry connection string found; telemetry will not be sent.
 * Error initializing TelemetryReporter: ...
 * ```
 *
 * El segundo **no es ruido cosmético: es el corte**. Quien lo silencie pasando una clave de relleno
 * para limpiar el log reconstruye el transporte y vuelve a enviar telemetría. Lo fija
 * `test/unit/custom/telemetryOverride.test.ts`.
 *
 * ## Lo que esto NO cubre: `Perf`
 *
 * Los marcadores de rendimiento (`src/perf/perfTelemetry.ts`) son un **tercer canal, independiente
 * del reporter**: `Perf.marker` acaba en `diag.emit`, y de ahí solo sale si hay un sink registrado.
 * El único del árbol es `PerfModeSink` (`src/diagnostics/sinks.ts`), que manda por `http.request`.
 * `disableTelemetry()` no lo toca ni puede tocarlo.
 *
 * Lo que lo contiene es su propia puerta: el sink solo se registra con `PERF_MODE=1` **más**
 * `PERF_MARKER_URL` y `PERF_CONTROL_TOKEN` (`perfTelemetry.ts:131-145`). Es el arnés local de
 * `tools/perftest`, no un canal hacia el exterior, y sin esas variables no se registra ningún sink.
 * Hasta M9, FORK.md y este comentario decían que `Perf` pasaba por el mismo reporter, que es falso
 * y además peligroso: daba por cortado un camino que nadie estaba cortando (FORK.md §26.6).
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
