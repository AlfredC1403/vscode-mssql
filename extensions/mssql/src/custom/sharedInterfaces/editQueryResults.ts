/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Editar en línea los resultados de una consulta (FORK.md §33).
 *
 * Tipos compartidos entre el host y el webview, en la carpeta que compila en los dos `tsconfig`
 * desde M2. Igual que §31: la rejilla de resultados es del upstream y también los importa.
 */

/** Lo que la rejilla manda al host al pedir editar un conjunto de resultados. */
export interface EditQueryResultsParams {
    /** La conexión del documento de la consulta, que es también la clave del resultado. */
    ownerUri: string;
    /** Qué lote del documento produjo el conjunto: con eso se recupera su texto exacto. */
    batchId: number;
    /** Qué conjunto dentro del lote. Hoy solo se usa para el registro; el lote basta. */
    resultId: number;
}

/** Cómo acabó la petición. Solo `opened` abre algo; el resto se explican al usuario. */
export type EditQueryResultsStatus =
    /** Se abrió el editor sobre la consulta. */
    | "opened"
    /** No se pudo recuperar el texto de la consulta (documento cerrado, por ejemplo). */
    | "noQuery"
    /** El resultado no sale de ninguna tabla: columnas calculadas, `COUNT(*)`, literales… */
    | "noSource"
    /** Sale de varias tablas —una unión—, y una sesión de edición es de una sola. */
    | "severalTables"
    /** No hay conexión en ese documento, o no se pudo leer su perfil. */
    | "notConnected"
    /** Falló algo al preguntarle al servidor. `message` dice qué. */
    | "error";

export interface EditQueryResultsOutcome {
    status: EditQueryResultsStatus;
    /** Detalle para el aviso: el error del servidor, o las tablas encontradas. */
    message?: string;
}
