/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";

import { ExecutionPlan, PlanOutcome, PlannedStatement, validatePlan } from "./ddl/plan";
import { quoteIdentifier } from "../../util/identifiers";
import { Row, toRows } from "./rows";

/**
 * **La única puerta de escritura del fork.** Todo lo que no es un `SELECT` sale por aquí.
 *
 * Construye el lote y lo interpreta. No pregunta, no confirma y no muestra nada: eso es del
 * controlador, igual que en `sessionAdminService.ts`. Y **nunca lanza**: devuelve el resultado. Un
 * `throw` desde un reducer acaba en el registro de la extensión
 * (`webviewBaseController.ts:432-441` hace `logger.error(...getErrorMessage(error))`), y ahí no
 * pueden acabar ni el texto del lote ni un mensaje del motor sin sanear (regla 11.3 del brief).
 *
 * No importa `vscode`.
 *
 * ## Por qué el lote tiene esta forma exacta
 *
 * Todo lo que sigue está medido contra SQL Server 2022 (16.0.4295.3) y anotado en FORK.md §22:
 *
 * 1. **Un solo lote, en una sola llamada.** El estado transaccional no sobrevive entre llamadas de
 *    `query/simpleexecute`: `BEGIN TRANSACTION` en una llamada y `@@TRANCOUNT` en la siguiente da 0.
 *    Y dentro del lote no puede haber `GO`: `query/simpleexecute` ejecuta lo que hay detrás pero
 *    **se come los errores** de los lotes siguientes, así que un fallo volvería como éxito.
 * 2. **`SET XACT_ABORT ON` no es decorativo.** Con `OFF`, un error de los que el motor rechaza dentro
 *    de una transacción (el 226) **no aborta el lote**: la ejecución sigue y la transacción queda
 *    abierta y sana. Sobre la conexión que el panel comparte con el editor del usuario eso es una
 *    transacción huérfana reteniendo bloqueos hasta que alguien desconecte.
 * 3. **El `CATCH` solo revierte, nunca confirma.** Con `XACT_ABORT ON`, el error deja la transacción
 *    condenada (`XACT_STATE() = -1`) y un `COMMIT` falla con el 3930.
 * 4. **Cada sentencia va por `EXEC [base].sys.sp_executesql`.** Resuelve tres problemas de una vez:
 *    los `GRANT` de ámbito de servidor exigen que la base actual sea `master` (si no, error 4621);
 *    el DDL de base exige estar en la base destino, y ahí el nombre de tres partes no sirve; y
 *    `CREATE SCHEMA`, que tiene que ser la primera sentencia de su lote, deja de ser un problema
 *    porque `sp_executesql` es su propio lote. Comprobado además que `DB_NAME()` sigue siendo la
 *    base original al volver: el cambio de contexto dura solo la llamada, y el `ROLLBACK` del
 *    llamante alcanza lo que se hizo dentro.
 * 5. **La guarda de transacción heredada.** Si la conexión ya trae una transacción abierta, el lote
 *    no abre la suya ni ejecuta nada: confirmar o revertir la transacción de otro no es cosa nuestra.
 * 6. **Un solo `SELECT` de informe**, al final y en la etiqueta, para que `query/simpleexecute`
 *    devuelva siempre un conjunto de resultados con la misma forma.
 */

/** Cómo llama el ejecutor al servidor. Lo implementa `AdminQueryRunner`. */
export interface GateRunner {
    tryRun(queryString: string): Promise<{ result?: SimpleExecuteResult; errorMessage?: string }>;
}

/** Números de error que el ejecutor sabe explicar. */
export const GATE_ERRORS = {
    /** `CREATE DATABASE` / `ALTER DATABASE ... SET` dentro de una transacción. */
    ddlNotAllowedInTransaction: 226,
    /** `DROP DATABASE` dentro de una transacción. Número **distinto** del 226. */
    dropDatabaseInTransaction: 574,
    /** `COMMIT` de una transacción condenada. */
    doomedTransaction: 3930,
    /** `GRANT` de ámbito de servidor sin estar en `master`. */
    serverScopeNeedsMaster: 4621,
    /** `KILL` dentro de una transacción. */
    killInTransaction: 6115,
    /** Sintaxis: incluye `CREATE SCHEMA` mal colocada (Msg 156) y el 102 general. */
    syntax: 102,
    syntaxNearKeyword: 156,
    /** Fallo de un `ALTER ROLE ... ADD MEMBER` cuando el principal no existe. */
    principalNotFound: 15151,
} as const;

/** Resultado de ejecutar una sentencia suelta e irreversible. */
export interface StandaloneOutcome {
    applied: boolean;
    errorNumber: number;
    errorMessage: string;
}

export class WriteGate {
    constructor(private readonly runner: GateRunner) {}

    /**
     * Ejecuta el lote transaccional de un plan.
     *
     * Devuelve siempre un resultado interpretado. `kind: "unknown"` significa que no se sabe qué
     * quedó hecho, y el panel tiene que releer: es el único caso en el que no se puede afirmar nada.
     */
    public async runPlan(plan: ExecutionPlan): Promise<PlanOutcome> {
        const problem = validatePlan(plan);
        if (problem) {
            return failure("unknown", problem);
        }
        if (plan.irreversible.length > 0) {
            return failure(
                "unknown",
                "Este plan tiene sentencias irreversibles: se ejecutan de una en una.",
            );
        }

        // Segunda barrera: `validatePlan` ya comprobó todo lo que el lote necesita, pero construir
        // el texto valida otra vez el nombre de la base y podría lanzar. Un `throw` desde aquí
        // acabaría en el registro de la extensión, y ahí no puede acabar el texto de un lote.
        let batch: string;
        try {
            batch = buildTransactionalBatch(plan.statements);
        } catch {
            return failure("unknown", "El plan no se pudo construir, así que no se ejecutó nada.");
        }

        const outcome = await this.runner.tryRun(batch);
        if (outcome.errorMessage) {
            // Un fallo de transporte o un error que el lote no pudo capturar. La transacción no
            // pudo confirmar sin que el informe lo dijera, pero afirmarlo sería inventar.
            return failure("unknown", outcome.errorMessage);
        }
        return parseReport(outcome.result, plan.statements);
    }

