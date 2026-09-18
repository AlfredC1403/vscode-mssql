/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import {
    OPTION_PREFIX,
    defaultValues,
    deviationsFromDefaults,
    fitsOption,
    groupOf,
    mergeProfile,
    readFormatSchema,
} from "../../../src/custom/format/schema";
import { isDirty } from "../../../src/custom/format/formatProfilesController";
import { applyEdits, hash } from "../../../src/custom/format/previewFormatter";
import { FormatOption } from "../../../src/custom/sharedInterfaces/formatProfiles";

/** Sube desde este archivo hasta encontrar el `package.json` de la extensión. */
function findPackageJson(): { contributes: { configuration: { properties: unknown } } } {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");

    let directory = __dirname;
    for (let depth = 0; depth < 8; depth += 1) {
        const candidate = path.join(directory, "package.json");
        if (fs.existsSync(candidate)) {
            const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
            if (parsed?.name === "sqlworks") {
                return parsed;
            }
        }
        directory = path.dirname(directory);
    }
    throw new Error("no se encontró el package.json de la extensión");
}

/**
 * El esquema del formateador (M8).
 *
 * La propiedad que importa: **no hay lista de opciones escrita a mano**. Se lee del `package.json`
 * del upstream, así que cuando añada una opción aparece sola. Estos tests usan un `package.json` de
 * mentira, y el último comprueba contra el de verdad.
 */
const FAKE = {
    "mssql.format.showParseErrorNotification": { type: "boolean", default: true },
    "mssql.format.options.keywordCasing": {
        type: "string",
        enum: ["preserve", "uppercase", "lowercase"],
        default: "preserve",
        description: "Casing for keywords.",
    },
    "mssql.format.options.alignClauseBodies": {
        type: "boolean",
        default: true,
        description: "Align clause bodies.",
    },
    "mssql.format.options.numNewlinesAfterStatement": {
        type: "integer",
        default: 1,
        description: "Blank lines after a statement.",
    },
    // Ruido que no debe aparecer.
    "mssql.connections": { type: "array", default: [] },
    "sqlworks.format.profiles": { type: "object", default: {} },
};

suite("Fork: lectura del esquema del formateador", () => {
    const options = readFormatSchema(FAKE);

    test("solo coge las opciones de estilo", () => {
        expect(options.map((option) => option.name).sort()).to.deep.equal([
            "alignClauseBodies",
            "keywordCasing",
            "numNewlinesAfterStatement",
        ]);
    });

    test("deja fuera showParseErrorNotification, que no es una regla de estilo", () => {
        // Es una preferencia sobre notificaciones; compartirla en un perfil de equipo no tendría
        // sentido, así que no entra.
        expect(options.some((option) => option.name === "showParseErrorNotification")).to.equal(
            false,
        );
    });

    test("deduce el tipo de control de lo que declara el upstream", () => {
        const byName = new Map(options.map((option) => [option.name, option]));
        expect(byName.get("keywordCasing")?.kind).to.equal("enum");
        expect(byName.get("keywordCasing")?.choices).to.deep.equal([
            "preserve",
            "uppercase",
            "lowercase",
        ]);
        expect(byName.get("alignClauseBodies")?.kind).to.equal("boolean");
        expect(byName.get("numNewlinesAfterStatement")?.kind).to.equal("integer");
    });

    test("conserva la descripción del upstream y su valor por omisión", () => {
        const option = options.find((entry) => entry.name === "keywordCasing");
        expect(option?.description).to.equal("Casing for keywords.");
        expect(option?.defaultValue).to.equal("preserve");
        expect(option?.key).to.equal(`${OPTION_PREFIX}keywordCasing`);
    });

    test("descarta lo que no sabe pintar, en lugar de inventarse un control", () => {
        const weird = readFormatSchema({
            "mssql.format.options.raro": { type: "array", default: [] },
            "mssql.format.options.enumSinOpciones": { enum: [], default: "x" },
            "mssql.format.options.porOmisionIncoherente": {
                enum: ["a", "b"],
                default: "c",
            },
            "mssql.format.options.tipoQueNoCasa": { type: "boolean", default: "sí" },
        });
        expect(weird).to.have.length(0);
    });

    test("un esquema que no es un objeto no rompe nada", () => {
        expect(readFormatSchema(undefined)).to.have.length(0);
        expect(readFormatSchema("no")).to.have.length(0);
        expect(readFormatSchema(null)).to.have.length(0);
    });
});

