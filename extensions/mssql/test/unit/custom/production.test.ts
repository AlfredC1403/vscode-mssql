/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import {
    evaluateProduction,
    isSettingEmpty,
    normalizeServerName,
    serverMatchesPattern,
} from "../../../src/custom/util/production";

/**
 * La marca de producción (regla 11.4 del brief) tiene una propiedad que importa más que la comodidad:
 * **solo amplía**. Ningún patrón puede quitar la marca que puso un id, y no hay forma de escribir una
 * excepción. Los tests de abajo la fijan.
 */
suite("Fork: normalización del nombre de servidor", () => {
    test("mayúsculas, puerto y prefijo de protocolo dan igual", () => {
        expect(normalizeServerName("sql-prod-01")).to.equal("SQL-PROD-01");
        expect(normalizeServerName("SQL-Prod-01,1433")).to.equal("SQL-PROD-01");
        expect(normalizeServerName("tcp:sql-prod-01,1433")).to.equal("SQL-PROD-01");
        expect(normalizeServerName("  np:SQL-PROD-01  ")).to.equal("SQL-PROD-01");
    });

    test("una instancia con nombre no se recorta", () => {
        // `servidor\instancia` es otro servidor, no el mismo con puerto.
        expect(normalizeServerName("SQL01\\VENTAS")).to.equal("SQL01\\VENTAS");
    });

    test("lo que no es cadena no encaja con nada", () => {
        expect(normalizeServerName(undefined)).to.equal("");
        expect(normalizeServerName(42)).to.equal("");
    });
});

suite("Fork: patrones de servidor", () => {
    test("el comodín funciona al principio, al final y en medio", () => {
        expect(serverMatchesPattern("sql-prod-01", "sql-prod-*")).to.equal(true);
        expect(serverMatchesPattern("sql-prod-01", "*-prod-01")).to.equal(true);
        expect(serverMatchesPattern("sql-prod-01", "sql-*-01")).to.equal(true);
        expect(serverMatchesPattern("sql-prod-01", "*prod*")).to.equal(true);
        expect(serverMatchesPattern("sql-prod-01", "*")).to.equal(true);
    });

    test("sin comodín, la coincidencia es exacta", () => {
        expect(serverMatchesPattern("sql-prod-01", "sql-prod-01")).to.equal(true);
        expect(serverMatchesPattern("sql-prod-01", "sql-prod")).to.equal(false);
        expect(serverMatchesPattern("sql-prod-011", "sql-prod-01")).to.equal(false);
    });

    test("el patrón no es una expresión regular", () => {
        // Quien escriba `sql-prod-.*` quiere decir eso literalmente, no marcar media instalación.
        expect(serverMatchesPattern("sql-prod-01", "sql-prod-.*")).to.equal(false);
        expect(serverMatchesPattern("sql-prod-01", "sql.prod.01")).to.equal(false);
        expect(serverMatchesPattern("sqlXprodX01", "sql.prod.01")).to.equal(false);
    });

    test("el puerto y las mayúsculas no rompen el patrón", () => {
        expect(serverMatchesPattern("TCP:SQL-PROD-01,1433", "sql-prod-*")).to.equal(true);
        expect(serverMatchesPattern("sql-prod-01", "TCP:SQL-PROD-*,1433")).to.equal(true);
    });

    test("un patrón vacío no marca nada", () => {
        expect(serverMatchesPattern("sql-prod-01", "")).to.equal(false);
        expect(serverMatchesPattern("", "sql-prod-*")).to.equal(false);
    });
});

suite("Fork: veredicto de producción", () => {
    test("el id de un perfil guardado marca, y lo dice", () => {
        const verdict = evaluateProduction("perfil-1", "sql-dev-09", {
            connectionIds: ["perfil-1"],
        });

        expect(verdict.production).to.equal(true);
        expect(verdict.reason).to.equal("connectionId");
    });

    test("un patrón marca una conexión sin guardar, que es la que no tiene id", () => {
        const verdict = evaluateProduction(undefined, "sql-prod-07", {
            serverPatterns: ["sql-prod-*"],
        });

        expect(verdict.production).to.equal(true);
        expect(verdict.reason).to.equal("serverPattern");
        expect(verdict.matchedPattern).to.equal("sql-prod-*");
    });

    test("un patrón no puede quitar la marca que puso un id", () => {
        // Solo amplía: no hay forma de escribir una excepción, y es a propósito.
        const verdict = evaluateProduction("perfil-1", "sql-dev-09", {
            connectionIds: ["perfil-1"],
            serverPatterns: ["sql-prod-*"],
        });

        expect(verdict.production).to.equal(true);
        expect(verdict.reason).to.equal("connectionId");
    });

    test("sin ajuste, nada es de producción, y el panel lo tiene que decir", () => {
        expect(evaluateProduction("perfil-1", "sql-prod-01", undefined).production).to.equal(false);
        expect(evaluateProduction("perfil-1", "sql-prod-01", {}).production).to.equal(false);
        expect(isSettingEmpty(undefined)).to.equal(true);
        expect(isSettingEmpty({ connectionIds: [], serverPatterns: [] })).to.equal(true);
        expect(isSettingEmpty({ serverPatterns: ["*"] })).to.equal(false);
    });

    test("un id que no coincide no marca por parecido", () => {
        expect(
            evaluateProduction("perfil-10", "x", { connectionIds: ["perfil-1"] }).production,
        ).to.equal(false);
    });
});
