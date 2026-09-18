/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import ConnectionManager from "../controllers/connectionManager";
import { TreeNodeInfo } from "../objectExplorer/nodes/treeNodeInfo";
import { AdminPanelController } from "./admin/panels/adminPanelController";
import { ConnectionSelector } from "./connection/connectionSelector";
import { useConnectionManager } from "./results/referencedRow";
import { useEditQueryResultsHost } from "./results/editQueryResults";
import { SnippetCompletionProvider } from "./snippets/completion";
import { SnippetsViewController } from "./snippets/snippetsViewController";
import { FormatProfilesController } from "./format/formatProfilesController";
import { pickAndApplyProfile } from "./format/applyProfileCommand";
import { watchNetworkSettings } from "./overrides/networkWatch";

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
    /** M8: abre el panel de formato. */
    openFormatPanel: "sqlworks.openFormatPanel",
    /** M8: aplica un perfil de formato sin abrir el panel. */
    applyFormatProfile: "sqlworks.applyFormatProfile",
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

    /**
     * Apunta cada registro **en cuanto se hace**, no al final.
     *
     * Si algo lanzara a mitad de esta función, apuntar al final dejaría lo ya registrado sin
     * anotar, y la siguiente activación no podría liberarlo: el registro de una vista falla con
     * «already registered» y el fork se quedaría roto para el resto de la sesión. Apuntando de una
     * en una, `disposeRegistrations` siempre sabe qué hay que soltar.
     */
    const keep = <T extends vscode.Disposable>(registration: T): T => {
        registrations.push(registration);
        context.subscriptions.push(registration);
        return registration;
    };

    keep(
        vscode.commands.registerCommand(CustomCommands.openAdminPanel, (node?: TreeNodeInfo) => {
            // El menú contextual del árbol pasa el nodo como primer argumento. Si el comando
            // se invoca desde la paleta no hay nodo, y el controlador avisa al usuario.
            AdminPanelController.createForNode(context, node, connectionManager);
        }),
    );

    // --- M7: biblioteca de snippets ---
    //
    // El registro de la vista se tolera si el id ya está ocupado, y el motivo no es trivial:
    // **bajo los tests unitarios hay dos copias del código de la extensión vivas en el mismo host**.
    // `package.json` apunta a `./dist/extension` —el bundle, que VS Code activa—, y
    // `test/unit/extension.test.ts` importa `src/extension`, que se ejecuta desde `out/`. Son dos
    // módulos distintos con su propio estado, así que ningún guardia a nivel de módulo puede
    // coordinarlos, y el segundo registro del mismo id falla con «already registered».
    //
    // En producción solo hay una copia y esto no ocurre. Tragarse ese fallo concreto es seguro: si
    // el id ya está registrado, hay un proveedor para la vista y la vista funciona. Lo que no se
    // puede es dejar que reviente el registro de todo lo demás.
    snippetsView = snippetsView ?? new SnippetsViewController(context);
    const snippets = snippetsView;
    try {
        keep(
            vscode.window.registerWebviewViewProvider(SnippetsViewController.viewId, snippets, {
                // Sin esto, la vista se descarta al ocultarla y se pierde el filtro que el usuario
                // tenía escrito. Es una lista, no un panel caro: retenerla no cuesta nada.
                webviewOptions: { retainContextWhenHidden: true },
            }),
        );
    } catch {
        // Ya hay un proveedor para este id. Ver arriba.
    }
    keep(
        vscode.commands.registerCommand(CustomCommands.showSnippets, () =>
            snippets.revealToForeground(),
        ),
    );
    // Los snippets propios y compartidos, en la autocompletación. Es aditivo: los dos caminos
    // del upstream siguen funcionando. Ver `snippets/completion.ts`.
    keep(
        vscode.languages.registerCompletionItemProvider(
            { language: "sql" },
            new SnippetCompletionProvider(() => snippets.completionSnippets),
        ),
    );

    // --- M8: formato ---
    keep(
        vscode.commands.registerCommand(
            CustomCommands.openFormatPanel,
            () => new FormatProfilesController(context),
        ),
    );
    // El selector rápido: cambiar de perfil sin abrir el panel, que es lo que se hace a diario.
    keep(
        vscode.commands.registerCommand(CustomCommands.applyFormatProfile, () =>
            pickAndApplyProfile(context),
        ),
    );

    // --- §31: el registro al que apunta una clave ajena ---
    //
    // Lo dispara el menú contextual de la rejilla de resultados, cuyo controlador es del upstream y
    // **no recibe el gestor de conexiones**. Se lo dejamos aquí. Ver `results/referencedRow.ts`.
    useConnectionManager(connectionManager);

    // --- §33: editar en línea los resultados de una consulta ---
    //
    // Mismo motivo y mismo patrón: lo dispara el menú de la rejilla del upstream, y hace falta el
    // gestor de conexiones y el contexto para abrir el editor de datos. Ver
    // `results/editQueryResults.ts`.
    useEditQueryResultsHost(context, connectionManager);

    // --- §30: el selector de conexión, siempre a la vista ---
    //
    // Sustituye al CodeLens de la línea 0 del upstream, que se desplaza con el texto. Ver
    // `connection/connectionSelector.ts`.
    keep(new ConnectionSelector(connectionManager));

    // --- M9: vigilancia de las salidas de red del upstream ---
    //
    // No apaga nada: avisa si alguien ha encendido las claves de Data API Builder que descargan y
    // ejecutan un binario de un feed externo. Ver `overrides/networkWatch.ts` y FORK.md §26.8.
    keep(watchNetworkSettings());
}

/** Lo que registró la última llamada a `registerCustom`. */
let registrations: vscode.Disposable[] = [];

/**
 * La vista de snippets, registrada una sola vez por host de extensión.
 *
 * Vive fuera de `registerCustom` porque su registro **no se puede repetir**: ver el comentario en
 * el cuerpo de la función.
 */
let snippetsView: SnippetsViewController | undefined;

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
