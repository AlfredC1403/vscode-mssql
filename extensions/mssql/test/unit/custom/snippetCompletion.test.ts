/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { hasUnclosedQuote, isInsideLineComment } from "../../../src/custom/snippets/completion";

/**
 * Supresión de sugerencias dentro de cadenas y comentarios (M7).
 *
 * No hay analizador de SQL detrás —el §16 del brief lo prohíbe, y para esto no hace falta—: se mira
 * el texto de la línea hasta el cursor. El coste de equivocarse es una sugerencia de más o de
 * menos, nunca un error.
 */
suite("Fork: sugerencias dentro de un comentario", () => {
    test("detecta el comentario de línea", () => {
        expect(isInsideLineComment("SELECT 1 -- aquí ")).to.equal(true);
        expect(isInsideLineComment("-- ")).to.equal(true);
    });

    test("sin comentario, no lo detecta", () => {
        expect(isInsideLineComment("SELECT 1 FROM t WHERE x = ")).to.equal(false);
    });
});

suite("Fork: sugerencias dentro de un literal", () => {
    test("una comilla abierta cuenta como dentro", () => {
        expect(hasUnclosedQuote("WHERE nombre = '")).to.equal(true);
        expect(hasUnclosedQuote("WHERE nombre = 'abc")).to.equal(true);
    });

    test("una cerrada, fuera", () => {
        expect(hasUnclosedQuote("WHERE nombre = 'abc'")).to.equal(false);
        expect(hasUnclosedQuote("WHERE a = 'x' AND b = 'y'")).to.equal(false);
    });

    test("la comilla doblada es una escapada, no dos delimitadores", () => {
        // Así la trata T-SQL: `'O''Brien'` es un literal cerrado.
        expect(hasUnclosedQuote("WHERE nombre = 'O''Brien'")).to.equal(false);
        // Y sin cerrar sigue contando como dentro.
        expect(hasUnclosedQuote("WHERE nombre = 'O''Brien")).to.equal(true);
    });

    test("sin comillas, fuera", () => {
        expect(hasUnclosedQuote("SELECT ")).to.equal(false);
        expect(hasUnclosedQuote("")).to.equal(false);
    });

    test("una doblada al final no cuenta como apertura", () => {
        expect(hasUnclosedQuote("SET x = ''")).to.equal(false);
    });
});