suite("Fork: agrupación de opciones", () => {
    test("agrupa por el prefijo del nombre, sin mapa escrito a mano", () => {
        expect(groupOf("keywordCasing")).to.equal("Mayúsculas y minúsculas");
        expect(groupOf("newLineBeforeFromClause")).to.equal("Saltos de línea");
        expect(groupOf("multilineWherePredicatesList")).to.equal("Listas en varias líneas");
        expect(groupOf("alignColumnDefinitionFields")).to.equal("Alineación");
        expect(groupOf("sqlVersion")).to.equal("Dialecto");
    });

    test("lo que no encaja en ningún grupo cae en «Otras», no se pierde", () => {
        expect(groupOf("algoCompletamenteNuevo")).to.equal("Otras");
    });
});

suite("Fork: desviaciones y valores por omisión", () => {
    const options = readFormatSchema(FAKE);

    test("un perfil guarda solo lo que se desvía de fábrica", () => {
        // Así un perfil se lee de un vistazo y una opción nueva del upstream no queda congelada con
        // su valor de hoy en todos los perfiles guardados.
        const deviations = deviationsFromDefaults(
            { keywordCasing: "uppercase", alignClauseBodies: true, numNewlinesAfterStatement: 1 },
            options,
        );
        expect(deviations).to.deep.equal({ keywordCasing: "uppercase" });
    });

    test("sin desviaciones, el perfil está vacío", () => {
        expect(deviationsFromDefaults(defaultValues(options), options)).to.deep.equal({});
    });

    test("los valores por omisión son los que declara el upstream", () => {
        expect(defaultValues(options)).to.deep.equal({
            keywordCasing: "preserve",
            alignClauseBodies: true,
            numNewlinesAfterStatement: 1,
        });
    });
});

suite("Fork: mezclar un perfil", () => {
    const options = readFormatSchema(FAKE);

    test("lo que el perfil no dice vuelve a fábrica, no a lo que hubiera antes", () => {
        // Si no fuera así, aplicar dos perfiles seguidos daría un híbrido de los dos.
        const merged = mergeProfile({ keywordCasing: "lowercase" }, options);
        expect(merged.values).to.deep.equal({
            keywordCasing: "lowercase",
            alignClauseBodies: true,
            numNewlinesAfterStatement: 1,
        });
        expect(merged.ignored).to.have.length(0);
    });

    test("una opción que el upstream ya no tiene se ignora y se dice", () => {
        const merged = mergeProfile({ opcionQueYaNoExiste: true }, options);
        expect(merged.ignored).to.deep.equal(["opcionQueYaNoExiste"]);
        expect(merged.values).to.deep.equal(defaultValues(options));
    });

    test("un valor del tipo equivocado se ignora", () => {
        const merged = mergeProfile(
            { keywordCasing: "noEsUnaOpcionValida", alignClauseBodies: "sí" },
            options,
        );
        expect(merged.ignored.sort()).to.deep.equal(["alignClauseBodies", "keywordCasing"]);
    });

    test("un perfil vacío da exactamente los valores de fábrica", () => {
        expect(mergeProfile({}, options).values).to.deep.equal(defaultValues(options));
    });
});

