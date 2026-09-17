/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { sendActionEvent, sendErrorEvent } from "extension-toolkit/vscode";
import {
    disableTelemetry,
    isTelemetryTransportActive,
} from "../../../src/custom/overrides/telemetry";

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

        // Las tres vías del upstream comparten este reporter: eventos de la extensión, los
        // eventos del SQL Tools Service que serviceclient.ts reenvía, y los marcadores de Perf.
        expect(() => sendActionEvent("QueryEditor" as never, "Test" as never)).to.not.throw();
        expect(() =>
            sendErrorEvent("QueryEditor" as never, "Test" as never, {
                error: new Error("prueba"),
            }),
        ).to.not.throw();
    });
});
