/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { EffectivePermission } from "../../../src/custom/admin/sql/types";
import {
    levelOf,
    resolveSecurableHierarchy,
    schemaOf,
} from "../../../src/custom/sharedInterfaces/securableHierarchy";

/**
 * La jerarquía de objetos protegibles (M10, FORK.md §30).
 *
 * **Las reglas que se fijan aquí vienen de la documentación de Microsoft, no de un motor.** El resto
 * de afirmaciones sobre SQL Server que hay en esta suite sí están medidas, y la diferencia importa:
 * el día que haya un servidor delante, la tercera regla —el DENY de tabla que no anula el GRANT de
 * columna— es la que hay que comprobar, porque es la rara.
 */

const SCHEMAS = new Set(["ventas", "dbo"]);

/** Un permiso efectivo mínimo, para no repetir siete campos en cada test. */
function permission(over: Partial<EffectivePermission>): EffectivePermission {
    return {
        principal: "analista",
        permission: "SELECT",
        securableClass: "OBJECT_OR_COLUMN",
        securable: "ventas.Cliente",
        columnName: "",
        state: "GRANT",
        via: [],
        conflict: false,
        ...over,
    };
}

suite("Fork: niveles de la jerarquía", () => {
    test("una clase de objeto sin columna es el objeto, y con columna es la columna", () => {
        expect(levelOf("OBJECT_OR_COLUMN", "")).to.equal("OBJECT");
        expect(levelOf("OBJECT_OR_COLUMN", "Saldo")).to.equal("COLUMN");
    });

    test("la base y el esquema son sus propios niveles", () => {
        expect(levelOf("DATABASE", "")).to.equal("DATABASE");
        expect(levelOf("SCHEMA", "")).to.equal("SCHEMA");
    });

    test("un principal o un tipo quedan fuera de la jerarquía", () => {
        // No cuelgan de un esquema ni de una tabla. Meterlos debajo sería inventarse una relación.
        expect(levelOf("DATABASE_PRINCIPAL", "")).to.equal("OTHER");
        expect(levelOf("TYPE", "")).to.equal("OTHER");
    });
});

suite("Fork: de qué esquema cuelga un objeto", () => {
    test("lo saca del nombre de dos partes", () => {
        expect(schemaOf("ventas.Cliente", SCHEMAS)).to.equal("ventas");
    });

    test("no lo deduce si el prefijo no es un esquema de la base", () => {
        // Un objeto puede llamarse `a.b`. Preferimos no relacionar a relacionar mal: una fila sin
        // anular es un dato incompleto, y una anulada por el objeto equivocado es un dato falso.
        expect(schemaOf("a.b", SCHEMAS)).to.equal(undefined);
    });

    test("un nombre sin punto no tiene esquema deducible", () => {
        expect(schemaOf("Cliente", SCHEMAS)).to.equal(undefined);
        expect(schemaOf(".Cliente", SCHEMAS)).to.equal(undefined);
    });
});

