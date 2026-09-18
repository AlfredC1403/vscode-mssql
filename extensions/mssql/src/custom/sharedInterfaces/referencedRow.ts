/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * El registro al que apunta una clave ajena (FORK.md §31).
 *
 * Tipos compartidos entre el host y el webview. Están aquí, en `sharedInterfaces/`, porque es la
 * carpeta que compila en los dos `tsconfig` desde M2, y porque la rejilla de resultados del
 * upstream —que es quien dispara esto y quien pinta el resultado— también los importa.
 */

/** Lo que la rejilla manda al host cuando se pide ver el registro referenciado de una celda. */
export interface ReferencedRowRequestParams {
    /** La conexión del documento de la consulta. Es también la clave del resultado. */
    ownerUri: string;
    /** Posición de la columna en el conjunto, para casarla con lo que describa el servidor. */
    columnIndex: number;
    /** Nombre de la columna en el resultado, para poder decirlo cuando algo no cuadra. */
    columnName: string;
    /**
     * El valor de la celda, ya como texto.
     *
     * Viene de la rejilla y no se vuelve a leer del servidor: la rejilla ya lo tiene, y pedirlo otra
     * vez abriría la puerta a que el valor mostrado y el consultado no fueran el mismo.
     *
     * `null` es el valor `NULL` de SQL: una clave ajena nula no apunta a ninguna fila.
     */
    value: string | null;
}

/** Por qué no hay registro que enseñar, cuando no lo hay. */
export type ReferencedRowStatus =
    /** Hay fila y se muestra. */
    | "ok"
    /** La columna no participa en ninguna clave ajena. */
    | "noForeignKey"
    /** No se pudo averiguar de qué tabla sale la columna. */
    | "unknownSource"
    /** La clave ajena es de varias columnas: con una celda no se puede identificar la fila. */
    | "compositeKey"
    /** El valor de la celda es NULL, así que no apunta a nada. */
    | "nullValue"
    /** Hay clave ajena, pero la fila no está (borrada, o sin integridad declarada). */
    | "notFound"
    /** La consulta falló. `message` dice por qué. */
    | "error";

/** Un campo del registro referenciado. */
export interface ReferencedField {
    name: string;
    /** Ya formateado para mostrar. `NULL` se representa como tal, no como cadena vacía. */
    value: string;
    isNull: boolean;
    /** La columna por la que se llegó hasta aquí, para poder destacarla. */
    isMatch: boolean;
}

/** A dónde apunta la clave ajena. */
export interface ReferencedTarget {
    schema: string;
    table: string;
    column: string;
    /** Nombre de la restricción, que es lo que se busca cuando algo no cuadra. */
    constraint: string;
}

/** Lo que el host devuelve a la rejilla para que lo pinte en el globo. */
export interface ReferencedRowResult {
    status: ReferencedRowStatus;
    /** De dónde se salió: la celda sobre la que se pidió. */
    origin: {
        /** Vacíos si no se pudo averiguar la tabla de origen. */
        schema: string;
        table: string;
        column: string;
        value: string | null;
    };
    target?: ReferencedTarget;
    fields: ReferencedField[];
    /** Solo con `status: "error"` o `"unknownSource"`. */
    message?: string;
}
