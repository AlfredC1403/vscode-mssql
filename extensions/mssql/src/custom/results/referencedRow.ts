/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { SimpleExecuteResult } from "vscode-mssql";

import ConnectionManager from "../../controllers/connectionManager";
import { AdminQueryRunner } from "../admin/sql/execute";
import { toRows } from "../admin/sql/rows";
import {
    ReferencedField,
    ReferencedRowRequestParams,
    ReferencedRowResult,
} from "../sharedInterfaces/referencedRow";
import { Strings } from "../strings";
import {
    ForeignKeyTarget,
    describeResultColumnsQuery,
    foreignKeyForColumnQuery,
    referencedRowQuery,
} from "./foreignKeyLookup";

/**
 * «Enséñame el registro al que apunta esta celda» (§31).
 *
 * En dbForge, una celda que es clave ajena abre la fila dueña sin escribir una consulta. Aquí igual:
 * clic derecho sobre la celda y un globo encima de la rejilla con el registro de la tabla
 * referenciada.
 *
 * ## Por qué esto vive en un módulo con estado
 *
 * La rejilla de resultados es un webview del upstream, y su controlador
 * (`queryResultWebViewController`) **no recibe el gestor de conexiones**: se construye con el
 * contexto, el servicio de planes y el proveedor de salida. Pero la consulta hay que lanzarla sobre
 * la conexión que ya existe —el fork no abre conexiones propias, regla 16.2 del brief—, así que
 * `registerCustom` deja aquí la referencia al gestor cuando arranca y el manejador la usa.
 *
 * La alternativa era pasar el gestor por el constructor del controlador del upstream, que son tres
 * archivos suyos tocados y una firma pública cambiada. Esto es una línea.
 *
 * ## De qué tabla sale la columna
 *
 * `columnInfo` del conjunto tiene `baseSchemaName`, `baseTableName` y `baseColumnName`, que serían
 * exactamente esto. **Medido contra el STS 6.0.20260915.1: los tres vienen a `null`.** Así que la
 * tabla de origen se la pregunta al servidor con `sys.dm_exec_describe_first_result_set`, que la
 * deduce del texto de la consulta sin ejecutar nada.
 *
 * Ese texto se saca del documento al que pertenece el resultado. Si el documento es un script con
 * varios lotes, se prueban los lotes separados por `GO`, del último al primero: en un script de
 * migración lo que se acaba de ejecutar suele estar al final. Si aun así no se puede, se dice, en
 * lugar de enseñar la fila de una tabla adivinada.
 */

/** El gestor de conexiones del upstream. Lo deja `registerCustom`. */
let connectionManager: ConnectionManager | undefined;

/** Punto de entrada desde `registerCustom`. Ver la cabecera. */
export function useConnectionManager(manager: ConnectionManager | undefined): void {
    connectionManager = manager;
}

/**
 * Resuelve la clave ajena de la celda y devuelve la fila referenciada.
 *
 * Nunca lanza: cada final posible —no se sabe la tabla, no hay clave ajena, la clave es compuesta,
 * el valor es NULL, la fila no está, la consulta falló— sale como un `status` que el globo sabe
 * explicar. Un menú contextual que a veces no hace nada es peor que uno que dice por qué.
 */
export async function showReferencedRow(
    params: ReferencedRowRequestParams,
): Promise<ReferencedRowResult> {
    const origin = { schema: "", table: "", column: params.columnName, value: params.value };

    if (!connectionManager) {
        return fail("error", origin, Strings.referencedRow.noConnectionManager);
    }
    if (params.value === null) {
        return fail("nullValue", origin);
    }

    const runner = new AdminQueryRunner(connectionManager, params.ownerUri);

    let source: ColumnSource | undefined;
    try {
        source = await resolveColumnSource(runner, params);
    } catch (error) {
        return fail("error", origin, describe(error));
    }
    if (!source) {
        return fail(
            "unknownSource",
            origin,
            Strings.referencedRow.unknownSource(params.columnName),
        );
    }
    origin.schema = source.schema;
    origin.table = source.table;
    origin.column = source.column;

    let target: ForeignKeyTarget | undefined;
    try {
        target = readForeignKey(
            await runner.run(foreignKeyForColumnQuery(source.schema, source.table, source.column)),
        );
    } catch (error) {
        return fail("error", origin, describe(error));
    }

    if (!target) {
        return fail("noForeignKey", origin);
    }
    if (target.columnCount > 1) {
        // Con una sola celda no se puede identificar la fila de una clave de varias columnas, y
        // adivinar las otras sería enseñar una fila que quizá no es la que apunta.
        return { status: "compositeKey", origin, target: describeTarget(target), fields: [] };
    }

    try {
        const rows = await runner.run(referencedRowQuery(target, params.value));
        const fields = readFields(rows, target.column);
        return {
            status: fields.length > 0 ? "ok" : "notFound",
            origin,
            target: describeTarget(target),
            fields,
        };
    } catch (error) {
        return fail("error", origin, describe(error));
    }
}

