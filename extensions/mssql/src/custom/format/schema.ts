/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { FormatOption, FormatOptionKind } from "../sharedInterfaces/formatProfiles";

/**
 * El esquema de las opciones del formateador, **leído del `package.json` del upstream**.
 *
 * ## Por qué así y no con una lista escrita a mano
 *
 * El upstream declara hoy **56 ajustes `mssql.format.*`**, cada uno con su tipo, sus valores
 * posibles, su valor por omisión y su descripción. Eso ya es un esquema legible por máquina, y
 * mejor que cualquiera que escribiéramos nosotros.
 *
 * Una lista propia tendría que mantenerse a mano, y el formateador del upstream **se mueve**: las
 * 56 opciones entraron de golpe en dos commits de hace unos días (§8). Cada opción nueva sería una
 * línea que hay que recordar añadir, y cada renombrado un fallo silencioso. Leyendo el `package.json`
 * en tiempo de ejecución, una opción nueva aparece en el panel sola, con su tipo y su descripción.
 *
 * Es también la razón por la que el fork **no** define un formato de perfil propio en XML: todo lo
 * que ese XML describiría ya está descrito aquí, y mejor. Ver FORK.md §25.
 *
 * Este archivo es puro: recibe el objeto de `contributes.configuration.properties` y no toca
 * `vscode`, así que se puede probar con un `package.json` de mentira.
 */

/** Prefijo de las opciones que van a un perfil. */
export const OPTION_PREFIX = "mssql.format.options.";

/**
 * Ajustes de `mssql.format.*` que **no** son opciones de formato y no entran en un perfil.
 *
 * `showParseErrorNotification` controla si se avisa cuando el T-SQL no se puede analizar: es una
 * preferencia de la persona sobre las notificaciones, no una regla de estilo, y compartirla en un
 * perfil de equipo no tendría sentido.
 */
const NOT_STYLE = new Set(["mssql.format.showParseErrorNotification"]);

/** Forma mínima de una propiedad declarada en `contributes.configuration.properties`. */
interface DeclaredProperty {
    type?: unknown;
    enum?: unknown;
    default?: unknown;
    description?: unknown;
    markdownDescription?: unknown;
}

/**
 * Lee el esquema. Devuelve las opciones ordenadas por grupo y nombre.
 *
 * Lo que no se entiende **se descarta en silencio**: si el upstream añade una opción con un tipo
 * que este panel no sabe pintar, es mejor no mostrarla que mostrar un control que miente. Lo que no
 * se puede es inventarse un control genérico y escribir un valor que el formateador no entienda.
 */
