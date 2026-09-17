/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as chai from "chai";
import sinonChai from "sinon-chai";
import * as sinon from "sinon";
import * as vscode from "vscode";

import ConnectionManager from "../../../src/controllers/connectionManager";
import { TreeNodeInfo } from "../../../src/objectExplorer/nodes/treeNodeInfo";
import { AdminPanelController } from "../../../src/custom/admin/panels/adminPanelController";
import { CustomWebviewKind } from "../../../src/custom/sharedInterfaces/customWebview";
import { Strings } from "../../../src/custom/strings";
import { stubTelemetry } from "../utils";

chai.use(sinonChai);

const SERVER = "sql-prod-01";
const CONNECTION_URI = "connection:sql-prod-01";

suite("Fork: AdminPanelController", () => {
    let sandbox: sinon.SinonSandbox;
    let context: vscode.ExtensionContext;
    let showErrorMessage: sinon.SinonStub;

    function makeNode(): TreeNodeInfo {
        return {
            nodeType: "Server",
            connectionProfile: {
                server: SERVER,
                database: "Ventas",
                authenticationType: "Integrated",
                profileName: "Producción",
            },
            metadata: undefined,
            parentNode: undefined,
        } as unknown as TreeNodeInfo;
    }

    function makeConnectionManager(connected = true) {
        return {
            getUriForConnection: sandbox.stub().returns(CONNECTION_URI),
            isConnected: sandbox.stub().returns(connected),
            getServerInfo: sandbox.stub().returns({ serverVersion: "16.0.1000.6" }),
        } as unknown as ConnectionManager;
    }

    setup(() => {
        sandbox = sinon.createSandbox();
        stubTelemetry(sandbox);
        showErrorMessage = sandbox.stub(vscode.window, "showErrorMessage");

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

    test("abre el panel sabiendo a qué servidor y base apunta", () => {
        const controller = AdminPanelController.createForNode(
            context,
            makeNode(),
            makeConnectionManager(),
        );

        expect(controller, "debería crear el panel").to.not.equal(undefined);
        expect(controller.state.view).to.equal(CustomWebviewKind.AdminPanel);
        expect(controller.state.target.server).to.equal(SERVER);
        expect(controller.state.target.database).to.equal("Ventas");
        expect(controller.state.target.authenticationType).to.equal("Integrated");
        // Es la identidad con la que M3 y siguientes hablarán con el SQL Tools Service.
        expect(controller.connectionUri).to.equal(CONNECTION_URI);
    });

    test("usa el bundle del router de webviews del fork", () => {
        const createWebviewPanel = vscode.window.createWebviewPanel as sinon.SinonStub;
        AdminPanelController.createForNode(context, makeNode(), makeConnectionManager());

        const html = createWebviewPanel.firstCall.returnValue.webview.html as string;
        // Un solo entry point de esbuild para todas nuestras vistas. Ver FORK.md §16.
        expect(html).to.contain("sqlworks.js");
        expect(html).to.contain("sqlworks.css");
    });

    test("no abre panel y avisa si el perfil no está conectado", () => {
        const controller = AdminPanelController.createForNode(
            context,
            makeNode(),
            makeConnectionManager(false),
        );

        expect(controller).to.equal(undefined);
        expect(showErrorMessage).to.have.been.calledOnceWithExactly(
            Strings.adminPanel.notConnected(SERVER),
        );
        expect(vscode.window.createWebviewPanel).to.not.have.been.called;
    });

    test("no abre panel y avisa si se invoca sin nodo, como desde la paleta", () => {
        const controller = AdminPanelController.createForNode(
            context,
            undefined,
            makeConnectionManager(),
        );

        expect(controller).to.equal(undefined);
        expect(showErrorMessage).to.have.been.calledOnceWithExactly(
            Strings.adminPanel.noTargetNode,
        );
    });
});
