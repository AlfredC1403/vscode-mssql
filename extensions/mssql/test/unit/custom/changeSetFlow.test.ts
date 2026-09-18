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
import {
    AdminPanelState,
    StageChangeRequest,
} from "../../../src/custom/sharedInterfaces/adminPanel";
import { Strings } from "../../../src/custom/strings";
import { stubTelemetry } from "../utils";

chai.use(sinonChai);

/**
 * Lo que se fija aquí es la cadena de la regla 11 del brief, no la comodidad de la API:
 *
 * - Sin confirmar, **no se envía nada** al servidor.
 * - El webview ejecuta con un **nonce**, nunca con T-SQL: si la lista cambió, el plan caduca.
 * - Lo destructivo y lo de producción exigen **escribir el nombre**.
 * - Lo que se envía es **un solo lote** con `SET XACT_ABORT ON`, una transacción y ningún `GO`.
 */
const SERVER = "sql-prod-01";
const CONNECTION_URI = "connection:sql-prod-01";

function report(rows: (string | null)[][]): SimpleExecuteResult {
    const columns = ["resultado", "paso", "etiqueta", "numero", "mensaje", "trancount_final"];
    return {
        rowCount: rows.length,
        columnInfo: columns.map((columnName) => ({ columnName }) as never),
        rows: rows.map((row) =>
            row.map((value) => ({ displayValue: value ?? "NULL", isNull: value === null })),
        ),
    } as SimpleExecuteResult;
}