/** De qué tabla y columna sale una columna del resultado. */
interface ColumnSource {
    schema: string;
    table: string;
    column: string;
}

/**
 * Pregunta al servidor de qué tabla sale la columna, a partir del texto de la consulta.
 *
 * Se prueba primero el documento entero y después sus lotes, del último al primero. Un lote que no
 * describe nada —porque no devuelve filas, o porque el servidor no puede deducirlo— simplemente no
 * encaja y se sigue con el siguiente.
 */
async function resolveColumnSource(
    runner: AdminQueryRunner,
    params: ReferencedRowRequestParams,
): Promise<ColumnSource | undefined> {
    const document = vscode.workspace.textDocuments.find(
        (candidate) => candidate.uri.toString() === params.ownerUri,
    );
    if (!document) {
        return undefined;
    }

    const text = document.getText();
    for (const batch of [text, ...splitBatches(text).reverse()]) {
        if (batch.trim().length === 0) {
            continue;
        }
        // `tryRun`: un lote que el servidor no sabe describir responde con error, y eso no es un
        // fallo del fork sino un candidato que no valía.
        const described = await runner.tryRun(describeResultColumnsQuery(batch));
        const source = matchColumn(described.result, params);
        if (source) {
            return source;
        }
    }
    return undefined;
}

/** La columna descrita que corresponde a la celda: por posición, y si no por nombre. */
function matchColumn(
    result: SimpleExecuteResult | undefined,
    params: ReferencedRowRequestParams,
): ColumnSource | undefined {
    const rows = toRows(result);
    if (rows.length === 0) {
        return undefined;
    }
    // Por posición es lo exacto cuando el lote descrito es el que produjo el resultado. El nombre
    // es la red de seguridad para cuando el lote traía además otras sentencias.
    const candidate =
        rows[params.columnIndex]?.text("name") === params.columnName
            ? rows[params.columnIndex]
            : rows.find((row) => row.text("name") === params.columnName);
    if (!candidate) {
        return undefined;
    }
    const schema = candidate.text("sourceSchema");
    const table = candidate.text("sourceTable");
    const column = candidate.text("sourceColumn");
    if (!schema || !table || !column) {
        // Una columna calculada, un `COUNT(*)` o un literal no salen de ninguna tabla.
        return undefined;
    }
    return { schema, table, column };
}

/**
 * Parte un script en lotes por las líneas que solo dicen `GO`.
 *
 * No es un analizador de T-SQL —el §16 del brief lo prohíbe, y para esto no hace falta—: `GO` no es
 * una sentencia sino un separador de lotes que reconoce el cliente, y reconocerlo es exactamente
 * esto. Un `GO` dentro de una cadena o un comentario partiría de más, y el coste de equivocarse es
 * un candidato que no describe nada y se descarta.
 */
export function splitBatches(text: string): string[] {
    return text.split(/^[ \t]*GO[ \t]*(?:--.*)?$/gim);
}

function fail(
    status: ReferencedRowResult["status"],
    origin: ReferencedRowResult["origin"],
    message?: string,
): ReferencedRowResult {
    return { status, origin, fields: [], message };
}

/** La primera restricción que devuelve el catálogo, o nada. */
function readForeignKey(result: SimpleExecuteResult | undefined): ForeignKeyTarget | undefined {
    const [row] = toRows(result);
    if (!row) {
        return undefined;
    }
    return {
        constraint: row.text("constraintName"),
        schema: row.text("refSchema"),
        table: row.text("refTable"),
        column: row.text("refColumn"),
        columnCount: Number(row.text("columnCount")) || 1,
    };
}

function describeTarget(target: ForeignKeyTarget) {
    return {
        schema: target.schema,
        table: target.table,
        column: target.column,
        constraint: target.constraint,
    };
}

/**
 * Convierte la primera fila en campos para mostrar.
 *
 * `SELECT *` devuelve las columnas en el orden de la tabla, que es el orden en el que la gente las
 * espera, así que no se reordenan. La columna por la que se llegó se marca para poder destacarla.
 */
function readFields(
    result: SimpleExecuteResult | undefined,
    matchColumnName: string,
): ReferencedField[] {
    const columns = result?.columnInfo ?? [];
    const [first] = result?.rows ?? [];
    if (!first) {
        return [];
    }
    return columns.map((column, index) => {
        const cell = first[index];
        return {
            name: column.columnName,
            // Un NULL se dice, no se deja en blanco: en blanco se confunde con una cadena vacía, que
            // en una base de datos es otra cosa.
            value: cell?.isNull ? "NULL" : (cell?.displayValue ?? ""),
            isNull: Boolean(cell?.isNull),
            isMatch: column.columnName.toLowerCase() === matchColumnName.toLowerCase(),
        };
    });
}

function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
