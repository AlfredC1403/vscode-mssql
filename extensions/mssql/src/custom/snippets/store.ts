/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { Snippet } from "../sharedInterfaces/snippets";
import { parseLibrary, serializeOwnLibrary, sortForDisplay } from "./library";
import { Strings } from "../strings";

/**
 * Lectura y escritura de las bibliotecas de snippets (M7). Es la única parte que toca el disco;
 * el análisis y la normalización son puros y viven en `library.ts`.
 *
 * ## Dónde vive cada cosa, y por qué
 *
 * - **La biblioteca propia**, en `context.globalStorageUri/snippets.json`. Global y no del espacio
 *   de trabajo: es la biblioteca de la persona, y tenerla por proyecto significaría volver a
 *   escribirla en cada repositorio. No va en `settings.json` porque un cuerpo de T-SQL de veinte
 *   líneas dentro de un ajuste es incómodo de editar y ensucia un archivo que se comparte.
 * - **Las compartidas**, en las rutas del ajuste `sqlworks.snippets.sharedLibraries`. Son de
 *   **solo lectura** desde el panel: editar desde aquí el archivo que usa todo un equipo sería una
 *   sorpresa desagradable. Quien las mantenga lo hace con su editor y su control de versiones.
 * - **Las de la extensión**, `snippets/mssql.json`, que ya se distribuye en el `.vsix`. Se leen
 *   para que la vista sea **el único sitio donde buscar** un snippet, en lugar de tener que
 *   recordar cuáles salen en la autocompletación y cuáles están en la lista.
 *
 * Nada de esto lanza: una ruta de red caída devuelve su aviso y la vista sigue funcionando con el
 * resto.
 */

/** Clave del ajuste con las rutas de las bibliotecas compartidas. */
export const SHARED_LIBRARIES_SETTING = "sqlworks.snippets.sharedLibraries";

/** Resultado de leer todo: lo que hay, y los avisos de lo que no se pudo leer. */
export interface LoadedLibraries {
    snippets: Snippet[];
    /** Un aviso por biblioteca que falló, ya listo para mostrar. */
    warnings: string[];
}

export class SnippetStore {
    constructor(private readonly context: vscode.ExtensionContext) {}

    /** Ruta del archivo de la biblioteca propia. Se muestra en la interfaz. */
    public get ownLibraryUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.context.globalStorageUri, "snippets.json");
    }

    /**
     * Lee las tres fuentes.
     *
     * Los propios van primero en la lista final, que es lo que `sortForDisplay` garantiza.
     */
    public async loadAll(): Promise<LoadedLibraries> {
        const warnings: string[] = [];
        const snippets: Snippet[] = [];

        // --- Propia ---
        const own = await this.readFile(this.ownLibraryUri);
        if (own.content !== undefined) {
            const parsed = parseLibrary(own.content, "own", "");
            if (parsed.errorMessage) {
                // Un JSON propio roto sí merece aviso destacado: lo editó la persona y va a querer
                // arreglarlo. No se sobrescribe el archivo, que perdería su trabajo.
                warnings.push(Strings.snippets.ownLibraryBroken(parsed.errorMessage));
            }
            snippets.push(...parsed.snippets);
            warnings.push(...parsed.skipped.map((reason) => Strings.snippets.ownSkipped(reason)));
        }
        // Si no existe todavía no es un problema: es una biblioteca vacía.

        // --- Compartidas ---
        for (const path of readSharedPaths()) {
            const uri = vscode.Uri.file(path);
            const label = labelFor(path);
            const shared = await this.readFile(uri);
            if (shared.content === undefined) {
                warnings.push(Strings.snippets.sharedUnreadable(label));
                continue;
            }
            const parsed = parseLibrary(shared.content, "shared", label);
            if (parsed.errorMessage) {
                warnings.push(Strings.snippets.sharedBroken(label, parsed.errorMessage));
                continue;
            }
            snippets.push(...parsed.snippets);
        }

        // --- De la extensión ---
        const builtinUri = vscode.Uri.joinPath(this.context.extensionUri, "snippets", "mssql.json");
        const builtin = await this.readFile(builtinUri);
        if (builtin.content !== undefined) {
            snippets.push(...parseLibrary(builtin.content, "builtin", "").snippets);
        }
        // Si falta, no se avisa: es un recurso de la extensión y su ausencia no es cosa del usuario.

        return { snippets: sortForDisplay(snippets), warnings };
    }

    /**
     * Guarda la biblioteca propia.
     *
     * Crea el directorio si no existe: `globalStorageUri` **no está creado** hasta que alguien
     * escribe algo, y `writeFile` sobre un directorio que falta falla.
     */
    public async saveOwn(snippets: readonly Snippet[]): Promise<string | undefined> {
        try {
            await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
            await vscode.workspace.fs.writeFile(
                this.ownLibraryUri,
                Buffer.from(serializeOwnLibrary(snippets), "utf8"),
            );
            return undefined;
        } catch (error) {
            return error instanceof Error ? error.message : Strings.snippets.saveFailed;
        }
    }

    /** Lee un archivo. `content: undefined` significa que no se pudo, sin decir por qué aquí. */
    private async readFile(uri: vscode.Uri): Promise<{ content?: string }> {
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            return { content: Buffer.from(bytes).toString("utf8") };
        } catch {
            return {};
        }
    }
}

/** Rutas de las bibliotecas compartidas, saneadas: sin vacíos y sin repetidas. */
export function readSharedPaths(): string[] {
    const configured = vscode.workspace.getConfiguration().get<unknown>(SHARED_LIBRARIES_SETTING);
    if (!Array.isArray(configured)) {
        return [];
    }
    const seen = new Set<string>();
    const paths: string[] = [];
    for (const value of configured) {
        if (typeof value !== "string") {
            continue;
        }
        const path = value.trim();
        if (path && !seen.has(path)) {
            seen.add(path);
            paths.push(path);
        }
    }
    return paths;
}

/** Etiqueta corta de una biblioteca compartida: el nombre del archivo, sin la ruta. */
export function labelFor(path: string): string {
    const parts = path.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] ?? path;
}
