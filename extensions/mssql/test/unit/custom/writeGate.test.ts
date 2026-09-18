/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SimpleExecuteResult } from "vscode-mssql";

import {
    GATE_ERRORS,
    WriteGate,
    buildTransactionalBatch,
    parseReport,
} from "../../../src/custom/admin/sql/writeGate";
import {
    ExecutionPlan,
    PlannedStatement,
    planStatementTexts,
    renderReadableScript,
    validatePlan,
    validateStatement,
} from "../../../src/custom/admin/sql/ddl/plan";

/**
 * La puerta de escritura es el único sitio del fork que ejecuta algo que no es un `SELECT`, así que
 * lo que se fija aquí no es la comodidad de la API: es la forma del lote, que es lo que hace que la
 * regla 11.6 del brief se cumpla de verdad.
 *
 * Cada propiedad que se comprueba corresponde a algo **medido** contra SQL Server 2022 y anotado en
 * FORK.md §22.
 */
function statement(overrides: Partial<PlannedStatement> = {}): PlannedStatement {
    return {
        label: "Conceder SELECT sobre el esquema ventas a analista",
        sql: "GRANT SELECT ON SCHEMA::[ventas] TO [analista]",
        database: "ParityDb",
        ...overrides,
    };
}

function plan(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
    return {
        id: "plan-1",
        title: "Aplicar 1 cambio",
        statements: [statement()],
        irreversible: [],
        production: false,
        ...overrides,
    };
}

function report(rows: (string | null)[][]): SimpleExecuteResult {
    const columns = ["resultado", "paso", "etiqueta", "numero", "mensaje", "trancount_final"];
    return {
        rowCount: rows.length,
        columnInfo: columns.map((columnName) => ({ columnName }) as never),
        rows: rows.map((row) =>
            row.map((value) => ({ displayValue: value ?? "NULL", isNull: value === null })),
        ),
    } as SimpleExecuteResult;
}

suite("Fork: forma del lote transaccional", () => {
    test("lleva XACT_ABORT ON y una sola transacción", () => {
        const batch = buildTransactionalBatch([statement(), statement({ database: "master" })]);

        // Con XACT_ABORT OFF un error 226 no aborta el lote y deja la transacción abierta sobre la
        // conexión que el panel comparte con el editor del usuario. Medido.
        expect(batch.match(/SET XACT_ABORT ON/g)).to.have.length(1);
        expect(batch.match(/BEGIN TRANSACTION/g)).to.have.length(1);
        expect(batch.match(/COMMIT TRANSACTION/g)).to.have.length(1);
    });

    test("el CATCH revierte y no confirma nunca", () => {
        const batch = buildTransactionalBatch([statement()]);
        const catchBlock = batch.slice(batch.indexOf("BEGIN CATCH"), batch.indexOf("END CATCH"));

        // Con la transacción condenada, un COMMIT falla con el error 3930.
        expect(catchBlock).to.contain("ROLLBACK TRANSACTION");
        expect(catchBlock).to.not.contain("COMMIT");
        expect(catchBlock).to.contain("XACT_STATE()");
    });

    test("tiene la guarda de transacción heredada y la salvaguarda final", () => {
        const batch = buildTransactionalBatch([statement()]);

        expect(batch).to.contain("IF @@TRANCOUNT > 0");
        expect(batch).to.contain("GOTO informe");
        expect(batch).to.contain("informe:");
        // Salvaguarda: si algo dejó una transacción abierta, no se devuelve la conexión así.
        expect(batch.match(/IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION/g)).to.have.length(1);
    });

    test("un solo SELECT de informe, con las seis columnas", () => {
        const batch = buildTransactionalBatch([statement()]);

        expect(batch.match(/SELECT @resultado/g)).to.have.length(1);
        for (const column of [
            "resultado",
            "paso",
            "etiqueta",
            "numero",
            "mensaje",
            "trancount_final",
        ]) {
            expect(batch, `falta la columna ${column}`).to.contain(`AS ${column}`);
        }
    });

    test("cada sentencia va por EXEC [base].sys.sp_executesql", () => {
        const batch = buildTransactionalBatch([
            statement({ database: "master", sql: "GRANT VIEW ANY DEFINITION TO [analista]" }),
            statement({ database: "ParityDb" }),
        ]);

        // Ámbito de servidor: sin master, error 4621. Ámbito de base: hay que estar en la base, y el
        // nombre de tres partes no sirve para DDL.
        expect(batch).to.contain("EXEC [master].sys.sp_executesql N'GRANT VIEW ANY DEFINITION");
        expect(batch).to.contain("EXEC [ParityDb].sys.sp_executesql N'GRANT SELECT ON SCHEMA");
    });

    test("no lleva GO ni USE", () => {
        const batch = buildTransactionalBatch([statement(), statement({ database: "master" })]);

        // `query/simpleexecute` ejecuta lo que hay tras un GO pero se come sus errores.
        expect(/\bGO\b/.test(batch), "el lote tiene que ser uno solo").to.equal(false);
        // El panel no cambia la base de la conexión que comparte con el editor (FORK.md §21.1).
        expect(/^\s*USE\b/m.test(batch)).to.equal(false);
    });

    test("numera los pasos sin huecos, para poder decir cuál falló", () => {
        const batch = buildTransactionalBatch([statement(), statement(), statement()]);

        expect(batch).to.contain("SET @paso = 1;");
        expect(batch).to.contain("SET @paso = 2;");
        expect(batch).to.contain("SET @paso = 3;");
        expect(batch).to.not.contain("SET @paso = 4;");
    });

    test("el nombre de la base se valida y se entrecomilla", () => {
        expect(() => buildTransactionalBatch([statement({ database: "Parity]Db" })])).to.throw(
            /no es válido/,
        );
        expect(() =>
            buildTransactionalBatch([statement({ database: "x; DROP DATABASE y" })]),
        ).to.throw(/no es válido/);
    });

    test("la precondición va dentro de la transacción, antes de su sentencia", () => {
        const batch = buildTransactionalBatch([
            statement({
                precondition: {
                    check: "EXISTS (SELECT 1 FROM sys.database_principals WHERE principal_id = 5)",
                    errorNumber: 50001,
                    message: "El usuario ya no es el mismo.",
                },
            }),
        ]);

        const transaction = batch.slice(
            batch.indexOf("BEGIN TRANSACTION"),
            batch.indexOf("COMMIT"),
        );
        expect(transaction).to.contain("IF NOT (EXISTS (SELECT 1 FROM sys.database_principals");
        expect(transaction).to.contain("THROW 50001");
        // Y antes de la sentencia que protege.
        expect(transaction.indexOf("THROW 50001")).to.be.lessThan(
            transaction.indexOf("sp_executesql"),
        );
    });

    test("la etiqueta se dobla como dato, no aborta", () => {
        // Una etiqueta es texto para mostrar, no código: aquí doblar la comilla es lo correcto.
        const batch = buildTransactionalBatch([statement({ label: "Quitar a O'Brien del rol" })]);

        expect(batch).to.contain("N'Quitar a O''Brien del rol'");
    });
});