    /**
     * Ejecuta una sentencia que SQL Server no permite dentro de una transacción: suelta, sin
     * envoltorio y sin vuelta atrás.
     *
     * El único caso entregado hoy es `KILL`. La vista previa la marca como irreversible antes de
     * llegar aquí.
     */
    public async runStandalone(statement: PlannedStatement): Promise<StandaloneOutcome> {
        const outcome = await this.runner.tryRun(`${statement.sql};`);
        return outcome.errorMessage
            ? { applied: false, errorNumber: 0, errorMessage: outcome.errorMessage }
            : { applied: true, errorNumber: 0, errorMessage: "" };
    }
}

/** Resultado de fallo, sin paso ni número: no se llegó a ejecutar nada identificable. */
function failure(kind: PlanOutcome["kind"], message: string): PlanOutcome {
    return {
        kind,
        failedStep: 0,
        failedLabel: "",
        errorNumber: 0,
        errorMessage: message,
        remainingTransactions: 0,
    };
}

/**
 * Escapa un texto que va **como dato** dentro de un literal `N'...'`: una etiqueta para mostrar.
 *
 * Aquí sí se dobla la comilla, y no contradice la regla 11.2: esto es una cadena de presentación,
 * no código. Las **sentencias** no pasan por aquí; si una llevara una comilla, `validateStatement`
 * la rechaza antes, porque ahí la regla manda abortar.
 */
function literal(text: string): string {
    return text.replace(/'/g, "''");
}

/**
 * Construye el lote transaccional completo.
 *
 * Exportada para que los tests puedan leer el texto exacto, y para que la vista previa pueda
 * mostrarlo junto al script legible: la regla 11.1 se cumple mostrando **lo que se envía**.
 */
export function buildTransactionalBatch(statements: PlannedStatement[]): string {
    const steps = statements.map((statement, index) => {
        const step = index + 1;
        const database = quoteIdentifier(statement.database, "nombre de base de datos");
        const lines = [`    SET @paso = ${step}; SET @etiqueta = N'${literal(statement.label)}';`];
        if (statement.precondition) {
            // La precondición va DENTRO de la transacción: así la comprobación y la escritura
            // confirman o se revierten juntas, y no hay ventana entre comprobar y escribir.
            lines.push(
                `    IF NOT (${statement.precondition.check})`,
                `        THROW ${statement.precondition.errorNumber}, N'${literal(
                    statement.precondition.message,
                )}', 1;`,
            );
        }
        lines.push(`    EXEC ${database}.sys.sp_executesql N'${statement.sql}';`);
        return lines.join("\n");
    });

    return `SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @paso int = 0;
DECLARE @etiqueta nvarchar(400) = N'';
DECLARE @resultado nvarchar(30) = N'aplicado';
DECLARE @numero int = 0;
DECLARE @mensaje nvarchar(2048) = N'';

IF @@TRANCOUNT > 0
BEGIN
    SET @resultado = N'transaccion_heredada';
    GOTO informe;
END

BEGIN TRY
    BEGIN TRANSACTION;

${steps.join("\n\n")}

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    SET @resultado = N'revertido';
    SET @numero = ERROR_NUMBER();
    SET @mensaje = ERROR_MESSAGE();
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
END CATCH

IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

informe:
SELECT @resultado AS resultado,
       @paso       AS paso,
       @etiqueta   AS etiqueta,
       @numero     AS numero,
       @mensaje    AS mensaje,
       @@TRANCOUNT AS trancount_final;`;
}

/** Interpreta el informe del lote. Función pura. */
export function parseReport(
    result: SimpleExecuteResult | undefined,
    statements: PlannedStatement[],
): PlanOutcome {
    const rows = toRows(result);
    if (rows.length === 0) {
        return failure(
            "unknown",
            "El servidor no devolvió el informe del lote, así que no se sabe qué quedó aplicado.",
        );
    }

    const row: Row = rows[0];
    let kind: PlanOutcome["kind"];
    try {
        kind = toKind(row.text("resultado"));
    } catch {
        return failure("unknown", "El informe del lote no tenía la forma esperada.");
    }

    const failedStep = kind === "rolledBack" ? row.number("paso") : 0;
    const label =
        failedStep > 0 && failedStep <= statements.length
            ? statements[failedStep - 1].label
            : (row.optionalText("etiqueta") ?? "");

    return {
        kind,
        failedStep,
        failedLabel: kind === "rolledBack" ? label : "",
        errorNumber: row.number("numero"),
        errorMessage: row.optionalText("mensaje") ?? "",
        remainingTransactions: row.number("trancount_final"),
    };
}

function toKind(reported: string): PlanOutcome["kind"] {
    switch (reported.trim()) {
        case "aplicado":
            return "applied";
        case "revertido":
            return "rolledBack";
        case "transaccion_heredada":
            return "inheritedTransaction";
        default:
            throw new Error("resultado desconocido");
    }
}
