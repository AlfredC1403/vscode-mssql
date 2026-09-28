/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { Strings } from "../strings";

/**
 * Aviso de que la extensión MSSQL de Microsoft está instalada junto a SQLWorks.
 *
 * ## Por qué no pueden convivir
 *
 * SQLWorks es un fork: conserva **los mismos identificadores de comando** (`mssql.runQuery`,
 * `mssql.connect`...), las mismas claves de contexto (`mssql.connections`, `mssql.hideUIElements`)
 * y la misma contribución `vscode-sql-common-features.uriOwnershipApi`. Con las dos activas:
 *
 * - La que activa segunda falla al registrar un comando que ya existe, y se queda a medias.
 * - Las dos pintan sus botones en la barra del editor, así que salen duplicados.
 * - Cada una ve a la otra como «extensión coordinadora» y le cede los archivos `.sql`: se oculta el
 *   botón de ejecutar y aparecen las variantes con la insignia «M» (`runQueryWithUriOwnership`).
 *
 * No hay arreglo desde nuestro lado que no sea renombrar todos los comandos y claves del upstream,
 * que es deuda de merge enorme. Lo razonable es decirlo en cuanto se detecta.
 *
 * ## Cómo llegaba a instalarse
 *
 * Hasta el 2026-09-28 el `package.json` del fork declaraba un `extensionPack` con Data Workspace,
 * SQL Database Projects y SQL Bindings, y las dos primeras declaran `ms-mssql.mssql` en su
 * `extensionDependencies`. Instalar SQLWorks arrastraba así la extensión de Microsoft. Ver FORK.md
 * §29.
 *
 * Se llama **al principio** de la activación, antes que nada del upstream: si la de Microsoft activó
 * primero, lo del upstream revienta al registrar sus comandos y nunca se llegaría a `registerCustom`.
 */

/** Las extensiones que chocan con SQLWorks. */
export const CONFLICTING_EXTENSION_IDS: readonly string[] = ["ms-mssql.mssql"];

/** Búsqueda del panel de extensiones que enseña la de Microsoft y las que dependen de ella. */
export const CONFLICT_SEARCH_QUERY = "@installed ms-mssql";

/**
 * De una lista de identificadores instalados, los que chocan. Pura, para poder probarla.
 *
 * La comparación ignora mayúsculas porque VS Code no distingue entre `ms-mssql.mssql` y
 * `MS-MSSQL.mssql` al instalar.
 */
export function findConflictingExtensions(installedIds: readonly string[]): string[] {
    const conflicting = new Set(CONFLICTING_EXTENSION_IDS.map((id) => id.toLowerCase()));
    return installedIds.filter((id) => conflicting.has(id.toLowerCase()));
}

/**
 * Comprueba al activar y avisa si hay alguna. No bloquea nada ni puede tumbar la activación.
 */
export function warnAboutConflictingExtensions(): void {
    try {
        const found = findConflictingExtensions(vscode.extensions.all.map((ext) => ext.id));
        if (found.length === 0) {
            return;
        }
        const action = Strings.conflictWatch.showExtensions;
        void vscode.window
            .showErrorMessage(Strings.conflictWatch.microsoftMssqlInstalled, action)
            .then((choice) => {
                if (choice === action) {
                    void vscode.commands.executeCommand(
                        "workbench.extensions.search",
                        CONFLICT_SEARCH_QUERY,
                    );
                }
            });
    } catch {
        // Un fallo aquí no puede impedir que la extensión arranque.
    }
}