suite("Fork: validación del plan", () => {
    test("un plan vacío no se ejecuta", () => {
        expect(validatePlan(plan({ statements: [] }))).to.match(/ninguna sentencia/);
    });

    test("no se mezclan reversibles con irreversibles", () => {
        // Si la irreversible va primero y luego falla el lote, el ROLLBACK no la alcanza.
        const mixed = plan({
            statements: [statement()],
            irreversible: [statement({ sql: "KILL 78", label: "Terminar la sesión 78" })],
        });

        expect(validatePlan(mixed)).to.match(/no puede mezclar/);
    });

    test("una sentencia con comilla simple se rechaza, no se escapa", () => {
        // Regla 11.2: validar y abortar. La profundidad de entrecomillado es siempre 2 y la fija la
        // plantilla; para que eso baste, ningún generador puede emitir una comilla.
        expect(validateStatement(statement({ sql: "ALTER USER [x] WITH NAME = 'y'" }))).to.match(
            /comilla simple/,
        );
    });

    test("se rechazan GO, USE, el punto y coma final y lo vacío", () => {
        expect(validateStatement(statement({ sql: "GRANT SELECT TO [x] GO" }))).to.match(/GO/);
        expect(validateStatement(statement({ sql: "USE [master]" }))).to.match(/USE/);
        expect(validateStatement(statement({ sql: "GRANT SELECT TO [x];" }))).to.match(
            /punto y coma/,
        );
        expect(validateStatement(statement({ sql: "   " }))).to.match(/vacía/);
    });

    test("un plan correcto no tiene queja", () => {
        expect(validatePlan(plan())).to.equal(undefined);
    });
});

suite("Fork: script legible y texto exacto", () => {
    test("las dos representaciones llevan las mismas sentencias", () => {
        // El hueco que esto cierra es mostrar una cosa y ejecutar otra.
        const target = plan({
            statements: [
                statement(),
                statement({
                    database: "master",
                    sql: "ALTER SERVER ROLE [dbcreator] ADD MEMBER [analista]",
                    label: "Añadir analista a dbcreator",
                }),
            ],
        });

        const readable = renderReadableScript(target);
        const exact = buildTransactionalBatch(target.statements);

        for (const sql of planStatementTexts(target)) {
            expect(readable, "falta en el script legible").to.contain(sql);
            expect(exact, "falta en el texto exacto").to.contain(sql);
        }
    });

    test("el script legible dice que es una transacción y qué se comprueba antes", () => {
        const readable = renderReadableScript(
            plan({
                statements: [
                    statement({
                        precondition: {
                            check: "1 = 1",
                            errorNumber: 50002,
                            message: "El permiso sigue concedido como estaba.",
                        },
                    }),
                ],
            }),
        );

        expect(readable).to.contain("SET XACT_ABORT ON;");
        expect(readable).to.contain("BEGIN TRANSACTION;");
        expect(readable).to.contain("COMMIT TRANSACTION;");
        expect(readable).to.contain("El permiso sigue concedido como estaba.");
    });

    test("las irreversibles salen marcadas como tales", () => {
        const readable = renderReadableScript(
            plan({
                statements: [],
                irreversible: [statement({ sql: "KILL 78", label: "Terminar la sesión 78" })],
            }),
        );

        expect(readable).to.contain("no permite estas sentencias dentro de una transacción");
        expect(readable).to.contain("irreversible");
        expect(readable).to.contain("KILL 78;");
    });
});

