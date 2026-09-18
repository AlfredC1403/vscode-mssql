/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { Snippet, SnippetOrigin } from "../sharedInterfaces/snippets";

/**
 * Análisis y normalización de bibliotecas de snippets. **Funciones puras**: no tocan el disco ni
 * importan `vscode`, así que se pueden probar sin montar nada.
 *
 * ## Dos formatos, a propósito
 *
 * 1. **El nuestro**: un array de objetos con `name`, `prefix`, `body`, `description`, `category`.
 * 2. **El de VS Code**: el objeto con el nombre como clave que usan los archivos de
 *    `contributes.snippets`, y que es el formato de `snippets/mssql.json` de la extensión.
 *
 * Se aceptan los dos porque el segundo ya existe: quien tenga snippets de SQL en un archivo de
 * VS Code puede apuntar a él como biblioteca compartida sin convertirlo. Y los de la extensión se
 * leen con el mismo código, en lugar de con un caso especial.
 *
 * ## Por qué nada de esto lanza
 *
 * Una biblioteca compartida puede estar en una ruta de red caída, o la puede haber editado alguien
 * a mano y dejado mal el JSON. Eso no puede dejar la vista inservible: se devuelve lo que se pudo
 * leer y el motivo de lo que no, y la interfaz muestra las dos cosas.
 */

/** Lo que devuelve analizar una biblioteca: lo que valía, y por qué falló lo que no. */
export interface ParsedLibrary {
    snippets: Snippet[];
    /** Motivo si el archivo entero no se pudo usar. Vacío si se pudo. */
    errorMessage: string;
    /** Entradas sueltas que se descartaron, con su motivo. */
    skipped: string[];
}

/** Forma de una entrada en el formato propio. */
interface OwnEntry {
    id?: unknown;
    name?: unknown;
    prefix?: unknown;
    body?: unknown;
    description?: unknown;
    category?: unknown;
}

/** Forma de una entrada en el formato de VS Code. */
interface VsCodeEntry {
    prefix?: unknown;
    body?: unknown;
    description?: unknown;
    scope?: unknown;
}

/** Texto, o vacío si no lo es. Nunca devuelve `undefined`: la vista no tiene que comprobar nada. */
function text(value: unknown): string {
    return typeof value === "string" ? value : "";
}

/**
 * Cuerpo de un snippet. El formato de VS Code admite una cadena **o** un array de líneas, y hay
 * archivos reales con las dos formas, así que se aceptan las dos.
 */
function bodyText(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value) && value.every((line) => typeof line === "string")) {
        return value.join("\n");
    }
    return "";
}

/**
 * Identificador estable para un snippet de solo lectura.
 *
 * No tienen `id` en el archivo, y hace falta uno para que React no reordene mal y para que la vista
 * pueda pedir «inserta este». Se deriva del origen, la biblioteca y el nombre, que es lo único
 * estable que tienen: si alguien renombra el snippet, es otro, y eso es correcto.
 */
export function readOnlyId(origin: SnippetOrigin, library: string, name: string): string {
    return `${origin}:${library}:${name}`;
}

/** `true` si el snippet se puede editar desde el panel. */
export function isEditable(snippet: Snippet): boolean {
    return snippet.origin === "own";
}

/**
 * Analiza el contenido de una biblioteca, venga en cualquiera de los dos formatos.
 *
 * @param content Texto del archivo. Se detecta el formato por la forma del JSON, no por la
 *   extensión: un `.json` puede tener cualquiera de los dos.
 * @param origin Qué es, para marcarlo y decidir si se puede editar.
 * @param library Etiqueta de la biblioteca, para poder decir de dónde viene cada snippet.
 */
export function parseLibrary(
    content: string,
    origin: SnippetOrigin,
    library: string,
): ParsedLibrary {
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        // No se incluye el mensaje de `JSON.parse`: dice la posición, que no ayuda a nadie, y puede
        // arrastrar un trozo del contenido del archivo a la interfaz.
        return { snippets: [], errorMessage: "El archivo no es JSON válido.", skipped: [] };
    }

    if (Array.isArray(parsed)) {
        return parseOwnFormat(parsed, origin, library);
    }
    if (parsed && typeof parsed === "object") {
        return parseVsCodeFormat(parsed as Record<string, unknown>, origin, library);
    }
    return {
        snippets: [],
        errorMessage: "El archivo no tiene la forma de una biblioteca de snippets.",
        skipped: [],
    };
}

