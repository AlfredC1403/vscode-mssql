/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { AdminQueryRunner } from "./sql/execute";
import { WriteGate } from "./sql/writeGate";
import { ExecutionPlan, PlanOutcome } from "./sql/ddl/plan";
import {
    ChangeSetResult,
    PendingChange,
    PendingChangeStatus,
} from "../sharedInterfaces/pendingChanges";

/**
 * Ejecuta un conjunto de cambios, y nada más.
 *
 * No pregunta, no confirma y no muestra: eso es del controlador, igual que en
 * `sessionAdminService.ts`. La ejecución sale por `WriteGate`, que es la única puerta de escritura
 * del fork, así que este archivo solo traduce entre el plan y lo que el panel pinta.
 *
 * **Nunca lanza.**
 */
export class ChangeSetService {
    private readonly gate: WriteGate;

    constructor(runner: AdminQueryRunner) {
        this.gate = new WriteGate(runner);
    }

    /** Ejecuta el lote transaccional y traduce el resultado. */
    public async apply(
        plan: ExecutionPlan,
        changes: PendingChange[],
        secrets: readonly string[] = [],
    ): Promise<ChangeSetResult> {
        // Las contraseñas **pasan de largo**: llegan del controlador, se entregan al ejecutor y no se
        // guardan en ningún campo de este servicio (regla 11.3 del brief).
        const outcome = await this.gate.runPlan(plan, secrets);
        return toResult(outcome, changes);
    }
}

/**
 * Traduce el resultado del lote al estado por cambio.
 *
 * La regla es la del todo o nada: si el lote se revirtió, **ningún** cambio quedó aplicado, no solo
 * el que falló. Es lo que hace que el panel pueda decir la verdad con una sola lectura. Función
 * pura, exportada para poder probarla sin servidor.
 */
export function toResult(outcome: PlanOutcome, changes: PendingChange[]): ChangeSetResult {
    const status: PendingChangeStatus =
        outcome.kind === "applied"
            ? "applied"
            : outcome.kind === "rolledBack"
              ? "rolledBack"
              : "unknown";

    const statuses = changes.map((change, index) => ({
        id: change.id,
        // El paso que falló se marca aparte: es la información que explica el resto.
        status:
            outcome.kind === "rolledBack" && outcome.failedStep === index + 1
                ? ("failed" as PendingChangeStatus)
                : status,
    }));

    return {
        outcome:
            outcome.kind === "inheritedTransaction"
                ? "inheritedTransaction"
                : outcome.kind === "applied"
                  ? "applied"
                  : outcome.kind === "rolledBack"
                    ? "rolledBack"
                    : "unknown",
        failedLabel: outcome.failedLabel,
        errorNumber: outcome.errorNumber,
        errorMessage: outcome.errorMessage,
        statuses,
        staleAfterApply: false,
    };
}
