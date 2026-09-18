/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import ConnectionManager from "../controllers/connectionManager";
import { TreeNodeInfo } from "../objectExplorer/nodes/treeNodeInfo";
import { AdminPanelController } from "./admin/panels/adminPanelController";
import { SnippetCompletionProvider } from "./snippets/completion";
import { SnippetsViewController } from "./snippets/snippetsViewController";

/**
 * Identificadores de los comandos que aporta el fork.
 *
 * Prefijo propio `sqlworks.`, separado del `mssql.` del upstream. Ver FORK.md §15.2.
 * Tienen que coincidir con lo declarado en `contributes.commands` del `package.json`.
 */
export const CustomCommands = {
    openAdminPanel: "sqlworks.openAdminPanel",
    /** M7: enfoca la vista de snippets desde la paleta. */
    showSnippets: "sqlworks.showSnippets",
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
    // Lo registrado en la llamada anterior, si hubo una. Ver `disposeRegistrations`.
    disposeRegistrations();

    const own: vscode.Disposable[] = [
        vscode.commands.registerCommand(CustomCommands.openAdminPanel, (node?: TreeNodeInfo) => {
            // El menú contextual del árbol pasa el nodo como primer argumento. Si el comando
            // se invoca desde la paleta no hay nodo, y el controlador avisa al usuario.
            AdminPanelController.createForNode(context, node, connectionManager);
        }),
    ];

    // --- M7: biblioteca de snippets ---
    const snippets = new SnippetsViewController(context);
    own.push(
        vscode.window.registerWebviewViewProvider(SnippetsViewController.viewId, snippets, {
            // Sin esto, la vista se descarta al ocultarla y se pierde el filtro que el usuario
            // tenía escrito. Es una lista, no un panel caro: retenerla no cuesta nada.
            webviewOptions: { retainContextWhenHidden: true },
        }),
        vscode.commands.registerCommand(CustomCommands.showSnippets, () =>
            snippets.revealToForeground(),
        ),
        // Los snippets propios y compartidos, en la autocompletación. Es aditivo: los dos caminos
        // del upstream siguen funcionando. Ver `snippets/completion.ts`.
        vscode.languages.registerCompletionItemProvider(
            { language: "sql" },
            new SnippetCompletionProvider(() => snippets.completionSnippets),
        ),
    );

    registrations = own;
    context.subscriptions.push(...own);
}

/** Lo que registró la última llamada a `registerCustom`. */
let registrations: vscode.Disposable[] = [];

/**
 * Suelta lo registrado por una llamada anterior, para que `registerCustom` se pueda llamar dos veces.
 *
 * **Por qué hace falta:** un identificador de vista solo se puede registrar una vez por host de
 * extensión, y `vscode.window.registerWebviewViewProvider` lanza «already registered» al segundo
 * intento. `test/unit/extension.test.ts` del upstream activa la extensión en cada test, con un
 * `subscriptions` nuevo que nadie libera, así que la segunda activación rompía. Lo encontró la suite
 * al añadir M7: hasta entonces el fork solo registraba comandos y eso no se quejaba.
 *
 * Que `registerCustom` sea reentrante es además lo correcto: reactivar deja el fork funcionando en
 * lugar de a medias.
 */
function disposeRegistrations(): void {
    for (const registration of registrations) {
        try {
            registration.dispose();
        } catch {
            // Liberar lo que ya estaba liberado no es un problema, y no puede impedir el registro.
        }
    }
    registrations = [];
}
