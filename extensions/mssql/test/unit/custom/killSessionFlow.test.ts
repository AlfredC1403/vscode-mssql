/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as chai from "chai";
import sinonChai from "sinon-chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { SimpleExecuteResult } from "vscode-mssql";

import ConnectionManager from "../../../src/controllers/connectionManager";
import { TreeNodeInfo } from "../../../src/objectExplorer/nodes/treeNodeInfo";
import { AdminPanelController } from "../../../src/custom/admin/panels/adminPanelController";
import { AdminPanelState, AdminSection } from "../../../src/custom/sharedInterfaces/adminPanel";
import { ActiveSession } from "../../../src/custom/admin/sql/types";
import { Strings } from "../../../src/custom/strings";
import { stubTelemetry } from "../utils";

chai.use(sinonChai);

/**
 * Terminar una sesión es la **única** operación del fork que escribe en el servidor, así que lo que
 * se fija aquí no es la interfaz: es que no se ejecute un `KILL` sin permiso, sin confirmación, o
 * sobre una sesión que ya no es la que el usuario vio.
 */
const SERVER = "sql-prod-01";
const CONNECTION_URI = "connection:sql-prod-01";
const VICTIM_ID = 78;
const OWN_SESSION_ID = 51;
const LOGIN_TIME = "2026-09-17T21:40:11.123";

function result(columns: string[], rows: (string | null)[][]): SimpleExecuteResult {
    return {
        rowCount: rows.length,
        columnInfo: columns.map((columnName) => ({ columnName }) as never),
        rows: rows.map((row) =>
            row.map((value) => ({
                displayValue: value ?? "NULL",
                isNull: value === null,
            })),
        ),
    } as SimpleExecuteResult;
}

function victim(overrides: Partial<ActiveSession> = {}): ActiveSession {
    return {
        sessionId: VICTIM_ID,
        loginName: "app_user",
        hostName: "WS-14",
        programName: "SQLWorks",
        status: "sleeping",
        databaseName: "Ventas",
        loginTime: LOGIN_TIME,
        lastRequestStartTime: "2026-09-17T21:41:00.000",
        lastStatement: "UPDATE ventas.Cliente SET nombre = 'x'",
        isCurrentSession: false,
        cpuTimeMs: 12,
        logicalReads: 3,
        openTransactionCount: 1,
        oldestTransactionStart: "2026-09-17T21:40:30.000",
        longestOpenTransactionSeconds: 95,
        ...overrides,
    };
}