/** Formato propio: un array de objetos. */
function parseOwnFormat(entries: unknown[], origin: SnippetOrigin, library: string): ParsedLibrary {
    const snippets: Snippet[] = [];
    const skipped: string[] = [];

    entries.forEach((raw, index) => {
        const entry = (raw ?? {}) as OwnEntry;
        const name = text(entry.name).trim();
        const body = bodyText(entry.body);

        // Un snippet sin nombre no se puede mostrar y uno sin cuerpo no se puede insertar. Se
        // descarta la entrada, no el archivo: el resto sigue valiendo.
        if (!name || !body) {
            skipped.push(`Entrada ${index + 1}: le falta el nombre o el cuerpo.`);
            return;
        }

        snippets.push({
            id: text(entry.id) || readOnlyId(origin, library, name),
            name,
            prefix: text(entry.prefix).trim(),
            body,
            description: text(entry.description),
            category: text(entry.category).trim(),
            origin,
            library: origin === "shared" ? library : "",
        });
    });

    return { snippets, errorMessage: "", skipped };
}

/** Formato de VS Code: el nombre es la clave. */
function parseVsCodeFormat(
    entries: Record<string, unknown>,
    origin: SnippetOrigin,
    library: string,
): ParsedLibrary {
    const snippets: Snippet[] = [];
    const skipped: string[] = [];

    for (const [name, raw] of Object.entries(entries)) {
        const entry = (raw ?? {}) as VsCodeEntry;
        const body = bodyText(entry.body);
        if (!name.trim() || !body) {
            skipped.push(`«${name}»: le falta el cuerpo.`);
            continue;
        }

        snippets.push({
            id: readOnlyId(origin, library, name),
            name: name.trim(),
            prefix: text(entry.prefix).trim(),
            body,
            description: text(entry.description),
            // El formato de VS Code no tiene categoría. Se agrupan por su origen, que es más útil
            // que dejarlos todos sin categoría.
            category: "",
            origin,
            library: origin === "shared" ? library : "",
        });
    }

    return { snippets, errorMessage: "", skipped };
}

/**
 * Serializa la biblioteca propia en el formato propio, con sangría para que se pueda editar a mano.
 *
 * Solo se guardan los propios: los compartidos y los de la extensión no son nuestros para escribir.
 */
export function serializeOwnLibrary(snippets: readonly Snippet[]): string {
    const own = snippets
        .filter((snippet) => snippet.origin === "own")
        .map((snippet) => ({
            id: snippet.id,
            name: snippet.name,
            prefix: snippet.prefix,
            body: snippet.body,
            description: snippet.description,
            category: snippet.category,
        }));
    // Con salto de línea final, para que un `git diff` de la biblioteca compartida no marque la
    // última línea en cada guardado.
    return `${JSON.stringify(own, undefined, 4)}\n`;
}

/**
 * Comprueba un snippet propio antes de guardarlo. Devuelve el motivo si no vale.
 *
 * El `prefix` **no** se valida con las reglas de identificador del 11.2: no acaba dentro de una
 * consulta, es una palabra que dispara una sugerencia en el editor. Lo que sí importa es que no
 * lleve espacios, porque VS Code filtra por la palabra que hay antes del cursor y un prefijo con
 * espacios nunca coincidiría.
 */
export function validateOwnSnippet(snippet: {
    name: string;
    prefix: string;
    body: string;
}): string | undefined {
    if (!snippet.name.trim()) {
        return "El snippet necesita un nombre.";
    }
    if (!snippet.body.trim()) {
        return "El snippet necesita un cuerpo.";
    }
    if (snippet.prefix.trim() && /\s/.test(snippet.prefix.trim())) {
        return "El prefijo no puede llevar espacios: el editor filtra por la palabra anterior al cursor.";
    }
    return undefined;
}

/**
 * Ordena para mostrar: primero los propios, luego los compartidos, luego los de la extensión, y
 * dentro de cada grupo por categoría y nombre.
 *
 * Los propios van primero a propósito: es la biblioteca que el usuario mantiene, y es lo que viene
 * a buscar. Función pura.
 */
export function sortForDisplay(snippets: readonly Snippet[]): Snippet[] {
    const rank: Record<SnippetOrigin, number> = { own: 0, shared: 1, builtin: 2 };
    return [...snippets].sort(
        (a, b) =>
            rank[a.origin] - rank[b.origin] ||
            a.library.localeCompare(b.library) ||
            a.category.localeCompare(b.category) ||
            a.name.localeCompare(b.name),
    );
}

/**
 * Texto sobre el que busca el filtro de la vista.
 *
 * Incluye el cuerpo: buscar «OVER» y encontrar el snippet de funciones de ventana es justo lo que
 * alguien espera, y el nombre no siempre lo lleva.
 */
export function searchText(snippet: Snippet): string {
    return [snippet.name, snippet.prefix, snippet.description, snippet.category, snippet.body].join(
        " ",
    );
}