suite("Fork: la jerarquía anula", () => {
    test("un DENY sobre el esquema anula un GRANT sobre una tabla suya", () => {
        // El caso del §21.3: dos filas sueltas que el usuario tenía que juntar mentalmente.
        const resolved = resolveSecurableHierarchy(
            [
                permission({ securable: "ventas.Cliente", state: "GRANT" }),
                permission({ securableClass: "SCHEMA", securable: "ventas", state: "DENY" }),
            ],
            SCHEMAS,
        );

        expect(resolved[0].effect).to.equal("denied");
        expect(resolved[0].overriddenBy).to.deep.equal({ securable: "ventas", level: "SCHEMA" });
        // El estado del catálogo **no** se toca: es lo que hay que ir a quitar.
        expect(resolved[0].state).to.equal("GRANT");
    });

    test("un DENY sobre la base anula un GRANT sobre un esquema", () => {
        const resolved = resolveSecurableHierarchy(
            [
                permission({ securableClass: "SCHEMA", securable: "ventas", state: "GRANT" }),
                permission({ securableClass: "DATABASE", securable: "", state: "DENY" }),
            ],
            SCHEMAS,
        );

        expect(resolved[0].effect).to.equal("denied");
        expect(resolved[0].overriddenBy?.level).to.equal("DATABASE");
    });

    test("cuando anulan varios, enseña el más cercano", () => {
        // Es el que alguien puede querer quitar: quitar el de la base no bastaría.
        const resolved = resolveSecurableHierarchy(
            [
                permission({ securable: "ventas.Cliente", state: "GRANT" }),
                permission({ securableClass: "SCHEMA", securable: "ventas", state: "DENY" }),
                permission({ securableClass: "DATABASE", securable: "", state: "DENY" }),
            ],
            SCHEMAS,
        );

        expect(resolved[0].overriddenBy?.level).to.equal("SCHEMA");
    });

    test("un GRANT de arriba no rescata un DENY más concreto", () => {
        const resolved = resolveSecurableHierarchy(
            [
                permission({ securable: "ventas.Cliente", state: "DENY" }),
                permission({ securableClass: "SCHEMA", securable: "ventas", state: "GRANT" }),
            ],
            SCHEMAS,
        );

        expect(resolved[0].effect).to.equal("denied");
        expect(resolved[1].effect).to.equal("allowed");
    });

    test("el DENY tiene que ser del mismo permiso", () => {
        const resolved = resolveSecurableHierarchy(
            [
                permission({ securable: "ventas.Cliente", permission: "SELECT", state: "GRANT" }),
                permission({
                    securableClass: "SCHEMA",
                    securable: "ventas",
                    permission: "UPDATE",
                    state: "DENY",
                }),
            ],
            SCHEMAS,
        );

        expect(resolved[0].effect).to.equal("allowed");
        expect(resolved[0].overriddenBy).to.equal(undefined);
    });

    test("un CONTROL no se toma por el SELECT que implica", () => {
        // Límite escrito a propósito: resolver los permisos que cubren a otros exige el grafo de
        // implicaciones del motor, que es otra lista cerrada que habría que medir.
        const resolved = resolveSecurableHierarchy(
            [
                permission({ securable: "ventas.Cliente", permission: "SELECT", state: "GRANT" }),
                permission({
                    securableClass: "SCHEMA",
                    securable: "ventas",
                    permission: "CONTROL",
                    state: "DENY",
                }),
            ],
            SCHEMAS,
        );

        expect(resolved[0].effect).to.equal("allowed");
    });

    test("un DENY sobre la tabla NO anula un GRANT sobre una de sus columnas", () => {
        // La excepción que Microsoft documenta y llama inconsistencia conservada por
        // compatibilidad. Es la única pareja de niveles donde lo de arriba no gana.
        const resolved = resolveSecurableHierarchy(
            [
                permission({ securable: "ventas.Cliente", columnName: "Saldo", state: "GRANT" }),
                permission({ securable: "ventas.Cliente", state: "DENY" }),
            ],
            SCHEMAS,
        );

        expect(resolved[0].level).to.equal("COLUMN");
        expect(resolved[0].effect).to.equal("allowed");
        expect(resolved[0].overriddenBy).to.equal(undefined);
    });

    test("pero un DENY sobre el esquema sí anula un GRANT de columna", () => {
        // La excepción es solo objeto→columna. Un nivel más arriba vuelve la regla general.
        const resolved = resolveSecurableHierarchy(
            [
                permission({ securable: "ventas.Cliente", columnName: "Saldo", state: "GRANT" }),
                permission({ securableClass: "SCHEMA", securable: "ventas", state: "DENY" }),
            ],
            SCHEMAS,
        );

        expect(resolved[0].effect).to.equal("denied");
        expect(resolved[0].overriddenBy?.level).to.equal("SCHEMA");
    });

    test("un objeto cuyo esquema no se puede deducir no lo anula nadie por esa vía", () => {
        const resolved = resolveSecurableHierarchy(
            [
                permission({ securable: "a.b", state: "GRANT" }),
                permission({ securableClass: "SCHEMA", securable: "a", state: "DENY" }),
            ],
            SCHEMAS,
        );

        expect(resolved[0].effect).to.equal("allowed");
    });

    test("no cambia el orden ni el número de filas", () => {
        // La matriz sigue sin inventarse filas: lo que se añade es el efecto y quién lo anula.
        const input = [
            permission({ securable: "ventas.Cliente" }),
            permission({ securableClass: "SCHEMA", securable: "ventas", state: "DENY" }),
            permission({ securableClass: "TYPE", securable: "Moneda" }),
        ];

        const resolved = resolveSecurableHierarchy(input, SCHEMAS);

        expect(resolved).to.have.length(3);
        expect(resolved.map((entry) => entry.securable)).to.deep.equal([
            "ventas.Cliente",
            "ventas",
            "Moneda",
        ]);
    });

    test("un objeto fuera de la jerarquía no se anula ni anula", () => {
        const resolved = resolveSecurableHierarchy(
            [
                permission({ securableClass: "TYPE", securable: "Moneda", state: "GRANT" }),
                permission({ securableClass: "DATABASE", securable: "", state: "DENY" }),
            ],
            SCHEMAS,
        );

        expect(resolved[0].effect).to.equal("allowed");
    });
});
