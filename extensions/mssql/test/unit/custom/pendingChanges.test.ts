/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { pendingRowIds } from "../../../src/custom/webviews/TableExplorer/pendingChanges";

/**
 * Qué filas revierte el botón de descartar (FORK.md §32).
 *
 * Lo que se fija aquí es **el conjunto y el orden**, que es lo único de esta parte que se puede
 * equivocar en silencio: si falta una fila, queda un cambio sin descartar y la barra sigue
 * contándolo; si el orden es ascendente, revertir una fila nueva mueve las siguientes.
 */

suite("Fork: filas a revertir al descartar", () => {
    test("una fila con celdas editadas entra una sola vez, aunque se tocaran varias celdas", () => {
        expect(pendingRowIds([{ rowId: 3 }, { rowId: 3 }, { rowId: 5 }], [], [])).to.deep.equal([
            5, 3,
        ]);
    });

    test("entran también las marcadas para borrar y las recién creadas", () => {
        // Los tres orígenes son los mismos que suman en la cuenta de la barra.
        expect(pendingRowIds([{ rowId: 1 }], [2], [7])).to.deep.equal([7, 2, 1]);
    });

    test("una fila que está en dos orígenes se revierte una vez", () => {
        // Una fila nueva a la que además se le editó una celda: un solo revertido la quita entera.
        expect(pendingRowIds([{ rowId: 4 }], [], [4])).to.deep.equal([4]);
    });

    test("de mayor a menor, que es lo que deja quietos los identificadores que faltan", () => {
        expect(pendingRowIds([{ rowId: 2 }, { rowId: 11 }, { rowId: 7 }], [], [])).to.deep.equal([
            11, 7, 2,
        ]);
    });

    test("sin nada pendiente no hay nada que revertir", () => {
        expect(pendingRowIds([], [], [])).to.deep.equal([]);
    });

    test("acepta los conjuntos tal cual los lleva la rejilla", () => {
        // En la rejilla son un Map de cambios y dos Set; aquí se recorren como iterables.
        const cellChanges = new Map([
            ["9-0", { rowId: 9 }],
            ["9-1", { rowId: 9 }],
        ]);

        expect(pendingRowIds(cellChanges.values(), new Set([3]), new Set([12]))).to.deep.equal([
            12, 9, 3,
        ]);
    });
});
