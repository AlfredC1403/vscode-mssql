/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { IConnectionProfile, ISelectionData } from "../../models/interfaces";

import ConnectionManager from "../../controllers/connectionManager";
import { TreeNodeInfo } from "../../objectExplorer/nodes/treeNodeInfo";
import { TableExplorerWebViewController } from "../../tableExplorer/tableExplorerWebViewController";
import { ITableExplorerService, TableExplorerService } from "../../services/tableExplorerService";
import SqlToolsServerClient from "../../languageservice/serviceclient";
import { AdminQueryRunner } from "../admin/sql/execute";
import { toRows } from "../admin/sql/rows";
import {
    EditQueryResultsOutcome,
    EditQueryResultsParams,
} from "../sharedInterfaces/editQueryResults";
import { Strings } from "../strings";
import { describeResultColumnsQuery } from "./foreignKeyLookup";

/**
 * «Déjame editar estos resultados» (§33).
 *
 * El editor en línea existe y funciona —es el Table Explorer, con el par confirmar/descartar del
 * §32—, pero solo se llegaba a él desde el árbol de objetos, sobre una tabla entera. Quien ejecuta
 * `SELECT … WHERE …` y quiere corregir tres celdas de lo que ve no tenía camino.
 *
 * Esto es ese camino: clic derecho en la rejilla de resultados, «Editar estos resultados», y se abre
 * el editor **atado a la consulta que se ejecutó**, no a la tabla entera. El filtro y el orden que
 * escribió el usuario siguen puestos.
 *
 * ## Por qué atado a la consulta y no a la tabla
 *
 * Porque es lo que se está mirando. Abrir `SELECT TOP 100 *` de la tabla entera sería otro conjunto
 * de filas, y habría que volver a filtrar a mano. La sesión de edición del STS admite un
 * `queryString` en `edit/initialize` —el propio Table Explorer lo usa para sus filtros—, así que
 * atarla a la consulta del usuario no inventa nada: es el mismo camino que ya existe.
 *
 * ## Qué se comprueba antes de abrir
 *
 * Una sesión de edición es **de una tabla**. Se le pregunta al servidor de qué tablas salen las
 * columnas del resultado (§31.2, el mismo `sys.dm_exec_describe_first_result_set`) y:
 *
 * - si salen de una sola, se abre el editor sobre ella;
 * - si salen de varias —una unión—, se dice cuáles y no se abre nada;
 * - si no salen de ninguna —agregados, literales—, se dice.
 *
 * Abrir y dejar que falle el STS también «funcionaría», pero el usuario vería una pestaña vacía con
 * un error del servidor en inglés en lugar de una frase que explica por qué su consulta no se puede
 * editar.
 */

/** Lo que hace falta del host, que `registerCustom` deja aquí al arrancar. */
interface EditQueryResultsHost {
    context: vscode.ExtensionContext;
    connectionManager: ConnectionManager;
    /** Se crea a la primera, no en el arranque: casi nadie usa esto en cada sesión. */
    tableExplorerService?: ITableExplorerService;
}

let host: EditQueryResultsHost | undefined;

/** Punto de entrada desde `registerCustom`. Ver la cabecera de `referencedRow.ts`. */
export function useEditQueryResultsHost(
    context: vscode.ExtensionContext | undefined,
    connectionManager: ConnectionManager | undefined,
): void {
    host = context && connectionManager ? { context, connectionManager } : undefined;
}

/**
 * Abre el editor de datos sobre la consulta que produjo el conjunto de resultados.
 *
 * Nunca lanza: cada final sale como un `status` que el que llama convierte en un aviso. Un menú
 * contextual que a veces no hace nada es peor que uno que dice por qué.
 *
 * @param selection El rango del lote dentro del documento, que da el texto exacto de la consulta.
 *   Lo saca el controlador de resultados del `QueryRunner`. Sin él se usa el documento entero, que
 *   es lo correcto cuando el documento es una sola sentencia.
 */
export async function editQueryResults(
    params: EditQueryResultsParams,
    selection: ISelectionData | undefined,
): Promise<EditQueryResultsOutcome> {
    if (!host) {
        return { status: "error", message: Strings.referencedRow.noConnectionManager };
    }

    const queryText = await readQueryText(params.ownerUri, selection);
    if (!queryText) {
        return { status: "noQuery" };
    }

    const profile = host.connectionManager.getConnectionInfo(params.ownerUri)
        ?.credentials as IConnectionProfile;
    if (!profile) {
        return { status: "notConnected" };
    }

    const runner = new AdminQueryRunner(host.connectionManager, params.ownerUri);
    const described = await runner.tryRun(describeResultColumnsQuery(queryText));
    if (!described.result) {
        return { status: "error", message: described.errorMessage };
    }

    let columns: DescribedColumn[];
    try {
        columns = toRows(described.result).map((row) => ({
            schema: row.text("sourceSchema"),
            table: row.text("sourceTable"),
        }));
    } catch (error) {
        return { status: "error", message: error instanceof Error ? error.message : String(error) };
    }

    const source = singleSourceTable(columns);
    if (source.kind === "none") {
        return { status: "noSource" };
    }
    if (source.kind === "several") {
        return { status: "severalTables", message: source.tables.join(", ") };
    }

    try {
        openTableExplorer(host, profile, source, queryText);
        return { status: "opened" };
    } catch (error) {
        return { status: "error", message: error instanceof Error ? error.message : String(error) };
    }
}

/** Una columna del resultado, reducida a lo que decide si el conjunto es editable. */
export interface DescribedColumn {
    schema: string;
    table: string;
}

