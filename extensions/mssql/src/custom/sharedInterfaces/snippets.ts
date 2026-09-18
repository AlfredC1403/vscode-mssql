/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Contrato de la vista de snippets (M7). Cruza el puente host ↔ webview, así que **no importa
 * `vscode`** ni nada del host.
 */

import { CustomWebviewKind, CustomWebviewStateBase } from "./customWebview";

/** De dónde sale un snippet. Decide si se puede editar y cómo se marca en la interfaz. */
export type SnippetOrigin =
    /** La biblioteca propia del usuario, en el almacenamiento global. Se puede editar. */
    | "own"
    /** Una biblioteca compartida por ruta, para un equipo. Solo lectura. */
    | "shared"
    /** Los que trae la extensión (`snippets/mssql.json`). Solo lectura. */
    | "builtin";

/** Un snippet, tal como lo pinta la vista. */
export interface Snippet {
    /**
     * Identificador estable dentro de su origen.
     *
     * Para los propios lo pone el host al crearlos; para los de solo lectura se deriva del nombre
     * y del origen, que es lo único estable que tienen.
     */
    id: string;
    /** Nombre que se muestra. */
    name: string;
    /** Palabra que lo dispara en el editor. Puede estar vacía en los de solo lectura. */
    prefix: string;
    /** Cuerpo en sintaxis de snippet de VS Code: `$1`, `${2:valor}`. */
    body: string;
    /** Para qué sirve, en una línea. */
    description: string;
    /** Agrupación libre, para el filtro. Vacía significa «sin categoría». */
    category: string;
    origin: SnippetOrigin;
    /** Etiqueta de la biblioteca compartida de la que viene. Vacía si no es compartido. */
    library: string;
}

/** Estado de la vista. */
export interface SnippetsState extends CustomWebviewStateBase {
    view: CustomWebviewKind.Snippets;
    snippets: Snippet[];
    /** `true` mientras se está leyendo del disco. */
    loading: boolean;
    /** Problema de lectura, ya listo para mostrar. Vacío si no hay. */
    errorMessage: string;
    /** Ruta del archivo de la biblioteca propia, para poder decir dónde está. */
    ownLibraryPath: string;
    /**
     * Avisos por biblioteca compartida que no se pudo leer. Se muestran sin tapar el resto: una
     * ruta de red caída no puede dejar la vista inservible.
     */
    sharedWarnings: string[];
    /** `true` si hay un editor SQL donde insertar. Decide si el botón de insertar está activo. */
    hasSqlEditor: boolean;
}

/** Lo que el webview puede pedir al host. */
export interface SnippetsReducers {
    /** Vuelve a leer todas las bibliotecas. */
    reload: Record<string, never>;
    /** Inserta el cuerpo en el editor SQL activo, respetando los tabuladores. */
    insert: { id: string };
    /** Copia el cuerpo al portapapeles. */
    copy: { id: string };
    /** Crea o actualiza un snippet propio. `id` vacío significa crear. */
    save: {
        id: string;
        name: string;
        prefix: string;
        body: string;
        description: string;
        category: string;
    };
    /** Borra un snippet propio. Pide confirmación en el host. */
    remove: { id: string };
    /** Copia un snippet de solo lectura a la biblioteca propia, para poder tocarlo. */
    duplicateToOwn: { id: string };
    /** Abre el archivo de la biblioteca propia en un editor, para editar en bloque. */
    openLibraryFile: Record<string, never>;
}
