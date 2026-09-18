/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import {
    assertIdentifier,
    isValidIdentifier,
    looksLikeDomainPrincipal,
    quoteIdentifier,
    quoteLiteral,
    quoteQualifiedName,
} from "../../../src/custom/util/identifiers";

/**
 * La regla 11.2 del brief: los identificadores no se parametrizan, se validan y se envuelven con
 * `QUOTENAME`, y **lo que no pasa se aborta**, nunca se escapa a mano.
 *
 * Los cuatro casos que el brief pide por su nombre —corchete de cierre, comilla simple, punto y
 * coma y doble guion— están al principio, porque son los que convierten un nombre en una inyección.
 */
suite("Fork: validación de identificadores", () => {
    test("rechaza los cuatro casos que el brief nombra", () => {
        // Corchete de cierre: cerraría el QUOTENAME y dejaría salir el resto.
        expect(isValidIdentifier("Ventas]"), "corchete de cierre").to.equal(false);
        expect(isValidIdentifier("Ven]tas"), "corchete de cierre en medio").to.equal(false);
        expect(isValidIdentifier("Ventas] WITH (NOLOCK) --")).to.equal(false);

        // Comilla simple: cerraría un literal de cadena.
        expect(isValidIdentifier("O'Brien"), "comilla simple").to.equal(false);
        expect(isValidIdentifier("Ventas'; DROP DATABASE Ventas; --")).to.equal(false);

        // Punto y coma: encadenaría una sentencia nueva.
        expect(isValidIdentifier("Ventas; DROP DATABASE Ventas")).to.equal(false);

        // Doble guion: comentaría el resto de la sentencia.
        expect(isValidIdentifier("Ventas--")).to.equal(false);
        expect(isValidIdentifier("Ventas -- comentario")).to.equal(false);
    });

    test("acepta los nombres normales", () => {
        expect(isValidIdentifier("Ventas")).to.equal(true);
        expect(isValidIdentifier("ParityDb")).to.equal(true);
        expect(isValidIdentifier("_temporal")).to.equal(true);
        expect(isValidIdentifier("ventas_lectores")).to.equal(true);
        expect(isValidIdentifier("cuenta@dominio")).to.equal(true);
        expect(isValidIdentifier("tabla$respaldo")).to.equal(true);
        expect(isValidIdentifier("#temporal_no_es_primer_caracter")).to.equal(false);
        expect(isValidIdentifier("Base De Datos Con Espacios")).to.equal(true);
        expect(isValidIdentifier("base-con-guiones")).to.equal(true);
    });

    test("rechaza lo vacío, lo que no es cadena y lo demasiado largo", () => {
        expect(isValidIdentifier("")).to.equal(false);
        expect(isValidIdentifier(undefined)).to.equal(false);
        expect(isValidIdentifier(null)).to.equal(false);
        expect(isValidIdentifier(42)).to.equal(false);
        expect(isValidIdentifier({})).to.equal(false);
        expect(isValidIdentifier("a".repeat(128)), "128 es el límite de sysname").to.equal(true);
        expect(isValidIdentifier("a".repeat(129))).to.equal(false);
    });

    test("no acepta nombres que empiecen por dígito ni caracteres de control", () => {
        expect(isValidIdentifier("1Ventas")).to.equal(false);
        expect(isValidIdentifier("Ventas\nDROP")).to.equal(false);
        expect(isValidIdentifier("Ventas\tDROP")).to.equal(false);
        expect(isValidIdentifier("Ventas/*x*/")).to.equal(false);
        expect(isValidIdentifier("[Ventas]")).to.equal(false);
    });

    test("la regla de DOMINIO\\usuario exige una sola barra y nombre a los dos lados", () => {
        expect(looksLikeDomainPrincipal("CONTOSO\\ana")).to.equal(true);
        expect(looksLikeDomainPrincipal("ana")).to.equal(false);

        expect(isValidIdentifier("CONTOSO\\ana")).to.equal(true);
        expect(isValidIdentifier("NT AUTHORITY\\SYSTEM")).to.equal(true);
        expect(isValidIdentifier("BUILTIN\\Administrators")).to.equal(true);
        expect(isValidIdentifier("CONTOSO\\ana.perez")).to.equal(true);

        // Sin nombre a un lado, con dos barras, o con la barra al principio: no.
        expect(isValidIdentifier("CONTOSO\\")).to.equal(false);
        expect(isValidIdentifier("\\ana")).to.equal(false);
        expect(isValidIdentifier("CONTOSO\\sub\\ana")).to.equal(false);
        expect(isValidIdentifier("CONTOSO\\ana]")).to.equal(false);
    });
});

suite("Fork: entrecomillado de identificadores", () => {
    test("envuelve entre corchetes como QUOTENAME", () => {
        expect(quoteIdentifier("Ventas")).to.equal("[Ventas]");
        expect(quoteIdentifier("Base De Datos")).to.equal("[Base De Datos]");
        expect(quoteIdentifier("CONTOSO\\ana")).to.equal("[CONTOSO\\ana]");
    });

    test("aborta en lugar de escapar", () => {
        expect(() => quoteIdentifier("Ventas]")).to.throw(/no es válido/);
        expect(() => quoteIdentifier("Ventas; DROP DATABASE Ventas")).to.throw(/no es válido/);
        expect(() => assertIdentifier("--")).to.throw(/no es válido/);
    });

    test("el mensaje de error no repite el valor rechazado", () => {
        // Regla 11.3: un mensaje de error acaba en un registro, y el valor puede ser de producción.
        try {
            quoteIdentifier("Ventas'; DROP DATABASE Ventas; --");
            expect.fail("debería haber lanzado");
        } catch (error) {
            expect((error as Error).message).to.not.contain("DROP");
            expect((error as Error).message).to.not.contain("Ventas");
        }
    });

    test("nombra qué identificador falló, para que el mensaje sea útil", () => {
        expect(() => quoteIdentifier("1mal", "nombre de base de datos")).to.throw(
            /nombre de base de datos/,
        );
    });

    test("el literal de cadena se valida igual y lleva prefijo N", () => {
        expect(quoteLiteral("ParityDb")).to.equal("N'ParityDb'");
        expect(() => quoteLiteral("O'Brien")).to.throw(/no es válido/);
    });

    test("el nombre en dos partes valida las dos mitades", () => {
        expect(quoteQualifiedName("ventas", "Cliente")).to.equal("[ventas].[Cliente]");
        expect(() => quoteQualifiedName("ventas]", "Cliente")).to.throw(/esquema/);
        expect(() => quoteQualifiedName("ventas", "Cliente]")).to.throw(/objeto/);
    });
});