/** De qué tabla sale el conjunto entero, si sale de una sola. */
export type SourceTableResolution =
    | { kind: "one"; schema: string; table: string }
    | { kind: "several"; tables: string[] }
    | { kind: "none" };

/**
 * La tabla de la que salen las columnas, si es una sola.
 *
 * **Las columnas sin tabla no cuentan.** Un `SELECT id, nombre, GETDATE() AS ahora FROM cliente` es
 * perfectamente editable: la columna calculada no sale de ninguna tabla y el servidor la devuelve
 * con `source_table` vacío. Contarla como «otra tabla» dejaría fuera media docena de consultas
 * corrientes.
 *
 * Exportada para los tests: es la decisión de esta parte que se puede equivocar en silencio.
 */
export function singleSourceTable(columns: readonly DescribedColumn[]): SourceTableResolution {
    const found = new Map<string, { schema: string; table: string }>();
    for (const column of columns) {
        if (!column.table) {
            continue;
        }
        // Por nombre cualificado: `dbo.Cliente` y `ventas.Cliente` son dos tablas distintas.
        found.set(`${column.schema}.${column.table}`.toLowerCase(), {
            schema: column.schema,
            table: column.table,
        });
    }
    if (found.size === 0) {
        return { kind: "none" };
    }
    if (found.size > 1) {
        return {
            kind: "several",
            tables: [...found.values()].map((entry) => `${entry.schema}.${entry.table}`),
        };
    }
    const [only] = [...found.values()];
    return { kind: "one", schema: only.schema, table: only.table };
}

/**
 * El texto del lote que produjo el conjunto.
 *
 * El rango viene del `QueryRunner`, que lo guarda por lote: es **el texto exacto** que se ejecutó,
 * no una reconstrucción. Sin rango —o con uno vacío, que es lo que pasa cuando se ejecutó el
 * documento entero— se usa todo el documento.
 */
async function readQueryText(
    ownerUri: string,
    selection: ISelectionData | undefined,
): Promise<string | undefined> {
    let document: vscode.TextDocument | undefined;
    try {
        document = await vscode.workspace.openTextDocument(vscode.Uri.parse(ownerUri));
    } catch {
        document = vscode.workspace.textDocuments.find(
            (candidate) => candidate.uri.toString() === ownerUri,
        );
    }
    if (!document) {
        return undefined;
    }

    const text = selection
        ? document.getText(
              new vscode.Range(
                  new vscode.Position(selection.startLine, selection.startColumn),
                  new vscode.Position(selection.endLine, selection.endColumn),
              ),
          )
        : document.getText();
    return text.trim().length > 0 ? text : undefined;
}

/**
 * Abre el Table Explorer del upstream sobre esa tabla y esa consulta.
 *
 * El controlador del upstream espera un nodo del árbol de objetos, que aquí no hay: el resultado
 * viene de una consulta escrita a mano y esa tabla puede estar sin desplegar, o el árbol cerrado.
 * Así que se arma el nodo con lo único que el controlador le pide —el nombre, el esquema, el tipo,
 * el perfil de conexión y un padre que diga la base—, en lugar de buscar en el árbol algo que
 * puede no estar cargado.
 */
function openTableExplorer(
    current: EditQueryResultsHost,
    profile: IConnectionProfile,
    source: { schema: string; table: string },
    queryText: string,
): void {
    current.tableExplorerService =
        current.tableExplorerService ?? new TableExplorerService(SqlToolsServerClient.instance);

    const node = buildTableNode(profile, source.schema, source.table);
    const view = new TableExplorerWebViewController(
        current.context,
        current.tableExplorerService,
        current.connectionManager,
        node,
        queryText,
    );
    view.revealToForeground();
}

/** El nodo que el Table Explorer necesita, armado a mano. Ver `openTableExplorer`. */
function buildTableNode(profile: IConnectionProfile, schema: string, table: string): TreeNodeInfo {
    const database = profile.database ?? "";
    // El padre existe solo para que `ObjectExplorerUtils.getDatabaseName` encuentre la base
    // subiendo por los padres, que es como la resuelve para cualquier nodo del árbol.
    const databaseNode = new TreeNodeInfo(
        database,
        { type: "Database", filterable: false, hasFilters: false, subType: "" },
        vscode.TreeItemCollapsibleState.Collapsed,
        `/${database}`,
        "",
        "Database",
        "",
        profile,
        undefined,
        undefined,
        "",
        { metadataType: 0, metadataTypeName: "Database", name: database, schema: "", urn: "" },
    );

    return new TreeNodeInfo(
        `${schema}.${table}`,
        { type: "Table", filterable: false, hasFilters: false, subType: "" },
        vscode.TreeItemCollapsibleState.None,
        `/${database}/${schema}.${table}`,
        "",
        "Table",
        "",
        profile,
        databaseNode,
        undefined,
        "",
        { metadataType: 0, metadataTypeName: "Table", name: table, schema, urn: "" },
    );
}

/** El aviso que corresponde a cada final. Solo `opened` no avisa de nada. */
export function explainOutcome(outcome: EditQueryResultsOutcome): string | undefined {
    switch (outcome.status) {
        case "opened":
            return undefined;
        case "noQuery":
            return Strings.editQueryResults.noQuery;
        case "noSource":
            return Strings.editQueryResults.noSource;
        case "severalTables":
            return Strings.editQueryResults.severalTables(outcome.message ?? "");
        case "notConnected":
            return Strings.editQueryResults.notConnected;
        default:
            return Strings.editQueryResults.error(outcome.message ?? "");
    }
}
