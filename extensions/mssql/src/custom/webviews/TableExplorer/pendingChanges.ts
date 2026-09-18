/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Qué filas hay que revertir para descartar todos los cambios pendientes (§32).
 *
 * Sin React ni Fluent a propósito: así lo compila también `tsconfig.extension.json` y las pruebas
 * unitarias pueden cargarlo, que es donde se comprueba lo único que aquí se puede equivocar en
 * silencio —qué filas entran y en qué orden—.
 */

/** Lo único que hace falta de un cambio de celda: de qué fila era. */
export interface PendingCellChange {
    rowId: number;
}

/**
 * Las filas con algo pendiente, de mayor a menor identificador.
 *
 * Tres orígenes, que el `revertRow` de la rejilla ya sabe distinguir: una fila existente modificada
 * vuelve a sus valores, una marcada para borrar deja de estarlo, y una fila nueva desaparece.
 *
 * **El orden descendente no es cosmético:** revertir una fila nueva la saca del conjunto, así que
 * ir de abajo arriba deja intactos los identificadores de las que quedan por revertir. Al revés,
 * cada revertido movería a las siguientes.
 *
 * Los tres conjuntos son los mismos que alimentan la cuenta de la barra —los cambios de celda, las
 * filas marcadas para borrar y las recién creadas—, y de ahí sale la propiedad que importa: si se
 * revierten todas estas filas, la cuenta queda en cero sin tener que ponerla a cero a mano.
 */
export function pendingRowIds(
    cellChanges: Iterable<PendingCellChange>,
    deletedRows: Iterable<number>,
    newRowIds: Iterable<number>,
): number[] {
    const ids = new Set<number>();
    for (const change of cellChanges) {
        ids.add(change.rowId);
    }
    for (const rowId of deletedRows) {
        ids.add(rowId);
    }
    for (const rowId of newRowIds) {
        ids.add(rowId);
    }
    return [...ids].sort((a, b) => b - a);
}