suite("Fork: terminar una sesión", () => {
    let sandbox: sinon.SinonSandbox;
    let context: vscode.ExtensionContext;
    let showErrorMessage: sinon.SinonStub;
    let showWarningMessage: sinon.SinonStub;
    let showInformationMessage: sinon.SinonStub;
    /** Todas las sentencias que el panel manda al servidor, en orden. */
    let sent: string[];

    /** Permisos que devolverá la consulta de permisos en cada test. */
    let grantedPermissions: { sysadmin: string; processadmin: string; alterAnyConnection: string };
    /** Identidad que devolverá la relectura de la sesión. `undefined` = ya no existe. */
    let snapshotLoginTime: string | undefined;

    function makeNode(): TreeNodeInfo {
        return {
            nodeType: "Server",
            connectionProfile: {
                server: SERVER,
                database: "Ventas",
                authenticationType: "SqlLogin",
                profileName: "Producción",
            },
            metadata: undefined,
            parentNode: undefined,
        } as unknown as TreeNodeInfo;
    }

    function makeConnectionManager(): ConnectionManager {
        const sendRequest = sandbox.stub().callsFake((_type: unknown, params: unknown) => {
            const query = (params as { queryString: string }).queryString;
            sent.push(query.trim());

            if (query.includes("HAS_PERMS_BY_NAME")) {
                return Promise.resolve(
                    result(
                        [
                            "current_session_id",
                            "login_name",
                            "is_sysadmin",
                            "is_processadmin",
                            "has_alter_any_connection",
                        ],
                        [
                            [
                                String(OWN_SESSION_ID),
                                "panel_login",
                                grantedPermissions.sysadmin,
                                grantedPermissions.processadmin,
                                grantedPermissions.alterAnyConnection,
                            ],
                        ],
                    ),
                );
            }

            if (query.includes(`s.session_id = ${VICTIM_ID}`)) {
                return Promise.resolve(
                    result(
                        ["session_id", "login_name", "host_name", "program_name", "login_time"],
                        snapshotLoginTime === undefined
                            ? []
                            : [
                                  [
                                      String(VICTIM_ID),
                                      "app_user",
                                      "WS-14",
                                      "SQLWorks",
                                      snapshotLoginTime,
                                  ],
                              ],
                    ),
                );
            }

            // Recarga de la sección de sesiones y cualquier otra lectura: lista vacía basta.
            return Promise.resolve(result(["session_id"], []));
        });

        return {
            getUriForConnection: sandbox.stub().returns(CONNECTION_URI),
            isConnected: sandbox.stub().returns(true),
            getServerInfo: sandbox.stub().returns({ serverVersion: "16.0.1000.6" }),
            sendRequest,
        } as unknown as ConnectionManager;
    }

    function makeController(): AdminPanelController {
        return AdminPanelController.createForNode(context, makeNode(), makeConnectionManager());
    }

    /** Estado con la sesión víctima ya leída, que es desde donde se pulsa el botón. */
    function stateWith(session: ActiveSession): AdminPanelState {
        return {
            activeSection: AdminSection.Sessions,
            sessions: { status: "loaded", data: [session] },
        } as unknown as AdminPanelState;
    }

    async function pressKill(
        controller: AdminPanelController,
        session: ActiveSession = victim(),
    ): Promise<void> {
        const reducer = controller["_reducerHandlers"].get("killSession");
        await reducer(stateWith(session), { sessionId: session.sessionId });
    }

    /** Sentencias `KILL` que llegaron al servidor. Debe estar vacío salvo cuando se confirma. */
    function killsSent(): string[] {
        return sent.filter((query) => query.startsWith("KILL"));
    }

    setup(() => {
        sandbox = sinon.createSandbox();
        stubTelemetry(sandbox);
        sent = [];
        grantedPermissions = { sysadmin: "1", processadmin: "1", alterAnyConnection: "1" };
        snapshotLoginTime = LOGIN_TIME;

        showErrorMessage = sandbox.stub(vscode.window, "showErrorMessage");
        showWarningMessage = sandbox.stub(vscode.window, "showWarningMessage");
        showInformationMessage = sandbox.stub(vscode.window, "showInformationMessage");

        const webview = {
            postMessage: sandbox.stub(),
            asWebviewUri: sandbox.stub().returns(vscode.Uri.parse("https://example.com/")),
            onDidReceiveMessage: sandbox.stub(),
            html: "",
        };
        sandbox.stub(vscode.window, "createWebviewPanel").returns({
            webview,
            reveal: sandbox.stub(),
            dispose: sandbox.stub(),
            onDidDispose: sandbox.stub(),
            onDidChangeViewState: sandbox.stub(),
            iconPath: undefined,
        } as unknown as vscode.WebviewPanel);

        context = {
            extensionPath: "/ext",
            extensionUri: vscode.Uri.file("/ext"),
            subscriptions: [],
        } as unknown as vscode.ExtensionContext;
    });

    teardown(() => {
        sandbox.restore();
    });

    test("sin permiso no se ejecuta nada, y se dice qué permiso falta", async () => {
        grantedPermissions = { sysadmin: "0", processadmin: "0", alterAnyConnection: "0" };
        const controller = makeController();

        await pressKill(controller);

        expect(killsSent()).to.deep.equal([]);
        expect(showErrorMessage).to.have.been.calledOnceWithExactly(
            Strings.killSession.noPermission("panel_login"),
        );
        expect(showWarningMessage, "no debería ni preguntar").to.not.have.been.called;
    });

    test("no se puede terminar la sesión del propio panel", async () => {
        const controller = makeController();

        await pressKill(controller, victim({ sessionId: OWN_SESSION_ID, isCurrentSession: true }));

        expect(killsSent()).to.deep.equal([]);
        expect(showErrorMessage).to.have.been.calledOnceWithExactly(Strings.killSession.ownSession);
    });

    test("si el identificador ya es de otra sesión, no se termina nada", async () => {
        // El caso real: SQL Server reutiliza los identificadores en cuanto se liberan.
        snapshotLoginTime = "2026-09-17T22:10:00.000";
        const controller = makeController();

        await pressKill(controller);

        expect(killsSent()).to.deep.equal([]);
        expect(showWarningMessage).to.have.been.calledOnceWithExactly(
            Strings.killSession.reused(VICTIM_ID),
        );
    });

    test("si la sesión ya no existe, se avisa y se recarga la lista", async () => {
        snapshotLoginTime = undefined;
        const controller = makeController();

        await pressKill(controller);

        expect(killsSent()).to.deep.equal([]);
        expect(showWarningMessage).to.have.been.calledOnceWithExactly(
            Strings.killSession.alreadyGone(VICTIM_ID),
        );
    });

    test("muestra la sentencia exacta y no ejecuta si no se confirma", async () => {
        showWarningMessage.resolves(undefined); // el usuario cierra el diálogo
        const controller = makeController();

        await pressKill(controller);

        expect(killsSent(), "cancelar no debe ejecutar nada").to.deep.equal([]);
        const [title, options, action] = showWarningMessage.firstCall.args;
        expect(title).to.equal(Strings.killSession.confirmTitle(VICTIM_ID));
        expect(options.modal, "tiene que ser modal").to.equal(true);
        expect(options.detail, "la sentencia tiene que estar a la vista").to.contain(
            `KILL ${VICTIM_ID};`,
        );
        expect(options.detail, "y el aviso de la transacción abierta").to.contain("1 min 35 s");
        expect(action).to.equal(Strings.killSession.confirmAction(VICTIM_ID));
    });

    test("ejecuta el KILL cuando se confirma, y recarga la lista", async () => {
        showWarningMessage.resolves(Strings.killSession.confirmAction(VICTIM_ID));
        const controller = makeController();

        await pressKill(controller);

        expect(killsSent()).to.deep.equal([`KILL ${VICTIM_ID};`]);
        expect(showInformationMessage).to.have.been.calledOnceWithExactly(
            Strings.killSession.done(VICTIM_ID),
        );
        // La lista se vuelve a leer: el identificador puede reutilizarse de inmediato.
        expect(
            sent.some((query) => query.includes("dm_tran_session_transactions")),
            "debería releer las sesiones",
        ).to.equal(true);
    });

    test("el KILL va suelto: SQL Server lo prohíbe dentro de una transacción", async () => {
        showWarningMessage.resolves(Strings.killSession.confirmAction(VICTIM_ID));
        const controller = makeController();

        await pressKill(controller);

        const kill = killsSent()[0];
        expect(kill).to.equal(`KILL ${VICTIM_ID};`);
        expect(kill.toUpperCase()).to.not.contain("BEGIN TRAN");
        expect(sent.some((query) => query.toUpperCase().includes("BEGIN TRANSACTION"))).to.equal(
            false,
        );
    });
});
