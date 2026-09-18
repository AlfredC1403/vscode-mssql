/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { sendActionEvent, sendErrorEvent } from "extension-toolkit/vscode";
import {
    disableTelemetry,
    isTelemetryTransportActive,
} from "../../../src/custom/overrides/telemetry";
import { diag } from "../../../src/diagnostics/diagnosticsCore";
import { Perf } from "../../../src/perf/perfTelemetry";

/**
 * Cadena de conexión con la forma que espera Application Insights. Si el respaldo por variable
 * de entorno siguiera activo, el reporter se construiría con transporte y el test fallaría.
 */
const PLAUSIBLE_CONNECTION_STRING =
    "InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=https://example.invalid/";

const APP_INSIGHTS_ENV_VAR = "MSSQL_APP_INSIGHTS_KEY";

suite("Fork: telemetría desactivada", () => {
    let previousEnvValue: string | undefined;

    setup(() => {
        previousEnvValue = process.env[APP_INSIGHTS_ENV_VAR];
    });

    teardown(() => {
        if (previousEnvValue === undefined) {
            delete process.env[APP_INSIGHTS_ENV_VAR];
        } else {
            process.env[APP_INSIGHTS_ENV_VAR] = previousEnvValue;
        }
        // Deja el reporter en el mismo estado inerte en el que lo encuentra el resto de la suite.
        disableTelemetry();
    });

    test("deja el reporter activo sin transporte", () => {
        expect(disableTelemetry()).to.equal(true);
        expect(isTelemetryTransportActive()).to.equal(false);
    });

    test("cierra el respaldo por variable de entorno", () => {
        process.env[APP_INSIGHTS_ENV_VAR] = PLAUSIBLE_CONNECTION_STRING;

        expect(disableTelemetry()).to.equal(true);

        expect(process.env[APP_INSIGHTS_ENV_VAR]).to.equal(undefined);
        expect(isTelemetryTransportActive()).to.equal(false);
    });

    test("sigue sin transporte aunque se vuelva a llamar", () => {
        disableTelemetry();
        process.env[APP_INSIGHTS_ENV_VAR] = PLAUSIBLE_CONNECTION_STRING;
        disableTelemetry();

        expect(isTelemetryTransportActive()).to.equal(false);
    });

    test("los envíos del upstream pasan a ser operaciones nulas", () => {
        disableTelemetry();

        // Las dos vías que comparten este reporter: los eventos de la extensión y los del SQL
        // Tools Service que `serviceclient.ts` reenvía. `Perf` NO va por aquí; ver el suite de
        // abajo.
        expect(() => sendActionEvent("QueryEditor" as never, "Test" as never)).to.not.throw();
        expect(() =>
            sendErrorEvent("QueryEditor" as never, "Test" as never, {
                error: new Error("prueba"),
            }),
        ).to.not.throw();
    });
});

/**
 * El tercer canal: `Perf`.
 *
 * Hasta M9, FORK.md y el comentario de `overrides/telemetry.ts` decían que los marcadores de
 * rendimiento salían por el mismo `telemetryReporter`, y por tanto que `disableTelemetry()` los
 * cortaba. **Es falso**: `Perf.marker` acaba en `diag.emit`, que solo sale del proceso si hay un
 * sink registrado, y el único del árbol (`PerfModeSink`) manda por `http.request`, no por el
 * reporter.
 *
 * Lo que de verdad lo contiene es su puerta de variables de entorno. Eso es lo que fija este test:
 * si alguien registrara un sink por omisión, abriría una salida de red que nadie relacionaría con
 * la telemetría, porque la documentación decía que ese camino ya estaba cortado.
 */
suite("Fork: Perf es un canal aparte, y está cerrado", () => {
    test("sin PERF_MODE no hay ningún sink registrado", () => {
        expect(process.env.PERF_MODE).to.not.equal("1");
        expect(Perf.enabled).to.equal(false);
        expect(diag.anySinkActive).to.equal(false);
        expect(diag.hasSink("perfMode")).to.equal(false);
    });

    test("`disableTelemetry` no interviene en este camino", () => {
        // Se afirma explícitamente para que nadie vuelva a escribir que sí lo hace: antes y
        // después de cortar la telemetría, el estado de los sinks es el mismo.
        const before = diag.anySinkActive;
        disableTelemetry();
        expect(diag.anySinkActive).to.equal(before);
    });
});
