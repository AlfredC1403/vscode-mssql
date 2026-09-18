/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Marca de servidor de producción (regla 11.4 del brief).
 *
 * El ajuste es **`sqlworks.productionServers`**, con `scope: "application"`. Ese `scope` no es un
 * detalle: sin él, el `.vscode/settings.json` de cualquier repositorio clonado podría **desmarcar**
 * un servidor de producción, y la marca dejaría de ser una garantía.
 *
 * ## Por qué se identifica de dos formas
 *
 * `AGENTS.md` del upstream dice que la identidad de una conexión es su id, no sus propiedades de
 * presentación, y tiene razón. Pero `profile.id` solo existe en los perfiles **guardados**: el
 * upstream lo asigna en `connectionconfig.ts` al guardar, así que una conexión escrita a mano en el
 * momento no tiene id. Un servidor de producción al que alguien se conecta sin guardar el perfil es
 * justo el caso en el que la marca importa.
 *
 * De ahí la semántica: **unión, y solo amplía**. Es producción si el id está en la lista **o** si el
 * nombre del servidor encaja con un patrón. Un patrón nunca puede quitar la marca que puso un id, ni
 * al revés. No hay forma de escribir una excepción, y es a propósito.
 */

/** Forma del ajuste. */
export interface ProductionServersSetting {
    /** Identificadores de perfiles guardados. Es la identidad estable. */
    connectionIds?: string[];
    /** Patrones sobre el nombre del servidor, con `*` como comodín. Para conexiones sin guardar. */
    serverPatterns?: string[];
}

/** Por qué se considera de producción, para poder decirlo en el tooltip. */
export interface ProductionVerdict {
    production: boolean;
    /** `id` o `patrón`, vacío si no es de producción. */
    reason: "connectionId" | "serverPattern" | "";
    /** El patrón que encajó, para mostrarlo. Vacío si la razón es el id. */
    matchedPattern: string;
}

/** Clave del ajuste, para leerlo y para enlazarlo desde la interfaz. */
export const PRODUCTION_SETTING_KEY = "sqlworks.productionServers";

/**
 * Normaliza un nombre de servidor para comparar.
 *
 * `TCP:SQL-PROD-01,1433`, `sql-prod-01` y `SQL-Prod-01` son el mismo servidor, y alguien que escriba
 * el patrón a mano no debería tener que adivinar la forma exacta. Función pura.
 */
export function normalizeServerName(server: unknown): string {
    if (typeof server !== "string") {
        return "";
    }
    let value = server.trim().toUpperCase();
    // Prefijo de protocolo: tcp:, np:, lpc:
    value = value.replace(/^(TCP|NP|LPC):/, "");
    // Puerto e instancia con coma: `servidor,1433`.
    value = value.replace(/,\s*\d+$/, "");
    return value;
}

/**
 * `true` si el nombre del servidor encaja con el patrón.
 *
 * El `*` es el único comodín, y se compara sobre los nombres normalizados. Se escapa todo lo demás,
 * así que un patrón no puede ser una expresión regular: alguien que escriba `sql-prod-.*` quiere
 * decir eso literalmente y no debería marcar media instalación por accidente. Función pura.
 */
export function serverMatchesPattern(server: string, pattern: string): boolean {
    const normalizedServer = normalizeServerName(server);
    const normalizedPattern = normalizeServerName(pattern);
    if (!normalizedServer || !normalizedPattern) {
        return false;
    }

    // Se parte por el comodín **primero** y se escapa cada trozo: así no hace falta ningún
    // carácter centinela, que es frágil —un formateador puede convertirlo en otra cosa— y además
    // podría chocar con un nombre de servidor real.
    const expression = new RegExp(
        `^${normalizedPattern
            .split("*")
            .map((piece) => piece.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`))
            .join(".*")}$`,
    );
    return expression.test(normalizedServer);
}

/**
 * Decide si el objetivo está marcado como de producción.
 *
 * Función pura: el ajuste se lee fuera y se pasa aquí, para poder probarla sin `vscode`.
 */
export function evaluateProduction(
    profileId: string | undefined,
    server: string,
    setting: ProductionServersSetting | undefined,
): ProductionVerdict {
    const ids = setting?.connectionIds ?? [];
    const patterns = setting?.serverPatterns ?? [];

    if (profileId && ids.includes(profileId)) {
        return { production: true, reason: "connectionId", matchedPattern: "" };
    }

    for (const pattern of patterns) {
        if (serverMatchesPattern(server, pattern)) {
            return { production: true, reason: "serverPattern", matchedPattern: pattern };
        }
    }

    return { production: false, reason: "", matchedPattern: "" };
}

/** `true` si el ajuste está vacío: nadie ha marcado nada, y eso hay que decirlo en la interfaz. */
export function isSettingEmpty(setting: ProductionServersSetting | undefined): boolean {
    return (
        (setting?.connectionIds?.length ?? 0) === 0 && (setting?.serverPatterns?.length ?? 0) === 0
    );
}
