/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import {
    isEditable,
    parseLibrary,
    readOnlyId,
    searchText,
    serializeOwnLibrary,
    sortForDisplay,
    validateOwnSnippet,
} from "../../../src/custom/snippets/library";
import { labelFor } from "../../../src/custom/snippets/store";
import { Snippet } from "../../../src/custom/sharedInterfaces/snippets";

/**
 * Biblioteca de snippets (M7).
 *
 * La propiedad que más importa: **un archivo mal formado no puede dejar la vista inservible**. Una
 * biblioteca compartida vive en una ruta de red y la edita gente a mano, así que se devuelve lo que
 * se pudo leer y el motivo de lo que no.
 */
suite("Fork: análisis de bibliotecas de snippets", () => {
    test("lee el formato propio, un array de objetos", () => {
        const parsed = parseLibrary(
            JSON.stringify([
                {
                    id: "own:1",
                    name: "Bloqueos",
                    prefix: "bloqueos",
                    body: "SELECT * FROM sys.dm_tran_locks;",
                    description: "Bloqueos actuales.",
                    category: "Diagnóstico",
                },
            ]),
            "own",
            "",
        );

        expect(parsed.errorMessage).to.equal("");
        expect(parsed.snippets).to.have.length(1);
        expect(parsed.snippets[0].id).to.equal("own:1");
        expect(parsed.snippets[0].category).to.equal("Diagnóstico");
        expect(parsed.snippets[0].origin).to.equal("own");
    });

    test("lee el formato de VS Code, donde el nombre es la clave", () => {
        // Es el formato de `snippets/mssql.json`, así que se leen con el mismo código en lugar de
        // con un caso especial.
        const parsed = parseLibrary(
            JSON.stringify({
                "Create a new Table": {
                    prefix: "sqlCreateTable",
                    body: ["CREATE TABLE ${1:nombre} (", "  ${2:columna} INT", ");"],
                    description: "Crea una tabla.",
                },
            }),
            "builtin",
            "",
        );

        expect(parsed.snippets).to.have.length(1);
        expect(parsed.snippets[0].name).to.equal("Create a new Table");
        // El cuerpo puede venir como array de líneas: se une con saltos.
        expect(parsed.snippets[0].body).to.equal(
            "CREATE TABLE ${1:nombre} (\n  ${2:columna} INT\n);",
        );
        expect(parsed.snippets[0].origin).to.equal("builtin");
    });

    test("un cuerpo en una sola cadena también vale", () => {
        const parsed = parseLibrary(
            JSON.stringify({ Uno: { prefix: "u", body: "SELECT 1;" } }),
            "builtin",
            "",
        );
        expect(parsed.snippets[0].body).to.equal("SELECT 1;");
    });

    test("un JSON roto no tira la vista: devuelve el motivo y ningún snippet", () => {
        const parsed = parseLibrary("{ esto no es json", "shared", "equipo.json");
        expect(parsed.snippets).to.have.length(0);
        expect(parsed.errorMessage).to.be.a("string").and.not.equal("");
    });

    test("el motivo no arrastra el contenido del archivo", () => {
        // Un archivo compartido puede tener cualquier cosa dentro, y el mensaje va a la interfaz.
        const parsed = parseLibrary('{ "roto": SECRETO_DEL_EQUIPO }', "shared", "equipo.json");
        expect(parsed.errorMessage).to.not.contain("SECRETO_DEL_EQUIPO");
    });

    test("una entrada sin nombre o sin cuerpo se descarta, y el resto sigue valiendo", () => {
        const parsed = parseLibrary(
            JSON.stringify([
                { name: "Bueno", body: "SELECT 1;" },
                { name: "", body: "SELECT 2;" },
                { name: "Sin cuerpo" },
            ]),
            "own",
            "",
        );

        expect(parsed.snippets).to.have.length(1);
        expect(parsed.snippets[0].name).to.equal("Bueno");
        expect(parsed.skipped).to.have.length(2);
    });

    test("un JSON que no es ni array ni objeto da motivo", () => {
        expect(parseLibrary("42", "own", "").errorMessage)
            .to.be.a("string")
            .and.not.equal("");
        expect(parseLibrary('"cadena"', "own", "").errorMessage).to.not.equal("");
    });

    test("un snippet propio sin id recibe uno derivado, para que React no reordene mal", () => {
        const parsed = parseLibrary(
            JSON.stringify([{ name: "Sin id", body: "SELECT 1;" }]),
            "own",
            "",
        );
        expect(parsed.snippets[0].id).to.equal(readOnlyId("own", "", "Sin id"));
    });

    test("solo los compartidos llevan etiqueta de biblioteca", () => {
        const shared = parseLibrary(
            JSON.stringify([{ name: "A", body: "x" }]),
            "shared",
            "equipo.json",
        );
        const own = parseLibrary(JSON.stringify([{ name: "A", body: "x" }]), "own", "");
        expect(shared.snippets[0].library).to.equal("equipo.json");
        expect(own.snippets[0].library).to.equal("");
    });
});

suite("Fork: qué se puede editar", () => {
    const make = (origin: Snippet["origin"]): Snippet => ({
        id: "1",
        name: "A",
        prefix: "a",
        body: "x",
        description: "",
        category: "",
        origin,
        library: "",
    });

    test("solo los propios", () => {
        expect(isEditable(make("own"))).to.equal(true);
        expect(isEditable(make("shared"))).to.equal(false);
        expect(isEditable(make("builtin"))).to.equal(false);
    });
});