suite("Fork: aplicar cambios pendientes", () => {
    let sandbox: sinon.SinonSandbox;
    let context: vscode.ExtensionContext;
    let showWarningMessage: sinon.SinonStub;
    let showErrorMessage: sinon.SinonStub;
    let showInformationMessage: sinon.SinonStub;
    let showInputBox: sinon.SinonStub;
    /** Todo lo que se mandó al servidor, en orden. */
    let sent: string[];
    /** Resultado que devolverá el lote. */
    let batchReport: SimpleExecuteResult;

    function makeNode(): TreeNodeInfo {
        return {
            nodeType: "Server",
            connectionProfile: {
                id: "perfil-1",
                server: SERVER,
                database: "ParityDb",
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
            sent.push(query);
            if (query.includes("@resultado")) {
                return Promise.resolve(batchReport);
            }
            return Promise.resolve(report([]));
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

    /** Llama a un reducer como lo hace el propio upstream en sus tests. */
    async function dispatch(
        controller: AdminPanelController,
        name: string,
        state: AdminPanelState,
        payload: unknown,
    ): Promise<AdminPanelState> {
        const reducers = controller["_reducerHandlers"] as Map<
            string,
            (state: AdminPanelState, payload: unknown) => Promise<AdminPanelState>
        >;
        const next = (await reducers.get(name)(state, payload)) as AdminPanelState;
        // `WebviewBaseController` hace exactamente esto al despachar (`this.state = await reducer`),
        // así que el test lo reproduce: si no, el controlador no vería los cambios montados.
        controller.state = next;
        return next;
    }

    /** Monta un cambio y devuelve el estado resultante. */
    async function stage(
        controller: AdminPanelController,
        state: AdminPanelState,
        request: StageChangeRequest,
    ): Promise<AdminPanelState> {
        return await dispatch(controller, "stageChange", state, { request });
    }

    /** Sentencias de lote que llegaron al servidor (las que llevan el envoltorio). */
    function batchesSent(): string[] {
        return sent.filter((query) => query.includes("BEGIN TRANSACTION"));
    }

    const GRANT_REQUEST: StageChangeRequest = {
        kind: "serverPermission",
        action: "GRANT",
        permission: "VIEW ANY DEFINITION",
        principal: "analista",
        currentState: "NONE",
    };

    const MEMBERSHIP_REQUEST: StageChangeRequest = {
        kind: "serverRoleMembership",
        action: "ADD",
        role: "dbcreator",
        member: "analista",
    };

    setup(() => {
        sandbox = sinon.createSandbox();
        stubTelemetry(sandbox);
        sent = [];
        batchReport = report([["aplicado", "0", "", "0", "", "0"]]);

        showWarningMessage = sandbox.stub(vscode.window, "showWarningMessage");
        showErrorMessage = sandbox.stub(vscode.window, "showErrorMessage");
        showInformationMessage = sandbox.stub(vscode.window, "showInformationMessage");
        showInputBox = sandbox.stub(vscode.window, "showInputBox");

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

    test("montar un cambio no ejecuta nada", async () => {
        const controller = makeController();

        const state = await stage(controller, controller.state, GRANT_REQUEST);

        expect(state.pendingChanges).to.have.length(1);
        expect(state.pendingChanges[0].sql).to.equal("GRANT VIEW ANY DEFINITION TO [analista]");
        expect(batchesSent(), "montar no escribe").to.deep.equal([]);
    });

    test("un cambio que no se puede construir avisa y no se monta", async () => {
        const controller = makeController();

        const state = await stage(controller, controller.state, {
            ...GRANT_REQUEST,
            principal: "x; DROP DATABASE ParityDb",
        });

        expect(state.pendingChanges).to.have.length(0);
        expect(showErrorMessage).to.have.been.called;
        // Y el mensaje no repite el valor rechazado.
        expect(showErrorMessage.firstCall.args[0]).to.not.contain("DROP");
    });

    test("un permiso que no está en la lista cerrada no se monta", async () => {
        const controller = makeController();

        const state = await stage(controller, controller.state, {
            ...GRANT_REQUEST,
            permission: "SELECT ALL",
        });

        expect(state.pendingChanges).to.have.length(0);
        expect(showErrorMessage.firstCall.args[0]).to.match(/no está en la lista/);
    });

    test("la vista previa publica los dos textos y un nonce, y ningún T-SQL ejecutable", async () => {
        const controller = makeController();
        let state = await stage(controller, controller.state, GRANT_REQUEST);
        state = await stage(controller, state, MEMBERSHIP_REQUEST);

        state = await dispatch(controller, "buildPreview", state, {});

        expect(state.preview.previewId).to.match(/^plan-\d+$/);
        expect(state.preview.statementCount).to.equal(2);
        // El texto exacto es el que se envía: con el envoltorio y sin GO.
        expect(state.preview.exactBatch).to.contain("SET XACT_ABORT ON");
        expect(state.preview.exactBatch).to.contain("BEGIN TRANSACTION");
        expect(state.preview.exactBatch).to.contain("EXEC [master].sys.sp_executesql");
        expect(/\bGO\b/.test(state.preview.exactBatch)).to.equal(false);
        // El legible lleva las mismas sentencias.
        expect(state.preview.readableScript).to.contain("GRANT VIEW ANY DEFINITION TO [analista]");
        expect(state.preview.readableScript).to.contain(
            "ALTER SERVER ROLE [dbcreator] ADD MEMBER [analista]",
        );
        expect(batchesSent()).to.deep.equal([]);
    });

    test("si se cancela el diálogo, NO se envía nada al servidor", async () => {
        showWarningMessage.resolves(undefined);
        const controller = makeController();
        let state = await stage(controller, controller.state, GRANT_REQUEST);
        state = await dispatch(controller, "buildPreview", state, {});

        await dispatch(controller, "applyChanges", state, { previewId: state.preview.previewId });

        expect(batchesSent(), "cancelar no ejecuta").to.deep.equal([]);
        // Y el diálogo mostró el script completo.
        const [, options] = showWarningMessage.firstCall.args;
        expect(options.modal).to.equal(true);
        expect(options.detail).to.contain("GRANT VIEW ANY DEFINITION TO [analista]");
        expect(options.detail).to.contain("una sola transacción");
    });

    test("un nonce que ya no corresponde no ejecuta nada", async () => {
        showWarningMessage.resolves(Strings.writeGate.confirmAction(1));
        const controller = makeController();
        let state = await stage(controller, controller.state, GRANT_REQUEST);
        state = await dispatch(controller, "buildPreview", state, {});
        const staleId = state.preview.previewId;

        // Montar otro cambio invalida el plan anterior.
        state = await stage(controller, state, MEMBERSHIP_REQUEST);
        expect(state.preview, "la vista previa se invalida").to.equal(undefined);

        await dispatch(controller, "applyChanges", state, { previewId: staleId });

        expect(batchesSent()).to.deep.equal([]);
        expect(showWarningMessage.lastCall.args[0]).to.equal(Strings.writeGate.planExpired);
    });

    test("al confirmar se envía un solo lote, y se informa", async () => {
        showWarningMessage.resolves(Strings.writeGate.confirmAction(2));
        const controller = makeController();
        let state = await stage(controller, controller.state, GRANT_REQUEST);
        state = await stage(controller, state, MEMBERSHIP_REQUEST);
        state = await dispatch(controller, "buildPreview", state, {});

        await dispatch(controller, "applyChanges", state, { previewId: state.preview.previewId });

        const batches = batchesSent();
        expect(batches, "un solo lote, en una sola llamada").to.have.length(1);
        expect(batches[0]).to.contain("SET @paso = 1;");
        expect(batches[0]).to.contain("SET @paso = 2;");
        expect(showInformationMessage).to.have.been.calledWith(Strings.writeGate.applied(2));
        // La lista se vacía al aplicar.
        expect(controller.state.pendingChanges).to.have.length(0);
    });

    test("si el lote se revierte, ningún cambio queda aplicado y se dice cuál falló", async () => {
        showWarningMessage.resolves(Strings.writeGate.confirmAction(2));
        batchReport = report([
            [
                "revertido",
                "2",
                "Añadir analista al rol de servidor dbcreator",
                "15151",
                "no existe",
                "0",
            ],
        ]);
        const controller = makeController();
        let state = await stage(controller, controller.state, GRANT_REQUEST);
        state = await stage(controller, state, MEMBERSHIP_REQUEST);
        state = await dispatch(controller, "buildPreview", state, {});

        await dispatch(controller, "applyChanges", state, { previewId: state.preview.previewId });

        const result = controller.state.lastResult;
        expect(result.outcome).to.equal("rolledBack");
        // Todo o nada: el primero tampoco quedó aplicado.
        expect(result.statuses[0].status).to.equal("rolledBack");
        expect(result.statuses[1].status).to.equal("failed");
        expect(showErrorMessage.lastCall.args[0]).to.contain("dbcreator");
        // La lista NO se vacía: el usuario puede corregir y volver a intentarlo.
        expect(controller.state.pendingChanges).to.have.length(2);
    });

    test("una transacción heredada no se toca", async () => {
        showWarningMessage.resolves(Strings.writeGate.confirmAction(1));
        batchReport = report([["transaccion_heredada", "0", "", "0", "", "1"]]);
        const controller = makeController();
        let state = await stage(controller, controller.state, GRANT_REQUEST);
        state = await dispatch(controller, "buildPreview", state, {});

        await dispatch(controller, "applyChanges", state, { previewId: state.preview.previewId });

        expect(controller.state.lastResult.outcome).to.equal("inheritedTransaction");
        expect(showWarningMessage.lastCall.args[0]).to.equal(
            Strings.writeGate.inheritedTransaction,
        );
    });

    test("lo destructivo exige escribir el nombre, y sin eso no se ejecuta", async () => {
        showWarningMessage.resolves(Strings.writeGate.confirmAction(1));
        showInputBox.resolves(undefined); // el usuario cancela la caja de texto
        const controller = makeController();
        let state = await stage(controller, controller.state, {
            kind: "dropUser",
            user: "analista",
            createDate: "2026-09-17T23:49:53.533",
        });
        state = await dispatch(controller, "buildPreview", state, {});

        expect(state.preview.typeToConfirm).to.equal("analista");
        await dispatch(controller, "applyChanges", state, { previewId: state.preview.previewId });

        expect(showInputBox, "tiene que pedir el nombre").to.have.been.called;
        expect(batchesSent(), "sin escribir el nombre no se ejecuta").to.deep.equal([]);
    });

    test("escribiendo el nombre correcto sí se ejecuta", async () => {
        showWarningMessage.resolves(Strings.writeGate.confirmAction(1));
        showInputBox.resolves("analista");
        const controller = makeController();
        let state = await stage(controller, controller.state, {
            kind: "dropUser",
            user: "analista",
            createDate: "2026-09-17T23:49:53.533",
        });
        state = await dispatch(controller, "buildPreview", state, {});

        await dispatch(controller, "applyChanges", state, { previewId: state.preview.previewId });

        const batches = batchesSent();
        expect(batches).to.have.length(1);
        expect(batches[0]).to.contain("DROP USER [analista]");
        // Y lleva la precondición de identidad dentro de la transacción.
        expect(batches[0]).to.contain("THROW 50001");
        expect(batches[0]).to.contain("CONVERT(varchar(33), create_date, 126)");
    });

    test("quitar y vaciar cambios invalida la vista previa", async () => {
        const controller = makeController();
        let state = await stage(controller, controller.state, GRANT_REQUEST);
        state = await dispatch(controller, "buildPreview", state, {});
        expect(state.preview).to.not.equal(undefined);

        state = await dispatch(controller, "unstageChange", state, {
            id: state.pendingChanges[0].id,
        });
        expect(state.pendingChanges).to.have.length(0);
        expect(state.preview).to.equal(undefined);

        state = await stage(controller, state, GRANT_REQUEST);
        state = await dispatch(controller, "clearChanges", state, {});
        expect(state.pendingChanges).to.have.length(0);
        expect(state.preview).to.equal(undefined);
    });

    test("cambiar de base descarta los cambios de esa base, con aviso, y deja los de servidor", async () => {
        const controller = makeController();
        let state = await stage(controller, controller.state, GRANT_REQUEST);
        state = await stage(controller, state, {
            kind: "databaseRoleMembership",
            action: "ADD",
            role: "ventas_lectores",
            member: "analista",
        });
        expect(state.pendingChanges).to.have.length(2);

        state = await dispatch(controller, "selectDatabase", state, { database: "master" });

        expect(state.pendingChanges).to.have.length(1);
        expect(state.pendingChanges[0].scope).to.equal("Servidor");
        expect(showWarningMessage.lastCall.args[0]).to.match(/descart/);
    });

    test("el estado publicado no lleva ningún campo de contraseña", async () => {
        // M5 no tiene operaciones con contraseña, y el estado se serializa al webview.
        const controller = makeController();
        let state = await stage(controller, controller.state, GRANT_REQUEST);
        state = await dispatch(controller, "buildPreview", state, {});

        const serialized = JSON.stringify(state).toLowerCase();
        expect(serialized).to.not.contain("password");
        expect(serialized).to.not.contain("contrasena");
        expect(serialized).to.not.contain("contraseña");
    });
});