suite("Fork: comprobación de tipos de un valor", () => {
    const options = readFormatSchema(FAKE);
    const byName = new Map(options.map((option) => [option.name, option]));
    const keyword = byName.get("keywordCasing") as FormatOption;
    const align = byName.get("alignClauseBodies") as FormatOption;
    const newlines = byName.get("numNewlinesAfterStatement") as FormatOption;

    test("un enum solo acepta sus opciones", () => {
        expect(fitsOption("uppercase", keyword)).to.equal(true);
        expect(fitsOption("otra", keyword)).to.equal(false);
        expect(fitsOption(true, keyword)).to.equal(false);
    });

    test("un booleano solo acepta booleanos", () => {
        expect(fitsOption(false, align)).to.equal(true);
        expect(fitsOption("false", align)).to.equal(false);
        expect(fitsOption(0, align)).to.equal(false);
    });

    test("un entero no acepta decimales", () => {
        expect(fitsOption(2, newlines)).to.equal(true);
        expect(fitsOption(1.5, newlines)).to.equal(false);
        expect(fitsOption("2", newlines)).to.equal(false);
    });
});

suite("Fork: borrador contra lo aplicado", () => {
    test("detecta que hay cambios sin aplicar", () => {
        expect(isDirty({ a: 1 }, { a: 1 })).to.equal(false);
        expect(isDirty({ a: 1 }, { a: 2 })).to.equal(true);
        // Una clave que está en uno y no en el otro también cuenta.
        expect(isDirty({ a: 1, b: true }, { a: 1 })).to.equal(true);
        expect(isDirty({}, {})).to.equal(false);
    });
});

suite("Fork: aplicar los edits del formateador", () => {
    test("sin edits, el texto no cambia", () => {
        expect(applyEdits("select 1", [])).to.equal("select 1");
    });

    test("un edit sustituye su rango", () => {
        const text = "select a";
        const edits = [
            {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
                newText: "SELECT",
            },
        ];
        expect(applyEdits(text, edits)).to.equal("SELECT a");
    });

    test("varios edits se aplican de atrás hacia delante, sin desplazarse entre ellos", () => {
        // Si se aplicaran en orden, el primero movería las posiciones del segundo.
        const text = "select a from t";
        const edits = [
            {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
                newText: "SELECT",
            },
            {
                range: { start: { line: 0, character: 9 }, end: { line: 0, character: 13 } },
                newText: "FROM",
            },
        ];
        expect(applyEdits(text, edits)).to.equal("SELECT a FROM t");
    });

    test("cuenta bien los saltos de línea al calcular posiciones", () => {
        const text = "select a\nfrom t";
        const edits = [
            {
                range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } },
                newText: "FROM",
            },
        ];
        expect(applyEdits(text, edits)).to.equal("select a\nFROM t");
    });
});

suite("Fork: identificador del SQL de muestra", () => {
    test("el mismo texto da el mismo identificador, y textos distintos dan distintos", () => {
        expect(hash("select 1")).to.equal(hash("select 1"));
        expect(hash("select 1")).to.not.equal(hash("select 2"));
    });

    test("es una cadena utilizable en un URI", () => {
        expect(hash("select 1")).to.match(/^[a-z0-9]+$/);
    });
});

suite("Fork: el esquema real del upstream", () => {
    test("se leen las 56 opciones que declara el package.json de verdad", () => {
        // Este es el test que detecta que el upstream cambió el formateador: si añade o quita
        // opciones, aquí se ve. Y es la prueba de que no hace falta mantener una lista a mano.
        //
        // El `package.json` se busca subiendo desde `__dirname` en lugar de con una ruta relativa
        // fija: en el fuente este archivo está en `test/unit/custom/`, pero se ejecuta compilado
        // desde `out/test/unit/custom/`, así que la cuenta de `..` no es la misma.
        const options = readFormatSchema(findPackageJson().contributes.configuration.properties);

        // 56 ajustes `mssql.format.*` menos `showParseErrorNotification`, que no es de estilo.
        expect(options).to.have.length(55);
        // Y todas se pueden pintar: si alguna cayera en un tipo desconocido, no estaría aquí.
        expect(
            options.every((option) => ["boolean", "enum", "integer"].includes(option.kind)),
        ).to.equal(true);
        // Ninguna sin descripción: es lo que hace útil al panel sin escribir textos propios.
        expect(options.filter((option) => !option.description)).to.have.length(0);
    });
});
