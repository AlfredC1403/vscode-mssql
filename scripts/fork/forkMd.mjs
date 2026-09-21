/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Lo que las dos herramientas del fork necesitan leer de `FORK.md` y de git (M10).
 *
 * `FORK.md` no es solo documentación: la fila «Último merge con el upstream» y la primera columna
 * de la tabla del §0 son **datos**, y las dos herramientas de `scripts/fork/` los leen de ahí en
 * lugar de llevar su propia copia. Así una tabla desactualizada se nota, que es el punto.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Raíz del monorepo, deducida de la ubicación de este archivo. */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const FORK_MD = "FORK.md";

/**
 * Extensiones que identifican una ruta dentro de una celda de la tabla.
 *
 * Cerrada a propósito: sin ella, `1.46.0` y `sqlworks.openAdminPanel` pasarían por rutas.
 */
const KNOWN_EXTENSION = /\.(ts|tsx|js|mjs|cjs|json|md|png|jpg|jpeg|gif|txt|yml|yaml)$/;

/** `git` en la raíz del repositorio, devolviendo texto. Lanza si el comando falla. */
export function git(...args) {
    return execFileSync("git", args, {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    });
}

/** `git` que no lanza: devuelve `undefined` si el comando falla. */
export function tryGit(...args) {
    try {
        return git(...args);
    } catch {
        return undefined;
    }
}

/** El contenido de `FORK.md`. */
export function readForkMd() {
    return readFileSync(path.join(repoRoot, FORK_MD), "utf8");
}

/**
 * El commit del upstream contra el que se mide, leído de la tabla de cabecera de `FORK.md`.
 *
 * Sale de ahí, y no de `upstream/main`, a propósito: si alguien integra el upstream y no actualiza
 * esa fila, las herramientas se rompen. Es la disciplina que pide el punto 5 del §12.
 *
 * @param options.requireInHistory Comprobar además que el commit esté en esta historia.
 * @returns El commit, o `undefined` si la fila no está.
 */
export function readBaseline(forkMd, options = {}) {
    const row = forkMd.match(/\*\*Último merge con el upstream\*\*.*?`([0-9a-f]{7,40})`/);
    if (!row) {
        return undefined;
    }
    if (options.requireInHistory && tryGit("cat-file", "-e", `${row[1]}^{commit}`) === undefined) {
        return undefined;
    }
    return row[1];
}

/**
 * Las rutas que la tabla del §0 declara, leídas de la **primera columna** de sus filas.
 *
 * Solo la primera columna, y no toda la sección, porque el texto de las otras cita rutas de
 * ejemplo —`.vscode/settings.json`, `src/webviews`— que no son archivos nuestros. Un lector más
 * permisivo daría por declarado lo que solo está mencionado, que es justo lo contrario de lo que
 * la auditoría quiere comprobar.
 *
 * Las filas se leen una a una en lugar de con un lector de tablas, porque el §0 tiene filas sueltas
 * fuera del bloque principal: las que M2, M5, M7, M8 y M9 fueron añadiendo.
 */
export function readDeclaredPaths(forkMd) {
    const section = forkMd.slice(
        forkMd.indexOf("## 0. Archivos del upstream modificados"),
        forkMd.indexOf("## 1. Estructura del repositorio"),
    );
    const declared = new Set();
    for (const line of section.split("\n")) {
        if (!line.startsWith("|")) {
            continue;
        }
        const quoted = (line.split("|")[1] ?? "").match(/`([^`]+)`/);
        if (quoted && KNOWN_EXTENSION.test(quoted[1])) {
            declared.add(quoted[1]);
        }
    }
    return declared;
}
