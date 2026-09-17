/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import ConnectionManager from "../controllers/connectionManager";
import { TreeNodeInfo } from "../objectExplorer/nodes/treeNodeInfo";
import { AdminPanelController } from "./admin/panels/adminPanelController";

/**
 * Identificadores de los comandos que aporta el fork.
 *
 * Prefijo propio `sqlworks.`, separado del `mssql.` del upstream. Ver FORK.md §15.2.
 * Tienen que coincidir con lo declarado en `contributes.commands` del `package.json`.
 */
export const CustomCommands = {
    openAdminPanel: "sqlworks.openAdminPanel",
} as const;

/**
 * Punto de anclaje único del fork.
 *
 * El punto de entrada de la extensión (`src/extension.ts`) llama a esta función y a nada más de
 * `src/custom/`. Todo lo que añade el fork se registra desde aquí, así que la deuda de merge en el
 * punto de entrada se queda en una línea para siempre.
 *
 * @param context Contexto de la extensión, para los `subscriptions` y las rutas de recursos.
 * @param connectionManager El gestor de conexiones del upstream. **No creamos uno propio**
 *   (regla 16.2 del brief): reutilizamos sus conexiones, sus perfiles y su almacén de credenciales.
 */
export function registerCustom(
    context: vscode.ExtensionContext,
    connectionManager: ConnectionManager,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(CustomCommands.openAdminPanel, (node?: TreeNodeInfo) => {
            // El menú contextual del árbol pasa el nodo como primer argumento. Si el comando
            // se invoca desde la paleta no hay nodo, y el controlador avisa al usuario.
            AdminPanelController.createForNode(context, node, connectionManager);
        }),
    );
}
