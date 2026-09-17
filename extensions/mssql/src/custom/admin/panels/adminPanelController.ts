/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import ConnectionManager from "../../../controllers/connectionManager";
import { TreeNodeInfo } from "../../../objectExplorer/nodes/treeNodeInfo";
import { WebviewPanelController } from "../../../controllers/webviewPanelController";
import {
    AdminPanelReducers,
    AdminPanelState,
    AdminSection,
    SECTION_STATE_KEYS,
    SectionState,
} from "../../sharedInterfaces/adminPanel";
import { CustomWebviewKind } from "../../sharedInterfaces/customWebview";
import { resolveConnectionTarget } from "../../util/connectionTarget";
import { Strings } from "../../strings";
import { AdminQueryRunner } from "../sql/execute";
import { ServerSecurityService, SectionResult } from "../serverSecurityService";

/**
 * Nombre del bundle de esbuild, común a todas las vistas del fork. Tiene que coincidir con la
 * clave del entry point en `scripts/bundle-webviews.js`, porque `WebviewBaseController` construye
 * el HTML como `<sourceFile>.js` y `<sourceFile>.css`.
 *
 * Ese bundle es el router de `src/custom/webviews/index.tsx`, que elige la vista por el campo
 * `view` del estado.
 */
const SOURCE_FILE = "sqlworks";

/** Estado inicial de una sección: nada leído todavía. */
function idleSection<T>(): SectionState<T> {
    return { status: "idle" };
}

/**
 * Panel de administración.
 *
 * En M3 muestra la seguridad del servidor en solo lectura: logins, roles de servidor, permisos de
 * servidor, propiedades de la instancia y sesiones activas. No ejecuta ni una sentencia que
 * modifique nada; la edición llega en M5 con vista previa, confirmación y transacción.
 *
 * Las secciones se cargan **al abrirlas**, no todas de golpe: abrir el panel no debe disparar
 * cinco consultas contra un servidor de producción.
 */
export class AdminPanelController extends WebviewPanelController<
    AdminPanelState,
    AdminPanelReducers
> {
    /** URI con la que el SQL Tools Service conoce esta conexión. */
    public readonly connectionUri: string;

    private readonly security: ServerSecurityService;

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
        this.security = new ServerSecurityService(
            new AdminQueryRunner(connectionManager, connectionUri),
        );
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
            {
                view: CustomWebviewKind.AdminPanel,
                target: resolved.target,
                activeSection: AdminSection.Overview,
                logins: idleSection(),
                serverRoles: idleSection(),
                serverPermissions: idleSection(),
                instance: idleSection(),
                sessions: idleSection(),
            },
            resolved.connectionUri,
        );
    }

    private registerReducers(): void {
        this.registerReducer("refresh", (state) => {
            const resolved = resolveConnectionTarget(this.node, this.connectionManager);
            const next: AdminPanelState = resolved.errorMessage
                ? { ...state, errorMessage: resolved.errorMessage }
                : { ...state, target: resolved.target, errorMessage: undefined };

            // «Actualizar» recarga la sección visible, no las cinco.
            if (next.activeSection !== AdminSection.Overview) {
                void this.loadSection(next.activeSection);
            }
            return next;
        });

        this.registerReducer("selectSection", (state, payload) => {
            const section = payload.section;
            // Se carga solo la primera vez. Volver a una pestaña ya leída no vuelve a consultar.
            if (section !== AdminSection.Overview) {
                const current = state[SECTION_STATE_KEYS[section]] as SectionState<unknown>;
                if (current?.status === "idle") {
                    void this.loadSection(section);
                }
            }
            return { ...state, activeSection: section };
        });

        this.registerReducer("loadSection", (state, payload) => {
            if (payload.section !== AdminSection.Overview) {
                void this.loadSection(payload.section);
            }
            return state;
        });
    }

    /**
     * Lee una sección del servidor y publica el resultado en el estado.
     *
     * No lanza: un fallo de permisos o de red se muestra dentro de la sección, y las demás siguen
     * funcionando.
     */
    private async loadSection(section: AdminSection): Promise<void> {
        if (section === AdminSection.Overview) {
            return;
        }
        const key = SECTION_STATE_KEYS[section];

        this.updateSection(key, { status: "loading" });

        const result = await this.read(section);
        if (this.isDisposed) {
            return;
        }

        this.updateSection(
            key,
            result.errorMessage
                ? { status: "error", errorMessage: result.errorMessage }
                : { status: "loaded", data: result.data, readAt: new Date().toISOString() },
        );
    }

    /** Despacha la lectura a la consulta que corresponde. */
    private async read(section: AdminSection): Promise<SectionResult<unknown>> {
        switch (section) {
            case AdminSection.Logins:
                return await this.security.loadLogins();
            case AdminSection.ServerRoles:
                return await this.security.loadServerRoles();
            case AdminSection.ServerPermissions:
                return await this.security.loadServerPermissions();
            case AdminSection.Instance:
                return await this.security.loadInstanceProperties();
            case AdminSection.Sessions:
                return await this.security.loadActiveSessions();
            default:
                return { errorMessage: Strings.adminPanel.unknownSection };
        }
    }

    /** Reemplaza el estado de una sección sin tocar las demás. */
    private updateSection(
        key: (typeof SECTION_STATE_KEYS)[keyof typeof SECTION_STATE_KEYS],
        value: SectionState<unknown>,
    ): void {
        this.state = { ...this.state, [key]: value } as AdminPanelState;
    }
}
