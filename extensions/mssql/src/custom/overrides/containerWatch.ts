/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import { Strings } from "../strings";

/**
 * Vigilancia del **camino de contenedor** de Data API Builder (M10).
 *
 * ## El hueco que esto cierra, y el que no
 *
 * `overrides/networkWatch.ts` vigila las dos claves del camino de la **CLI** de DAB, que es el que
 * trajo el merge de M9. Pero FORK.md §27.6 deja escrito que ése no es el camino abierto: el del
 * **contenedor** es más viejo que M9, **no cuelga de ningún ajuste**, se alcanza con el botón
 * «Deploy» de la barra de DAB, descarga la imagen `mcr.microsoft.com/azure-databases/data-api-builder`
 * y —esto es lo que importa— escribe la **cadena de conexión completa, con contraseña**, en un
 * archivo temporal.
 *
 * Medido leyendo el upstream, no supuesto (`src/services/dabService.ts`):
 *
 * - El directorio es `os.tmpdir()/dab-<uuid>` (línea 649), y dentro va el `dab-config.json` con
 *   `mode: 0o600` (línea 658).
 * - La cadena la construye `Dab.buildDabCliConnectionString(connectionInfo.connectionString, ...)`
 *   (línea 449) **sin** la indirección `@env('DAB_CONNECTION_STRING')` que sí usa el camino de la
 *   CLI (línea 284). O sea: en el contenedor la contraseña va en claro dentro del archivo.
 * - El upstream borra el archivo y el directorio al terminar (líneas 676-680), **con `.catch(() => {})`**.
 *   Si VS Code muere antes, o el borrado falla, el archivo se queda.
 *
 * Por eso hay dos avisos distintos, y no uno:
 *
 * | Cuándo               | Qué significa                                                              |
 * | -------------------- | -------------------------------------------------------------------------- |
 * | Al activar           | Quedan restos de una vez anterior: **hay una contraseña en disco ahora**    |
 * | Mientras se trabaja  | El camino de contenedor **se está usando en este momento**                  |
 *
 * ## Lo que deliberadamente no hace
 *
 * - **No abre ninguno de esos archivos.** Mira el nombre del directorio y nada más. Un control que
 *   leyera el archivo para «confirmar» que hay una contraseña sería el mismo problema que denuncia.
 * - **No borra nada.** Borrar el directorio de un despliegue en marcha lo rompería, y el fork no
 *   sabe si hay uno en marcha. El aviso dice la ruta; borrarlo es decisión de la persona.
 * - **No apaga la función ni toca `src/dab/`.** Mismo criterio que (d) en §27.3: cero anclajes
 *   nuevos, cero archivos del upstream. Vive en `src/custom/` y lo arranca `registerCustom`.
 */

/**
 * Nombre de directorio que crea el camino de contenedor: `dab-` más un UUID v4.
 *
 * Se exige la forma completa del UUID en lugar de conformarse con el prefijo `dab-` porque
 * `os.tmpdir()` es de todo el mundo: cualquiera puede dejar ahí un `dab-loquesea`, y un aviso que
 * salta con el directorio de otro programa deja de leerse.
 */
const DAB_TEMP_DIR = /^dab-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ¿Es el nombre de un directorio temporal del camino de contenedor de DAB? Pura. */
export function isDabTempDirName(name: string): boolean {
    return DAB_TEMP_DIR.test(name);
}

/** Qué se vio, para decidir qué aviso toca. */
export type SpillKind =
    /** Ya estaba al arrancar: el borrado del upstream no llegó a correr. */
    | "leftover"
    /** Apareció con el fork ya activo: alguien está desplegando ahora mismo. */
    | "live";

/** Un directorio temporal de DAB encontrado, con su ruta absoluta. */
export interface Spill {
    kind: SpillKind;
    directory: string;
}

/**
 * Los restos que ya había al arrancar. Pura respecto a `vscode`: solo toca el sistema de archivos.
 *
 * No distingue «de esta sesión» de «de hace un mes» a propósito: los dos casos significan lo mismo
 * —hay un archivo con una contraseña donde no debería—, y la fecha no cambia qué hacer.
 *
 * @param tmpDir Directorio a mirar. Parámetro, y no `os.tmpdir()` dentro, para poder probarlo.
 */
export function findLeftoverSpills(tmpDir: string): Spill[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(tmpDir, { withFileTypes: true });
    } catch {
        // Un `tmpdir` ilegible no es un hallazgo: es un entorno raro, y el fork sigue.
        return [];
    }
    return entries
        .filter((entry) => entry.isDirectory() && isDabTempDirName(entry.name))
        .map((entry) => ({ kind: "leftover" as const, directory: path.join(tmpDir, entry.name) }));
}

/**
 * Arranca la vigilancia del camino de contenedor.
 *
 * Dos partes, por las dos cosas que se quieren ver:
 *
 * 1. Un barrido al activar, para los restos.
 * 2. Un `fs.watch` sobre `tmpdir` **no recursivo**, para los que aparezcan después. No recursivo es
 *    deliberado: lo que se vigila es la creación del directorio, no lo que se escriba dentro, y un
 *    vigilante recursivo sobre el temporal de toda la máquina sería caro y ruidoso.
 *
 * `fs.watch` puede fallar por motivos del sistema —en Linux, el límite de `inotify`— y eso no puede
 * tumbar el arranque del fork: si falla, queda el barrido, que es la parte que encuentra lo que de
 * verdad importa.
 *
 * @param options.tmpDir Directorio a vigilar. Por omisión, el temporal del sistema.
 * @param options.onSpill Qué hacer con cada hallazgo. Por omisión, avisar en la interfaz.
 */
export function watchContainerSpills(
    options: { tmpDir?: string; onSpill?: (spill: Spill) => void } = {},
): vscode.Disposable {
    const tmpDir = options.tmpDir ?? os.tmpdir();
    const report = options.onSpill ?? showSpillWarning;

    // Un directorio avisado no se vuelve a avisar: `fs.watch` emite varios eventos por el mismo
    // nombre (crear el directorio, y de nuevo al escribir dentro en algunas plataformas).
    const seen = new Set<string>();

    const announce = (spill: Spill): void => {
        if (seen.has(spill.directory)) {
            return;
        }
        seen.add(spill.directory);
        report(spill);
    };

    for (const spill of findLeftoverSpills(tmpDir)) {
        announce(spill);
    }

    let watcher: fs.FSWatcher | undefined;
    try {
        watcher = fs.watch(tmpDir, { persistent: false }, (_event, filename) => {
            if (typeof filename !== "string" || !isDabTempDirName(filename)) {
                return;
            }
            const directory = path.join(tmpDir, filename);
            try {
                // El evento también salta al borrarlo, y un borrado no es un hallazgo.
                if (!fs.statSync(directory).isDirectory()) {
                    return;
                }
            } catch {
                return;
            }
            announce({ kind: "live", directory });
        });
    } catch {
        // Sin vigilante en vivo. El barrido de arriba ya se hizo, y es el que encuentra los restos.
    }

    return new vscode.Disposable(() => watcher?.close());
}

/** El aviso, con el texto que corresponde a cada caso. */
function showSpillWarning(spill: Spill): void {
    void vscode.window.showWarningMessage(
        spill.kind === "leftover"
            ? Strings.containerWatch.leftover(spill.directory)
            : Strings.containerWatch.live(spill.directory),
    );
}
