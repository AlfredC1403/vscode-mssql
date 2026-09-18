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
    DATABASE_SECTIONS,
    SECTION_STATE_KEYS,
    SectionState,
    SessionCapabilities,
    isDatabaseSection,
} from "../../sharedInterfaces/adminPanel";
import { CustomWebviewKind } from "../../sharedInterfaces/customWebview";
import { resolveConnectionTarget } from "../../util/connectionTarget";
import { Strings } from "../../strings";
import { AdminQueryRunner } from "../sql/execute";
import { ServerSecurityService, SectionResult } from "../serverSecurityService";
import { DatabaseSecurityService } from "../databaseSecurityService";
import { SessionAdminService } from "../sessionAdminService";
import { isValidIdentifier } from "../../util/identifiers";
import { buildKillStatement, canKillSessions, isSameSession } from "../sql/queries/killSession";
import { ActiveSession, KillPermissions } from "../sql/types";
import { formatSeconds } from "../../sharedInterfaces/duration";

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
    private readonly databaseSecurity: DatabaseSecurityService;
    private readonly sessionAdmin: SessionAdminService;

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
        const runner = new AdminQueryRunner(connectionManager, connectionUri);
        this.security = new ServerSecurityService(runner);
        this.databaseSecurity = new DatabaseSecurityService(runner);
        this.sessionAdmin = new SessionAdminService(runner);
        this.registerReducers();
        // El selector de bases se llena en cuanto abre el panel: es una sola consulta a
        // `sys.databases` y sin ella no se puede cambiar de base.
        void this.loadDatabases();
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
                // Las secciones de base arrancan apuntando a la base de la conexión, que es lo que
                // el usuario tenía seleccionado en el árbol.
                selectedDatabase: resolved.target.database,
                databases: idleSection(),
                users: idleSection(),
                databaseRoles: idleSection(),
                schemas: idleSection(),
                databasePermissions: idleSection(),
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

        this.registerReducer("killSession", async (state, payload) => {
            await this.killSession(state, payload.sessionId);
            // `killSession` publica el estado por su cuenta (permisos y recarga de la sección).
            return this.state;
        });

        this.registerReducer("selectDatabase", (state, payload) => {
            const database = payload.database;
            // Salvaguarda: el nombre acaba dentro de una consulta, así que se valida antes de
            // guardarlo, no solo al construir la sentencia (regla 11.2 del brief).
            if (!isValidIdentifier(database) || database === state.selectedDatabase) {
                return state;
            }

            // Las secciones de base pasan a «sin leer», y la visible se relee. Las del servidor no
            // se tocan: no dependen de la base.
            const next: AdminPanelState = { ...state, selectedDatabase: database };
            for (const section of DATABASE_SECTIONS) {
                next[SECTION_STATE_KEYS[section]] = idleSection() as never;
            }
            if (isDatabaseSection(state.activeSection)) {
                void this.loadSection(state.activeSection, database);
            }
            return next;
        });
    }

    /** Llena el selector de bases de datos. Su fallo no rompe nada más del panel. */
    private async loadDatabases(): Promise<void> {
        this.updateSection("databases", { status: "loading" });
        const result = await this.databaseSecurity.loadDatabases();
        if (this.isDisposed) {
            return;
        }
        this.updateSection(
            "databases",
            result.errorMessage
                ? { status: "error", errorMessage: result.errorMessage }
                : { status: "loaded", data: result.data, readAt: new Date().toISOString() },
        );
    }

    /**
     * Termina una sesión, con todas las comprobaciones que exige el §11 del brief antes de escribir
     * nada en el servidor:
     *
     * 1. La fila tiene que seguir en el estado del panel.
     * 2. Se releen los permisos **en el momento**, sin fiarse de lo que se leyó al abrir la sección:
     *    un cambio de rol en el servidor no avisa al panel.
     * 3. No se permite terminar la sesión del propio panel (SQL Server daría el error 6104).
     * 4. Se vuelve a leer la sesión y se compara su identidad: los identificadores se reutilizan.
     * 5. Se muestra la sentencia exacta y se pide confirmación.
     *
     * Solo después se ejecuta, y siempre se recarga la lista al terminar.
     */
    private async killSession(state: AdminPanelState, sessionId: number): Promise<void> {
        const session = state.sessions?.data?.find((item) => item.sessionId === sessionId);
        if (!session) {
            void vscode.window.showErrorMessage(Strings.killSession.unknownSession);
            return;
        }

        const permissions = await this.sessionAdmin.loadPermissions();
        if (permissions.errorMessage || !permissions.permissions) {
            void vscode.window.showErrorMessage(
                Strings.killSession.permissionUnknown(
                    permissions.errorMessage ?? Strings.adminPanel.unknownSection,
                ),
            );
            return;
        }

        this.publishCapabilities(permissions.permissions);

        if (!canKillSessions(permissions.permissions)) {
            void vscode.window.showErrorMessage(
                Strings.killSession.noPermission(permissions.permissions.loginName),
            );
            return;
        }

        if (sessionId === permissions.permissions.currentSessionId) {
            void vscode.window.showErrorMessage(Strings.killSession.ownSession);
            return;
        }

        const snapshot = await this.sessionAdmin.readSnapshot(sessionId);
        if (snapshot.errorMessage) {
            void vscode.window.showErrorMessage(
                Strings.killSession.failed(sessionId, snapshot.errorMessage),
            );
            return;
        }
        if (!snapshot.snapshot) {
            void vscode.window.showWarningMessage(Strings.killSession.alreadyGone(sessionId));
            await this.loadSection(AdminSection.Sessions);
            return;
        }
        if (!isSameSession(snapshot.snapshot, session)) {
            void vscode.window.showWarningMessage(Strings.killSession.reused(sessionId));
            await this.loadSection(AdminSection.Sessions);
            return;
        }

        const statement = buildKillStatement(sessionId);
        if (!(await this.confirmKill(session, statement))) {
            return;
        }

        const outcome = await this.sessionAdmin.kill(sessionId);
        if (this.isDisposed) {
            return;
        }
        if (outcome.errorMessage) {
            void vscode.window.showErrorMessage(
                Strings.killSession.failed(sessionId, outcome.errorMessage),
            );
        } else {
            void vscode.window.showInformationMessage(Strings.killSession.done(sessionId));
        }

        await this.loadSection(AdminSection.Sessions);
    }

    /**
     * Diálogo modal con la identidad de la sesión, lo que se pierde y **la sentencia exacta**, como
     * pide la regla 11.1 del brief. El botón lleva el número de sesión para que no se confirme a
     * ciegas.
     */
    private async confirmKill(session: ActiveSession, statement: string): Promise<boolean> {
        const summary = Strings.killSession.sessionSummary(
            session.loginName,
            session.hostName,
            session.programName,
            session.databaseName,
        );
        const transactionWarning =
            session.longestOpenTransactionSeconds > 0
                ? `\n\n${Strings.killSession.openTransactionWarning(
                      formatSeconds(session.longestOpenTransactionSeconds),
                  )}`
                : "";
        const action = Strings.killSession.confirmAction(session.sessionId);

        const chosen = await vscode.window.showWarningMessage(
            Strings.killSession.confirmTitle(session.sessionId),
            {
                modal: true,
                detail: Strings.killSession.confirmDetail(
                    `${summary}${transactionWarning}`,
                    statement,
                ),
            },
            action,
        );
        return chosen === action;
    }

    /** Publica en el estado qué puede hacer la conexión con las sesiones. */
    private publishCapabilities(permissions: KillPermissions): void {
        const capabilities: SessionCapabilities = {
            ...permissions,
            canKill: canKillSessions(permissions),
        };
        this.state = { ...this.state, sessionCapabilities: capabilities };
    }

    /**
     * Lee una sección del servidor y publica el resultado en el estado.
     *
     * No lanza: un fallo de permisos o de red se muestra dentro de la sección, y las demás siguen
     * funcionando.
     */
    private async loadSection(section: AdminSection, database?: string): Promise<void> {
        if (section === AdminSection.Overview) {
            return;
        }
        const key = SECTION_STATE_KEYS[section];

        this.updateSection(key, { status: "loading" });

        const result = await this.read(section, database ?? this.state.selectedDatabase);
        if (this.isDisposed) {
            return;
        }

        this.updateSection(
            key,
            result.errorMessage
                ? { status: "error", errorMessage: result.errorMessage }
                : { status: "loaded", data: result.data, readAt: new Date().toISOString() },
        );

        // El botón de terminar sesión tiene que salir ya habilitado o deshabilitado, con su motivo,
        // sin esperar a que alguien lo pulse.
        if (section === AdminSection.Sessions) {
            const permissions = await this.sessionAdmin.loadPermissions();
            if (!this.isDisposed && permissions.permissions) {
                this.publishCapabilities(permissions.permissions);
            }
        }
    }

    /**
     * Despacha la lectura a la consulta que corresponde.
     *
     * Las secciones de base reciben el nombre de la base seleccionada, que va validado y entre
     * corchetes dentro de la consulta. Si el nombre no es válido, ni se intenta.
     */
    private async read(section: AdminSection, database: string): Promise<SectionResult<unknown>> {
        if (isDatabaseSection(section) && !isValidIdentifier(database)) {
            return { errorMessage: Strings.adminPanel.invalidDatabaseName };
        }

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
            case AdminSection.Users:
                return await this.databaseSecurity.loadUsers(database);
            case AdminSection.DatabaseRoles:
                return await this.databaseSecurity.loadRoles(database);
            case AdminSection.Schemas:
                return await this.databaseSecurity.loadSchemas(database);
            case AdminSection.DatabasePermissions:
                return await this.databaseSecurity.loadPermissionData(database);
            default:
                return { errorMessage: Strings.adminPanel.unknownSection };
        }
    }

    /**
     * Reemplaza el estado de una sección sin tocar las demás.
     *
     * `databases` no es una sección con pestaña —es el selector de la cabecera— pero tiene el mismo
     * ciclo de carga, así que comparte el mecanismo.
     */
    private updateSection(
        key: (typeof SECTION_STATE_KEYS)[keyof typeof SECTION_STATE_KEYS] | "databases",
        value: SectionState<unknown>,
    ): void {
        this.state = { ...this.state, [key]: value } as AdminPanelState;
    }
}
