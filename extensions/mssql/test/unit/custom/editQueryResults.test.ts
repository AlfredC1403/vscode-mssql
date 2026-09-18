/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { singleSourceTable } from "../../../src/custom/results/editQueryResults";

/**
 * De qué tabla salen unos resultados (FORK.md §33).
 *
 * Es la decisión que abre o no el editor, y la que más fácil se equivoca en silencio: pasarse de
 * estricta deja fuera consultas perfectamente editables, y quedarse corta abre un editor que el
 * servidor rechaza con un error en inglés.
 */

suite("Fork: de qué tabla salen unos resultados", () => {
    test("todas las columnas de la misma tabla: se puede editar", () => {
        const source = singleSourceTable([
            { schema: "dbo", table: "Cliente" },
            { schema: "dbo", table: "Cliente" },
        ]);

        expect(source).to.deep.equal({ kind: "one", schema: "dbo", table: "Cliente" });
    });

    test("las columnas sin tabla no cuentan", () => {
        // `SELECT id, GETDATE() AS ahora FROM cliente` es editable: la calculada no sale de ninguna
        // tabla y el servidor la devuelve con source_table vacío.
        const source = singleSourceTable([
            { schema: "dbo", table: "Cliente" },
            { schema: "", table: "" },
        ]);

        expect(source).to.deep.equal({ kind: "one", schema: "dbo", table: "Cliente" });
    });

    test("dos tablas: no se abre nada, y se dicen cuáles", () => {
        const source = singleSourceTable([
            { schema: "dbo", table: "Pedido" },
            { schema: "dbo", table: "Cliente" },
        ]);

        expect(source.kind).to.equal("several");
        expect(source.kind === "several" && source.tables).to.have.members([
            "dbo.Pedido",
            "dbo.Cliente",
        ]);
    });

    test("el mismo nombre en dos esquemas son dos tablas", () => {
        const source = singleSourceTable([
            { schema: "dbo", table: "Cliente" },
            { schema: "ventas", table: "Cliente" },
        ]);

        expect(source.kind).to.equal("several");
    });

    test("da igual cómo venga escrita la mayúscula: es la misma tabla", () => {
        // SQL Server suele ser insensible a mayúsculas en los nombres, y el servidor puede
        // devolverlos con la caja del catálogo aunque la consulta los escribiera de otro modo.
        const source = singleSourceTable([
            { schema: "dbo", table: "Cliente" },
            { schema: "DBO", table: "CLIENTE" },
        ]);

        expect(source.kind).to.equal("one");
    });

    test("ninguna columna sale de una tabla: no hay nada que editar", () => {
        // `SELECT COUNT(*) FROM cliente`, o `SELECT 1`.
        expect(singleSourceTable([{ schema: "", table: "" }])).to.deep.equal({ kind: "none" });
        expect(singleSourceTable([])).to.deep.equal({ kind: "none" });
    });
});
