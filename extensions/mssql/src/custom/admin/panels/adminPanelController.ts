/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import ConnectionManager from "../../../controllers/connectionManager";
import { TreeNodeInfo } from "../../../objectExplorer/nodes/treeNodeInfo";
import { WebviewPanelController } from "../../../controllers/webviewPanelController";
import { AdminPanelReducers, AdminPanelState } from "../../sharedInterfaces/adminPanel";
import { CustomWebviewKind } from "../../sharedInterfaces/customWebview";
import { resolveConnectionTarget } from "../../util/connectionTarget";
import { Strings } from "../../strings";

/**
 * Nombre del bundle de esbuild, común a todas las vistas del fork. Tiene que coincidir con la
 * clave del entry point en `scripts/bundle-webviews.js`, porque `WebviewBaseController` construye
 * el HTML como `<sourceFile>.js` y `<sourceFile>.css`.
 *
 * Ese bundle es el router de `src/custom/webviews/index.tsx`, que elige la vista por el campo
 * `view` del estado.
 */
const SOURCE_FILE = "sqlworks";

/**
 * Panel de administración.
 *
 * En M2 solo demuestra el punto de anclaje: se abre desde el explorador de objetos, reutiliza la
 * conexión que la extensión ya tiene abierta y muestra a qué servidor y base de datos apunta. Los
 * hitos M3 a M6 le cuelgan el contenido real.
 */
export class AdminPanelController extends WebviewPanelController<
    AdminPanelState,
    AdminPanelReducers
> {
    /** URI con la que el SQL Tools Service conoce esta conexión. La usarán M3 y siguientes. */
    public readonly connectionUri: string;

    private constructor(
        context: vscode.ExtensionContext,
        private readonly node: TreeNodeInfo,
        private readonly connectionManager: ConnectionManager,
        initialState: AdminPanelState,
        connectionUri: string,
    ) {
        super(context, SOURCE_FILE, "SqlWorksAdmin", initialState, {
            title: Strings.adminPanel.title(initialState.target?.server ?? ""),
            viewColumn: vscode.ViewColumn.Active,
            iconPath: vscode.Uri.joinPath(
                context.extensionUri,
                "media",
                "objectTypes",
                "Database.svg",
            ),
        });

        this.connectionUri = connectionUri;
        this.registerReducers();
    }

    /**
     * Crea el panel para un nodo del árbol, o devuelve `undefined` y avisa al usuario si ese nodo
     * no tiene una conexión abierta con la que trabajar.
     */
    public static createForNode(
        context: vscode.ExtensionContext,
        node: TreeNodeInfo | undefined,
        connectionManager: ConnectionManager,
    ): AdminPanelController | undefined {
        const resolved = resolveConnectionTarget(node, connectionManager);
        if (resolved.errorMessage) {
            void vscode.window.showErrorMessage(resolved.errorMessage);
            return undefined;
        }

        return new AdminPanelController(
            context,
            node!,
            connectionManager,
            { view: CustomWebviewKind.AdminPanel, target: resolved.target },
            resolved.connectionUri,
        );
    }

    private registerReducers(): void {
        this.registerReducer("refresh", (state) => {
            const resolved = resolveConnectionTarget(this.node, this.connectionManager);
            if (resolved.errorMessage) {
                return { ...state, errorMessage: resolved.errorMessage };
            }
            return { ...state, target: resolved.target, errorMessage: undefined };
        });
    }
}
