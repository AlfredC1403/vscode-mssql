/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * El identificador que se está escribiendo alrededor del cursor.
 *
 * Funciones puras, sin `vscode`: la parte que habla con el editor vive en
 * `completionMiddleware.ts`. Aquí solo se corta texto, que es lo único que hay que fijar con tests.
 *
 * ## Qué cuenta como identificador
 *
 * Los de T-SQL regulares empiezan por letra, `_`, `@` o `#` y siguen con letras, dígitos, `_`, `@`,
 * `#` o `$`. Aquí **no** se aplica la regla del primer carácter: no estamos validando un nombre,
 * estamos averiguando qué trozo de texto está reemplazando la sugerencia. Si alguien escribe `1abc`
 * —que no es un nombre válido— lo que hay que reemplazar sigue siendo `1abc` entero.
 *
 * Se aceptan letras y dígitos Unicode (`\p{L}`, `\p{N}`) porque SQL Server acepta identificadores
 * en cualquier alfabeto, y en español los nombres con acentos o con `ñ` son corrientes.
 *
 * Los delimitados con corchetes (`[Mi Tabla]`) se quedan fuera a propósito: el corchete no entra en
 * el recorte, así que escribir `[dshb` deja `dshb` como texto escrito y el corchete donde estaba.
 * Es lo que hace falta, y no obliga a analizar dónde abre y dónde cierra.
 */

/** Letras, dígitos, y los signos que SQL Server admite dentro de un nombre. */
const IDENTIFIER_AT_END = /[\p{L}\p{N}_@#$]+$/u;
const IDENTIFIER_AT_START = /^[\p{L}\p{N}_@#$]+/u;

/**
 * El identificador que termina justo en el cursor.
 *
 * @param lineUpToCursor El texto de la línea desde el margen hasta el cursor.
 * @returns Lo escrito, o cadena vacía si el cursor no está pegado a un identificador.
 */
export function identifierBeforeCursor(lineUpToCursor: string): string {
    return IDENTIFIER_AT_END.exec(lineUpToCursor)?.[0] ?? "";
}

/**
 * Lo que queda del identificador a la derecha del cursor.
 *
 * Hace falta para el rango de **reemplazo**: con el cursor en medio de `DSHB_Nav|igation`, aceptar
 * una sugerencia tiene que sustituir el nombre entero, no dejar `…igation` colgando detrás.
 *
 * @param lineFromCursor El texto de la línea desde el cursor hasta el final.
 */
export function identifierAfterCursor(lineFromCursor: string): string {
    return IDENTIFIER_AT_START.exec(lineFromCursor)?.[0] ?? "";
}
