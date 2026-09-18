/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import {
    describeResultColumnsQuery,
    foreignKeyForColumnQuery,
    referencedRowQuery,
    stringLiteral,
} from "../../../src/custom/results/foreignKeyLookup";
import { splitBatches } from "../../../src/custom/results/referencedRow";

/**
 * El registro al que apunta una clave ajena (FORK.md §31).
 *
 * Lo que se fija aquí es **el texto que se manda al servidor**, que es donde está el riesgo: los
 * nombres de objeto van pegados a la sentencia porque no se pueden parametrizar, y el valor de la
 * celda es texto de un usuario. Las dos cosas tienen reglas distintas y las dos se comprueban.
 */

suite("Fork: literales del registro referenciado", () => {
    test("una comilla simple se dobla, que es el único escape que hay en T-SQL", () => {
        expect(stringLiteral("O'Brien")).to.equal("N'O''Brien'");
    });

    test("un intento de salirse de las comillas se queda dentro", () => {
        // Lo clásico: cerrar la cadena y colar una sentencia. Al doblarse la comilla, todo el
        // texto sigue siendo un literal y el servidor nunca lo ve como sentencia.
        expect(stringLiteral("x'; DROP TABLE t; --")).to.equal("N'x''; DROP TABLE t; --'");
    });

    test("el texto sin comillas pasa tal cual", () => {
        expect(stringLiteral("2")).to.equal("N'2'");
        expect(stringLiteral("")).to.equal("N''");
    });
});

suite("Fork: consulta de la clave ajena de una columna", () => {
    test("los tres nombres van como literales, ya validados", () => {
        const sql = foreignKeyForColumnQuery("dbo", "DSHB_Widget", "NavigationId");

        expect(sql).to.contain("SCHEMA_NAME(parent.schema_id) = N'dbo'");
        expect(sql).to.contain("parent.name = N'DSHB_Widget'");
        expect(sql).to.contain("parentColumn.name = N'NavigationId'");
    });

    test("cuenta las columnas de la restricción, para detectar las compuestas", () => {
        expect(foreignKeyForColumnQuery("dbo", "T", "C")).to.contain("AS columnCount");
    });

    test("un nombre que no pasa la validación aborta, no se escapa a mano", () => {
        // Regla 11.2 del brief: lo que no encaja en el patrón no se intenta arreglar.
        expect(() => foreignKeyForColumnQuery("dbo", "T]; DROP TABLE x; --", "C")).to.throw();
    });
});

suite("Fork: consulta de la fila referenciada", () => {
    test("el valor entra como parámetro, no pegado al WHERE", () => {
        const sql = referencedRowQuery(
            { constraint: "FK", schema: "dbo", table: "Nav", column: "Id", columnCount: 1 },
            "2",
        );

        // La sentencia interior compara contra @valor; el valor solo aparece como argumento.
        expect(sql).to.contain("WHERE [Id] = @valor");
        expect(sql).to.contain("N'@valor nvarchar(4000)'");
        expect(sql).to.contain("@valor = N'2'");
    });

    test("TOP (2), para poder notar que la columna referenciada no era única", () => {
        const sql = referencedRowQuery(
            { constraint: "FK", schema: "dbo", table: "Nav", column: "Id", columnCount: 1 },
            "2",
        );

        expect(sql).to.contain("SELECT TOP (2) *");
    });

    test("los identificadores van entre corchetes y validados", () => {
        const sql = referencedRowQuery(
            { constraint: "FK", schema: "ventas", table: "Cliente", column: "id", columnCount: 1 },
            "7",
        );

        expect(sql).to.contain("FROM [ventas].[Cliente]");
        expect(() =>
            referencedRowQuery(
                { constraint: "FK", schema: "dbo", table: "N]x", column: "Id", columnCount: 1 },
                "2",
            ),
        ).to.throw();
    });

    test("un valor desmesurado se rechaza antes de construir nada", () => {
        expect(() =>
            referencedRowQuery(
                { constraint: "FK", schema: "dbo", table: "Nav", column: "Id", columnCount: 1 },
                "x".repeat(4001),
            ),
        ).to.throw();
    });
});

suite("Fork: de qué tabla sale la columna", () => {
    test("la consulta pide la información de exploración, que es la que trae la tabla", () => {
        const sql = describeResultColumnsQuery("SELECT * FROM dbo.T;");

        expect(sql).to.contain("sys.dm_exec_describe_first_result_set");
        expect(sql).to.contain("source_table AS sourceTable");
        // El tercer argumento a 1 es lo que hace que vengan source_schema/source_table.
        expect(sql).to.contain(", NULL, 1)");
    });

    test("el texto de la consulta viaja escapado", () => {
        expect(describeResultColumnsQuery("SELECT 'a''b';")).to.contain("N'SELECT ''a''''b'';'");
    });
});

suite("Fork: lotes de un script", () => {
    test("parte por las líneas que solo dicen GO", () => {
        const batches = splitBatches("SELECT 1;\nGO\nSELECT 2;\nGO\nSELECT 3;");

        expect(batches.map((batch) => batch.trim())).to.deep.equal([
            "SELECT 1;",
            "SELECT 2;",
            "SELECT 3;",
        ]);
    });

    test("no parte por un GO que va dentro de una línea", () => {
        // `GO` solo separa lotes cuando está solo en su línea.
        expect(splitBatches("SELECT 'GO';")).to.have.lengthOf(1);
        expect(splitBatches("SELECT GOTO;")).to.have.lengthOf(1);
    });

    test("acepta el GO en minúsculas y con espacios alrededor", () => {
        expect(splitBatches("SELECT 1;\n   go   \nSELECT 2;")).to.have.lengthOf(2);
    });

    test("un script sin GO es un solo lote", () => {
        expect(splitBatches("SELECT 1;")).to.deep.equal(["SELECT 1;"]);
    });
});