suite("Fork: interpretación del informe", () => {
    test("aplicado", () => {
        const outcome = parseReport(report([["aplicado", "0", "", "0", "", "0"]]), [statement()]);

        expect(outcome.kind).to.equal("applied");
        expect(outcome.failedStep).to.equal(0);
        expect(outcome.remainingTransactions).to.equal(0);
    });

    test("revertido, con el paso y el número del motor", () => {
        const statements = [statement(), statement({ label: "Segundo cambio" })];
        const outcome = parseReport(
            report([["revertido", "2", "Segundo cambio", "102", "Incorrect syntax", "0"]]),
            statements,
        );

        expect(outcome.kind).to.equal("rolledBack");
        expect(outcome.failedStep).to.equal(2);
        expect(outcome.failedLabel).to.equal("Segundo cambio");
        expect(outcome.errorNumber).to.equal(GATE_ERRORS.syntax);
    });

    test("transacción heredada: no se ejecutó nada", () => {
        const outcome = parseReport(report([["transaccion_heredada", "0", "", "0", "", "1"]]), [
            statement(),
        ]);

        expect(outcome.kind).to.equal("inheritedTransaction");
        expect(outcome.remainingTransactions).to.equal(1);
    });

    test("sin informe, no se afirma nada", () => {
        expect(parseReport(undefined, [statement()]).kind).to.equal("unknown");
        expect(parseReport(report([]), [statement()]).kind).to.equal("unknown");
        expect(parseReport(report([["otra_cosa", "0", "", "0", "", "0"]]), []).kind).to.equal(
            "unknown",
        );
    });
});

suite("Fork: la puerta no lanza nunca", () => {
    /** Runner que devuelve lo que se le diga, o falla como falla `tryRun`. */
    function runnerWith(
        outcome: { result?: SimpleExecuteResult; errorMessage?: string },
        sent: string[] = [],
    ) {
        return {
            sent,
            tryRun: async (queryString: string) => {
                sent.push(queryString);
                return outcome;
            },
        };
    }

    test("un plan inválido no llega al servidor", async () => {
        const runner = runnerWith({ result: report([["aplicado", "0", "", "0", "", "0"]]) });
        const gate = new WriteGate(runner);

        const outcome = await gate.runPlan(plan({ statements: [], irreversible: [] }));

        expect(outcome.kind).to.equal("unknown");
        expect(runner.sent, "no debería haber enviado nada").to.have.length(0);
    });

    test("un nombre de base inválido devuelve, no lanza", async () => {
        const runner = runnerWith({ result: report([["aplicado", "0", "", "0", "", "0"]]) });
        const gate = new WriteGate(runner);

        const outcome = await gate.runPlan(
            plan({ statements: [statement({ database: "mala]base" })] }),
        );

        expect(outcome.kind).to.equal("unknown");
        expect(runner.sent).to.have.length(0);
    });

    test("un fallo de transporte no se interpreta como revertido", async () => {
        const gate = new WriteGate(runnerWith({ errorMessage: "se cayó la conexión" }));

        const outcome = await gate.runPlan(plan());

        // No se puede afirmar que no se aplicó: hay que releer.
        expect(outcome.kind).to.equal("unknown");
        expect(outcome.errorMessage).to.contain("se cayó la conexión");
    });

    test("la vía suelta ejecuta la sentencia tal cual", async () => {
        const sent: string[] = [];
        const gate = new WriteGate(runnerWith({ result: report([]) }, sent));

        const outcome = await gate.runStandalone(
            statement({ sql: "KILL 78", label: "Terminar la sesión 78" }),
        );

        expect(outcome.applied).to.equal(true);
        expect(sent).to.deep.equal(["KILL 78;"]);
        // Sin transacción: el motor la rechaza con el error 6115.
        expect(sent[0]).to.not.contain("BEGIN TRANSACTION");
    });

    test("un plan con irreversibles no se ejecuta como lote", async () => {
        const sent: string[] = [];
        const gate = new WriteGate(runnerWith({ result: report([]) }, sent));

        const outcome = await gate.runPlan(
            plan({ statements: [], irreversible: [statement({ sql: "KILL 78" })] }),
        );

        expect(outcome.kind).to.equal("unknown");
        expect(sent).to.have.length(0);
    });
});