suite("Fork: guardar la biblioteca propia", () => {
    const make = (origin: Snippet["origin"], name: string): Snippet => ({
        id: `id-${name}`,
        name,
        prefix: "p",
        body: "SELECT 1;",
        description: "d",
        category: "c",
        origin,
        library: origin === "shared" ? "equipo.json" : "",
    });

    test("solo escribe los propios: los demás no son nuestros", () => {
        const text = serializeOwnLibrary([
            make("own", "Mío"),
            make("shared", "Del equipo"),
            make("builtin", "De la extensión"),
        ]);
        const written = JSON.parse(text) as { name: string }[];
        expect(written).to.have.length(1);
        expect(written[0].name).to.equal("Mío");
    });

    test("no guarda el origen ni la etiqueta: se deducen de dónde está el archivo", () => {
        const written = JSON.parse(serializeOwnLibrary([make("own", "Mío")])) as Record<
            string,
            unknown
        >[];
        expect(written[0]).to.not.have.property("origin");
        expect(written[0]).to.not.have.property("library");
    });

    test("acaba en salto de línea, para que el diff no marque la última", () => {
        expect(serializeOwnLibrary([make("own", "A")]).endsWith("\n")).to.equal(true);
    });

    test("lo que se guarda se vuelve a leer igual", () => {
        // La ida y vuelta es lo que garantiza que editar en un editor y editar en el panel son
        // intercambiables.
        const original = make("own", "Bloqueos");
        const reparsed = parseLibrary(serializeOwnLibrary([original]), "own", "").snippets;
        expect(reparsed).to.have.length(1);
        expect(reparsed[0]).to.deep.equal(original);
    });
});

suite("Fork: validación de un snippet propio", () => {
    test("exige nombre y cuerpo", () => {
        expect(validateOwnSnippet({ name: "", prefix: "", body: "x" })).to.be.a("string");
        expect(validateOwnSnippet({ name: "A", prefix: "", body: "  " })).to.be.a("string");
        expect(validateOwnSnippet({ name: "A", prefix: "", body: "x" })).to.equal(undefined);
    });

    test("el prefijo no puede llevar espacios, porque el editor no lo encontraría", () => {
        expect(validateOwnSnippet({ name: "A", prefix: "dos palabras", body: "x" })).to.be.a(
            "string",
        );
        expect(validateOwnSnippet({ name: "A", prefix: "una", body: "x" })).to.equal(undefined);
    });

    test("el prefijo vacío vale: el snippet solo sale en la lista", () => {
        expect(validateOwnSnippet({ name: "A", prefix: "   ", body: "x" })).to.equal(undefined);
    });

    test("el prefijo NO se valida con las reglas de identificador del 11.2", () => {
        // No acaba dentro de una consulta: es una palabra que dispara una sugerencia.
        expect(validateOwnSnippet({ name: "A", prefix: "1-con-guiones", body: "x" })).to.equal(
            undefined,
        );
    });
});

suite("Fork: orden y búsqueda", () => {
    const make = (
        origin: Snippet["origin"],
        name: string,
        category = "",
        library = "",
    ): Snippet => ({
        id: `${origin}-${name}`,
        name,
        prefix: "",
        body: "",
        description: "",
        category,
        origin,
        library,
    });

    test("los propios van primero, luego compartidos, luego los de la extensión", () => {
        const sorted = sortForDisplay([
            make("builtin", "B"),
            make("shared", "S", "", "equipo.json"),
            make("own", "O"),
        ]);
        expect(sorted.map((snippet) => snippet.origin)).to.deep.equal(["own", "shared", "builtin"]);
    });

    test("dentro de un origen, por categoría y luego por nombre", () => {
        const sorted = sortForDisplay([
            make("own", "Zeta", "Alfa"),
            make("own", "Alfa", "Beta"),
            make("own", "Beta", "Alfa"),
        ]);
        expect(sorted.map((snippet) => snippet.name)).to.deep.equal(["Beta", "Zeta", "Alfa"]);
    });

    test("no muta la lista que recibe", () => {
        const original = [make("builtin", "B"), make("own", "O")];
        sortForDisplay(original);
        expect(original[0].origin).to.equal("builtin");
    });

    test("el texto de búsqueda incluye el cuerpo", () => {
        // Buscar «OVER» y encontrar el snippet de funciones de ventana es lo que alguien espera, y
        // el nombre no siempre lo lleva.
        const snippet: Snippet = {
            id: "1",
            name: "Ranking",
            prefix: "rank",
            body: "ROW_NUMBER() OVER (ORDER BY 1)",
            description: "",
            category: "",
            origin: "own",
            library: "",
        };
        expect(searchText(snippet)).to.contain("OVER");
    });
});

suite("Fork: etiqueta de una biblioteca compartida", () => {
    test("es el nombre del archivo, no la ruta entera", () => {
        expect(labelFor("/mnt/equipo/snippets/ventas.json")).to.equal("ventas.json");
        expect(labelFor("C:\\equipo\\snippets\\ventas.json")).to.equal("ventas.json");
        expect(labelFor("ventas.json")).to.equal("ventas.json");
    });
});
