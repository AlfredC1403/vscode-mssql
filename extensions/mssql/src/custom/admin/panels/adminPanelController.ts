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
import { ChangeSetService } from "../changeSetService";
import { isValidIdentifier } from "../../util/identifiers";
import {
    ExecutionPlan,
    PlannedStatement,
    renderReadableScript,
    validatePlan,
} from "../sql/ddl/plan";
import { buildTransactionalBatch } from "../sql/writeGate";
import { stageRequestToStatement } from "./stageChange";
import { confirmByTypingName, confirmPlan } from "./writeConfirm";
import {
    ChangeSetResult,
    PendingChange,
    PreviewFacts,
    ProductionState,
} from "../../sharedInterfaces/pendingChanges";
import {
    PRODUCTION_SETTING_KEY,
    ProductionServersSetting,
    evaluateProduction,
    isSettingEmpty,
} from "../../util/production";
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
    private readonly changeSet: ChangeSetService;

    /**
     * El plan vivo, guardado **solo en el host**, con su nonce.
     *
     * El webview nunca manda T-SQL: manda el nonce. Así «lo ejecutado es lo previsualizado» no es una
     * promesa, es la única forma en que el código puede funcionar (regla 11.1 del brief).
     */
    private currentPlan?: ExecutionPlan;
    /**
     * Las sentencias construidas, por identificador de cambio. **Viven solo en el host**: al webview
     * se le publica el texto para mostrarlo, pero el T-SQL que se ejecuta sale siempre de aquí.
     */
    private readonly plannedStatements = new Map<string, PlannedStatement>();
    /** Contador de los identificadores de los cambios pendientes. Estable para los tests. */
    private changeCounter = 0;
    /** Contador de los nonces de plan. Cada vista previa genera uno nuevo. */
    private planCounter = 0;

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
        this.changeSet = new ChangeSetService(runner);
        this.registerReducers();
        this.publishProductionState();
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
                pendingChanges: [],
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

        // --- Cambios pendientes (M5) ---

        this.registerReducer("stageChange", (state, payload) => {
            const staged = stageRequestToStatement(payload.request, state.selectedDatabase);
            if (staged.errorMessage || !staged.statement || !staged.change) {
                void vscode.window.showErrorMessage(
                    staged.errorMessage ?? Strings.adminPanel.unknownSection,
                );
                return state;
            }

            this.changeCounter += 1;
            const change: PendingChange = { ...staged.change, id: `cambio-${this.changeCounter}` };
            this.plannedStatements.set(change.id, staged.statement);

            // Montar un cambio invalida el plan **en el host**, no solo en el webview: si solo se
            // borrara la vista previa, un nonce viejo seguiría coincidiendo con el plan guardado y
            // se podría ejecutar una lista que ya no es la que se mostró.
            this.currentPlan = undefined;
            return {
                ...state,
                pendingChanges: [...state.pendingChanges, change],
                preview: undefined,
                lastResult: undefined,
            };
        });

        this.registerReducer("unstageChange", (state, payload) => {
            this.plannedStatements.delete(payload.id);
            this.currentPlan = undefined;
            return {
                ...state,
                pendingChanges: state.pendingChanges.filter((change) => change.id !== payload.id),
                preview: undefined,
            };
        });

        this.registerReducer("clearChanges", (state) => {
            this.plannedStatements.clear();
            this.currentPlan = undefined;
            return { ...state, pendingChanges: [], preview: undefined, lastResult: undefined };
        });

        this.registerReducer("buildPreview", (state) => {
            const built = this.buildPlan(state);
            if (built.errorMessage) {
                void vscode.window.showErrorMessage(built.errorMessage);
                return { ...state, preview: undefined };
            }
            this.currentPlan = built.plan;
            return { ...state, preview: toPreviewFacts(built.plan) };
        });

        this.registerReducer("applyChanges", async (state, payload) => {
            await this.applyChanges(state, payload.previewId);
            // `applyChanges` publica el estado por su cuenta: resultado y relectura.
            return this.state;
        });

        this.registerReducer("copyScriptToEditor", async (state) => {
            const built = this.buildPlan(state);
            if (built.errorMessage) {
                void vscode.window.showErrorMessage(built.errorMessage);
                return state;
            }
            const header = Strings.writeGate.scriptDocumentHeader(
                state.target?.server ?? "",
                state.selectedDatabase,
            );
            const document = await vscode.workspace.openTextDocument({
                language: "sql",
                content: `${header}\n${renderReadableScript(built.plan)}\n`,
            });
            await vscode.window.showTextDocument(document, { preview: false });
            return state;
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

            // Los cambios de ámbito de base se montaron contra la base anterior, así que dejan de
            // valer: se descartan con aviso visible en lugar de ejecutarse contra la base nueva.
            const dropped = state.pendingChanges.filter((change) => change.scope !== "Servidor");
            if (dropped.length > 0) {
                for (const change of dropped) {
                    this.plannedStatements.delete(change.id);
                }
                next.pendingChanges = state.pendingChanges.filter(
                    (change) => change.scope === "Servidor",
                );
                next.preview = undefined;
                this.currentPlan = undefined;
                void vscode.window.showWarningMessage(
                    Strings.adminPanel.pendingChangesDropped(dropped.length, database),
                );
            }
            if (isDatabaseSection(state.activeSection)) {
                void this.loadSection(state.activeSection, database);
            }
            return next;
        });
    }

    /**
     * Construye el plan a partir de la lista de cambios pendientes.
     *
     * El plan se calcula **en el host** y se guarda con un nonce nuevo. Cualquier cambio en la lista
     * genera otro nonce, así que un plan viejo no se puede ejecutar (regla 11.1 del brief).
     */
    private buildPlan(state: AdminPanelState): { plan?: ExecutionPlan; errorMessage?: string } {
        if (state.pendingChanges.length === 0) {
            return { errorMessage: Strings.writeGate.planEmpty };
        }

        const statements: PlannedStatement[] = [];
        for (const change of state.pendingChanges) {
            const statement = this.plannedStatements.get(change.id);
            if (!statement) {
                return { errorMessage: Strings.writeGate.planExpired };
            }
            statements.push(statement);
        }

        const destructive = state.pendingChanges.filter((change) => change.destructive);
        const production = state.productionState?.production ?? false;

        this.planCounter += 1;
        const plan: ExecutionPlan = {
            id: `plan-${this.planCounter}`,
            title: Strings.writeGate.planTitle(statements.length),
            statements,
            irreversible: [],
            // Escribir el nombre: lo destructivo siempre, y todo cambio en un servidor marcado como
            // de producción (reglas 11.4 y 11.5 del brief).
            typeToConfirm:
                destructive.length > 0
                    ? destructive[0].subject
                    : production
                      ? (state.target?.server ?? undefined)
                      : undefined,
            production,
        };

        const problem = validatePlan(plan);
        return problem ? { errorMessage: Strings.writeGate.planInvalid(problem) } : { plan };
    }

    /**
     * Aplica los cambios pendientes.
     *
     * El orden es el que exige el §11 del brief:
     *
     * 1. El nonce tiene que coincidir con el plan vivo. Si la lista cambió, no se ejecuta nada.
     * 2. Se muestra **el lote completo** y se pide confirmación.
     * 3. Si hay algo destructivo, o el servidor está marcado como de producción, hay que **escribir
     *    el nombre**.
     * 4. Solo entonces se abre la transacción y se ejecuta: nunca antes del diálogo, para no retener
     *    bloqueos con una ventana abierta en pantalla.
     * 5. Se relee la sección visible y se publica el estado por cambio.
     *
     * **No se comprueban los permisos de escritura antes de ejecutar**, y es deliberado:
     * `HAS_PERMS_BY_NAME(NULL, NULL, 'ALTER ANY USER')` devuelve **NULL** en lugar de 0 —medido—, así
     * que una comprobación previa mal interpretada bloquearía incluso a `sa`. La transacción hace
     * inocuo el fallo de permisos: se revierte todo y el panel muestra el mensaje del motor.
     */
    private async applyChanges(state: AdminPanelState, previewId: string): Promise<void> {
        const plan = this.currentPlan;
        if (!plan || plan.id !== previewId) {
            void vscode.window.showWarningMessage(Strings.writeGate.planExpired);
            return;
        }

        if (!(await confirmPlan(plan))) {
            return;
        }

        if (plan.typeToConfirm) {
            const what = state.pendingChanges.some((change) => change.destructive)
                ? "del objeto que se va a borrar"
                : "del servidor de producción";
            if (!(await confirmByTypingName(plan.typeToConfirm, what))) {
                return;
            }
        }

        const result = await this.changeSet.apply(plan, state.pendingChanges);
        if (this.isDisposed) {
            return;
        }

        this.report(result);

        // Se relee la sección visible. Si la relectura falla, hay que decirlo: la pantalla puede no
        // reflejar el servidor.
        if (result.outcome === "applied") {
            this.plannedStatements.clear();
            this.currentPlan = undefined;
            this.state = {
                ...this.state,
                pendingChanges: [],
                preview: undefined,
                lastResult: result,
            };
            await this.reloadAfterApply(result);
        } else {
            this.state = { ...this.state, preview: undefined, lastResult: result };
        }
    }

    /** Relee la sección visible tras aplicar, y marca el resultado si la relectura falla. */
    private async reloadAfterApply(result: ChangeSetResult): Promise<void> {
        const section = this.state.activeSection;
        if (section === AdminSection.Overview) {
            return;
        }
        await this.loadSection(section);
        if (this.isDisposed) {
            return;
        }

        const reloaded = this.state[SECTION_STATE_KEYS[section]] as SectionState<unknown>;
        if (reloaded?.status === "error") {
            void vscode.window.showWarningMessage(Strings.writeGate.staleAfterApply);
            this.state = {
                ...this.state,
                lastResult: { ...result, staleAfterApply: true },
            };
        }
    }

    /** Cuenta lo que pasó, con el mensaje propio del número de error cuando lo hay. */
    private report(result: ChangeSetResult): void {
        const detail =
            Strings.writeGate.engineError[result.errorNumber] ?? result.errorMessage ?? "";

        switch (result.outcome) {
            case "applied":
                void vscode.window.showInformationMessage(
                    Strings.writeGate.applied(result.statuses.length),
                );
                return;
            case "rolledBack":
                void vscode.window.showErrorMessage(
                    Strings.writeGate.rolledBack(result.failedLabel, detail),
                );
                return;
            case "inheritedTransaction":
                void vscode.window.showWarningMessage(Strings.writeGate.inheritedTransaction);
                return;
            default:
                void vscode.window.showWarningMessage(Strings.writeGate.unknown(detail));
        }
    }

    /**
     * Lee el ajuste de servidores de producción y publica la marca.
     *
     * El ajuste tiene `scope: "application"`, así que solo se lee de los ajustes de usuario: el
     * `settings.json` de un repositorio no puede desmarcar un servidor de producción.
     */
    private publishProductionState(): void {
        const setting = vscode.workspace
            .getConfiguration()
            .get<ProductionServersSetting>(PRODUCTION_SETTING_KEY);
        const target = this.state.target;
        const verdict = evaluateProduction(target?.profileId, target?.server ?? "", setting);

        const productionState: ProductionState = {
            production: verdict.production,
            matchedPattern: verdict.matchedPattern,
            // Que no haya nada marcado tiene que ser visible, no silencioso.
            settingEmpty: isSettingEmpty(setting),
        };
        this.state = { ...this.state, productionState };
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

/**
 * Los **hechos** del plan que se publican al webview.
 *
 * Se publican los dos textos —el legible y el que se envía de verdad— porque la regla 11.1 del brief
 * exige mostrar el T-SQL, y mostrar una versión bonita de lo que se ejecuta no es mostrar lo que se
 * ejecuta. El objeto del plan **no se publica**: para ejecutar, el webview devuelve el nonce.
 */
function toPreviewFacts(plan: ExecutionPlan): PreviewFacts {
    return {
        previewId: plan.id,
        readableScript: renderReadableScript(plan),
        exactBatch: buildTransactionalBatch(plan.statements),
        statementCount: plan.statements.length,
        typeToConfirm: plan.typeToConfirm ?? "",
        production: plan.production,
    };
}