export function readFormatSchema(properties: unknown): FormatOption[] {
    if (!properties || typeof properties !== "object") {
        return [];
    }

    const options: FormatOption[] = [];
    for (const [key, raw] of Object.entries(properties as Record<string, unknown>)) {
        if (!key.startsWith(OPTION_PREFIX) || NOT_STYLE.has(key)) {
            continue;
        }
        const declared = (raw ?? {}) as DeclaredProperty;
        const kind = kindOf(declared);
        if (!kind) {
            continue;
        }

        const name = key.slice(OPTION_PREFIX.length);
        const choices =
            kind === "enum"
                ? (declared.enum as unknown[]).filter(
                      (choice): choice is string => typeof choice === "string",
                  )
                : [];

        // Un enum sin opciones válidas no se puede pintar.
        if (kind === "enum" && choices.length === 0) {
            continue;
        }

        const defaultValue = defaultOf(declared, kind, choices);
        if (defaultValue === undefined) {
            continue;
        }

        options.push({
            key,
            name,
            kind,
            description: textOf(declared.description) || textOf(declared.markdownDescription),
            defaultValue,
            choices,
            group: groupOf(name),
        });
    }

    return options.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

/** Qué control necesita la opción, o `undefined` si no se sabe pintar. */
function kindOf(declared: DeclaredProperty): FormatOptionKind | undefined {
    if (Array.isArray(declared.enum)) {
        return "enum";
    }
    if (declared.type === "boolean") {
        return "boolean";
    }
    if (declared.type === "integer" || declared.type === "number") {
        return "integer";
    }
    return undefined;
}

/** El valor por omisión, ya comprobado contra el tipo. `undefined` si no encaja. */
function defaultOf(
    declared: DeclaredProperty,
    kind: FormatOptionKind,
    choices: string[],
): boolean | string | number | undefined {
    const value = declared.default;
    if (kind === "boolean") {
        return typeof value === "boolean" ? value : undefined;
    }
    if (kind === "integer") {
        return typeof value === "number" ? value : undefined;
    }
    // Un enum cuyo valor por omisión no está entre sus opciones sería una declaración incoherente
    // del upstream; se descarta en lugar de pintar un desplegable sin selección.
    return typeof value === "string" && choices.includes(value) ? value : undefined;
}

function textOf(value: unknown): string {
    return typeof value === "string" ? value : "";
}

/**
 * Grupo de la opción, deducido de su nombre.
 *
 * Los nombres del upstream son descriptivos y regulares (`newLineBeforeFromClause`,
 * `multilineWherePredicatesList`, `keywordCasing`), así que agrupar por prefijo da una interfaz
 * navegable sin mantener un mapa a mano —que es lo que se está evitando en todo este archivo—.
 */
export function groupOf(name: string): string {
    if (/Casing$/.test(name)) {
        return "Mayúsculas y minúsculas";
    }
    if (name.startsWith("newLineBefore") || name.startsWith("newLineAfter")) {
        return "Saltos de línea";
    }
    if (name.startsWith("multiline")) {
        return "Listas en varias líneas";
    }
    if (name.startsWith("align") || name.includes("Alignment")) {
        return "Alineación";
    }
    if (name.startsWith("indent") || name.includes("Indent")) {
        return "Sangría";
    }
    if (name.startsWith("space") || name.startsWith("num")) {
        return "Espaciado";
    }
    if (name.startsWith("sql") || name === "identifierBracketing") {
        return "Dialecto";
    }
    return "Otras";
}

/**
 * Los valores que se desvían de lo que declara el upstream.
 *
 * Un perfil guarda **solo las desviaciones**, no las 56 opciones. Así un perfil se lee de un vistazo
 * («este pone las comas al inicio y nada más»), un `git diff` de `settings.json` dice algo, y una
 * opción nueva del upstream no queda congelada con su valor de hoy en todos los perfiles guardados.
 * Función pura.
 */
export function deviationsFromDefaults(
    values: Record<string, boolean | string | number>,
    options: readonly FormatOption[],
): Record<string, boolean | string | number> {
    const deviations: Record<string, boolean | string | number> = {};
    for (const option of options) {
        const value = values[option.name];
        if (value !== undefined && value !== option.defaultValue) {
            deviations[option.name] = value;
        }
    }
    return deviations;
}

/** Los valores por omisión del upstream, como mapa completo. Función pura. */
export function defaultValues(
    options: readonly FormatOption[],
): Record<string, boolean | string | number> {
    const values: Record<string, boolean | string | number> = {};
    for (const option of options) {
        values[option.name] = option.defaultValue;
    }
    return values;
}

/**
 * Mezcla un perfil sobre los valores por omisión, descartando lo que no encaje con el esquema.
 *
 * Un perfil puede venir de un `settings.json` compartido que alguien editó a mano, o de una versión
 * anterior de la extensión con opciones que ya no existen. Lo que no esté en el esquema, o no case
 * con el tipo, se ignora: escribir un valor que el formateador no entiende no arregla nada.
 * Función pura.
 */
export function mergeProfile(
    profileValues: Record<string, unknown>,
    options: readonly FormatOption[],
): { values: Record<string, boolean | string | number>; ignored: string[] } {
    const values = defaultValues(options);
    const ignored: string[] = [];
    const byName = new Map(options.map((option) => [option.name, option]));

    for (const [name, value] of Object.entries(profileValues ?? {})) {
        const option = byName.get(name);
        if (!option || !fitsOption(value, option)) {
            ignored.push(name);
            continue;
        }
        values[name] = value as boolean | string | number;
    }

    return { values, ignored };
}

/** `true` si el valor encaja con el tipo declarado de la opción. */
export function fitsOption(value: unknown, option: FormatOption): boolean {
    if (option.kind === "boolean") {
        return typeof value === "boolean";
    }
    if (option.kind === "integer") {
        return typeof value === "number" && Number.isInteger(value);
    }
    return typeof value === "string" && option.choices.includes(value);
}
