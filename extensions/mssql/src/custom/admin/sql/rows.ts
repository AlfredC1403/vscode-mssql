/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";

/**
 * Acceso a las filas de `query/simpleexecute` **por nombre de columna**.
 *
 * El STS devuelve `rows: DbCellValue[][]`, es decir posiciones, y `columnInfo` aparte. Mapear por
 * índice es frágil: basta reordenar un `SELECT` para romper el mapeo en silencio. Todo el fork
 * mapea por nombre, y si una columna que se espera no viene, falla con un mensaje que dice cuál.
 *
 * Los mapeadores que se construyen sobre esto son **funciones puras**: entra un `SimpleExecuteResult`
 * y sale un arreglo de tipos del dominio, sin conexión y sin red. Ahí van los tests (§9 del brief).
 */
export class Row {
    private readonly index: Map<string, number>;

    constructor(
        private readonly cells: { displayValue: string; isNull: boolean }[],
        index: Map<string, number>,
    ) {
        this.index = index;
    }

    private cell(column: string) {
        const position = this.index.get(column.toLowerCase());
        if (position === undefined) {
            throw new Error(
                `La consulta no devolvió la columna "${column}". Columnas presentes: ${[
                    ...this.index.keys(),
                ].join(", ")}`,
            );
        }
        return this.cells[position];
    }

    /** Texto de la columna. Un NULL de SQL se convierte en cadena vacía. */
    text(column: string): string {
        const cell = this.cell(column);
        return cell?.isNull ? "" : (cell?.displayValue ?? "");
    }

    /** Texto de la columna, o `undefined` si es NULL. Para campos opcionales del dominio. */
    optionalText(column: string): string | undefined {
        const cell = this.cell(column);
        return cell?.isNull ? undefined : cell?.displayValue;
    }

    /** Número de la columna. Un NULL o un valor no numérico devuelven `fallback`. */
    number(column: string, fallback = 0): number {
        const raw = this.text(column);
        if (raw === "") {
            return fallback;
        }
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    /**
     * Booleano de la columna. SQL Server devuelve los `bit` como "0"/"1" a través del STS, pero
     * también se aceptan "true"/"false" por si alguna consulta usa una expresión.
     */
    boolean(column: string): boolean {
        const raw = this.text(column).trim().toLowerCase();
        return raw === "1" || raw === "true";
    }
}

/**
 * Convierte el resultado plano del STS en filas navegables por nombre de columna.
 *
 * @param result Lo que devuelve `query/simpleexecute`.
 */
export function toRows(result: SimpleExecuteResult | undefined): Row[] {
    if (!result?.rows?.length) {
        return [];
    }

    const index = new Map<string, number>();
    (result.columnInfo ?? []).forEach((column, position) => {
        // En minúsculas: T-SQL no distingue mayúsculas en los nombres de columna, y así el
        // mapeador no depende de cómo se escribió el alias en el SELECT.
        index.set((column?.columnName ?? "").toLowerCase(), position);
    });

    return result.rows.map((cells) => new Row(cells, index));
}
