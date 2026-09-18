/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { FormatOption, FormatProfile } from "../sharedInterfaces/formatProfiles";
import { OPTION_PREFIX, deviationsFromDefaults, fitsOption } from "./schema";
import { Strings } from "../strings";

/**
 * Perfiles de formato: dónde viven y cómo se aplican (M8).
 *
 * ## Por qué en `settings.json` y no en un archivo XML propio
 *
 * El brief pedía un perfil XML. **No se hace**, y la razón es medida, no de gusto:
 *
 * 1. El esquema de las 55 opciones ya está en el `package.json` del upstream, con tipos, valores y
 *    descripciones. Un XML sería una segunda descripción de lo mismo, escrita a mano, que se queda
 *    desfasada cada vez que el upstream añade una opción — y acaba de añadir 56 de golpe.
 * 2. Un XML sería una **capa sobre `settings.json`**, no la fuente de verdad, porque el formateador
 *    solo lee de la configuración sincronizada del LSP (medido: las opciones pasadas en la petición
 *    `textDocument/formatting` **se ignoran**; las que llegan por `didChangeConfiguration` **se
 *    respetan**). Una capa que no es la fuente de verdad es un problema de sincronización esperando.
 * 3. Compartir en equipo ya está resuelto por VS Code: un `.vscode/settings.json` en el repositorio.
 *    Un XML añadiría un paso de importación y exportación para llegar al mismo sitio.
 *
 * Lo que VS Code **no** da, y es lo que de verdad pedía el brief, son **perfiles con nombre entre
 * los que cambiar de un clic**. Eso es lo que hay aquí, en un ajuste propio, en el formato que el
 * editor ya sabe leer, editar, validar y sincronizar. Ver FORK.md §25.
 */

/** Clave del ajuste con los perfiles. */
export const PROFILES_SETTING = "sqlworks.format.profiles";

/** Resultado de leer los perfiles: los válidos, y los avisos de lo que se descartó. */
export interface LoadedProfiles {
    profiles: FormatProfile[];
    warnings: string[];
}

/**
 * Lee los perfiles del ajuste.
 *
 * El ajuste lo puede haber editado alguien a mano en un `settings.json` compartido, así que nada de
 * esto lanza: lo que no encaje se descarta con su aviso y el resto sigue valiendo. Los valores se
 * comprueban contra el esquema del upstream, no contra una lista nuestra.
 */
export function readProfiles(options: readonly FormatOption[]): LoadedProfiles {
    const configured = vscode.workspace.getConfiguration().get<unknown>(PROFILES_SETTING);
    const warnings: string[] = [];
    const profiles: FormatProfile[] = [];

    if (configured === undefined || configured === null) {
        return { profiles, warnings };
    }
    if (typeof configured !== "object" || Array.isArray(configured)) {
        return { profiles, warnings: [Strings.format.profilesNotAnObject] };
    }

    const byName = new Map(options.map((option) => [option.name, option]));

    for (const [name, raw] of Object.entries(configured as Record<string, unknown>)) {
        if (!name.trim()) {
            continue;
        }
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            warnings.push(Strings.format.profileNotAnObject(name));
            continue;
        }

        const values: Record<string, boolean | string | number> = {};
        const ignored: string[] = [];
        for (const [option, value] of Object.entries(raw as Record<string, unknown>)) {
            const declared = byName.get(option);
            if (!declared || !fitsOption(value, declared)) {
                // Puede ser una opción que el upstream renombró o quitó, o un valor mal escrito.
                // Se ignora esa entrada, no el perfil entero.
                ignored.push(option);
                continue;
            }
            values[option] = value as boolean | string | number;
        }

        if (ignored.length > 0) {
            warnings.push(Strings.format.profileIgnoredOptions(name, ignored.join(", ")));
        }
        profiles.push({ name: name.trim(), values });
    }

    profiles.sort((a, b) => a.name.localeCompare(b.name));
    return { profiles, warnings };
}

/**
 * Guarda los perfiles en el ajuste, en el ámbito de usuario.
 *
 * Los perfiles son de la persona; compartirlos con un equipo se hace copiando el ajuste a un
 * `.vscode/settings.json`, que es la forma que VS Code ya tiene para eso. Devuelve el motivo si no
 * se pudo.
 */
export async function writeProfiles(
    profiles: readonly FormatProfile[],
): Promise<string | undefined> {
    const value: Record<string, Record<string, boolean | string | number>> = {};
    for (const profile of profiles) {
        value[profile.name] = profile.values;
    }
    try {
        await vscode.workspace
            .getConfiguration()
            .update(PROFILES_SETTING, value, vscode.ConfigurationTarget.Global);
        return undefined;
    } catch (error) {
        return error instanceof Error ? error.message : Strings.format.saveProfilesFailed;
    }
}

/** Lo que está aplicado ahora mismo en los ajustes del upstream. */
export function readAppliedValues(
    options: readonly FormatOption[],
): Record<string, boolean | string | number> {
    const configuration = vscode.workspace.getConfiguration();
    const values: Record<string, boolean | string | number> = {};
    for (const option of options) {
        const value = configuration.get<unknown>(option.key);
        values[option.name] = fitsOption(value, option)
            ? (value as boolean | string | number)
            : option.defaultValue;
    }
    return values;
}

/**
 * Escribe los valores en los ajustes del upstream (`mssql.format.options.*`).
 *
 * **Es el único mecanismo que funciona**, y está medido: el STS ignora las opciones que van en la
 * petición `textDocument/formatting` y solo respeta las que llegan por `didChangeConfiguration`, que
 * es lo que el cliente LSP sincroniza desde la configuración (§8.1 y §25.1). Así que aplicar un
 * perfil es, literalmente, escribir los ajustes del upstream: el fork **no sustituye** el
 * formateador, lo configura.
 *
 * Solo se escribe lo que **se desvía** del valor por omisión; el resto se borra del `settings.json`
 * en lugar de dejarlo escrito con su propio valor por omisión. Sin eso, aplicar un perfil dejaría 56
 * líneas en el archivo, la mayoría diciendo lo que ya dice el upstream, y un `git diff` no
 * distinguiría lo elegido de lo heredado.
 */
export async function applyValues(
    values: Record<string, boolean | string | number>,
    options: readonly FormatOption[],
    scope: "user" | "workspace",
): Promise<string | undefined> {
    const target =
        scope === "workspace"
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global;
    const deviations = deviationsFromDefaults(values, options);
    const configuration = vscode.workspace.getConfiguration();

    try {
        for (const option of options) {
            const value = deviations[option.name];
            // `undefined` borra la clave del `settings.json` y deja que valga la del upstream.
            await configuration.update(option.key, value, target);
        }
        return undefined;
    } catch (error) {
        return error instanceof Error ? error.message : Strings.format.applyFailed;
    }
}

/** Nombre de opción → clave completa del ajuste. */
export function keyFor(name: string): string {
    return `${OPTION_PREFIX}${name}`;
}
