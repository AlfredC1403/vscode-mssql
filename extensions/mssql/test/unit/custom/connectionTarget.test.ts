/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { expect } from "chai";
import * as sinon from "sinon";
import sinonChai from "sinon-chai";

import ConnectionManager from "../../../src/controllers/connectionManager";
import { TreeNodeInfo } from "../../../src/objectExplorer/nodes/treeNodeInfo";
import { resolveConnectionTarget } from "../../../src/custom/util/connectionTarget";
import { Strings } from "../../../src/custom/strings";

// Se registra aquí, como en el resto de la suite del upstream: cada fichero lo hace por su cuenta,
// para que ejecutarlo suelto (`--grep`, un solo fichero) dé el mismo resultado que la suite entera.
chai.use(sinonChai);

const SERVER = "sql-dev-01";
const CONNECTION_URI = "connection:sql-dev-01";

/**
 * Construye un nodo del árbol mínimo pero con la forma que consume `resolveConnectionTarget`:
 * un perfil de conexión y, opcionalmente, metadatos de base de datos.
 *
 * Cast a través de un objeto plano porque `TreeNodeInfo` es una clase con estado interno y aquí
 * solo interesan las propiedades que lee la función.
 */
function makeNode(overrides: Partial<Record<string, unknown>> = {}): TreeNodeInfo {
    return {
        nodeType: "Server",
        connectionProfile: {
            server: SERVER,
            database: "AdventureWorks",
            authenticationType: "SqlLogin",
            user: "sa",
            profileName: "Desarrollo",
        },
        metadata: undefined,
        parentNode: undefined,
        ...overrides,
    } as unknown as TreeNodeInfo;
}

function makeConnectionManager(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        getUriForConnection: sinon.stub().returns(CONNECTION_URI),
        isConnected: sinon.stub().returns(true),
        getServerInfo: sinon.stub().returns({
            serverVersion: "16.0.4295.3",
            serverEdition: "Developer Edition (64-bit)",
            isCloud: false,
        }),
        ...overrides,
    } as unknown as ConnectionManager;
}

suite("Fork: resolveConnectionTarget", () => {
    test("resuelve servidor, base de datos y datos del motor desde la conexión activa", () => {
        const result = resolveConnectionTarget(makeNode(), makeConnectionManager());

        expect(result.errorMessage, "no debería haber error").to.equal(undefined);
        expect(result.connectionUri).to.equal(CONNECTION_URI);
        expect(result.target.server).to.equal(SERVER);
        expect(result.target.database).to.equal("AdventureWorks");
        expect(result.target.authenticationType).to.equal("SqlLogin");
        expect(result.target.userName).to.equal("sa");
        expect(result.target.profileName).to.equal("Desarrollo");
        expect(result.target.serverVersion).to.equal("16.0.4295.3");
        expect(result.target.serverEdition).to.equal("Developer Edition (64-bit)");
        expect(result.target.isCloud).to.equal(false);
        expect(new Date(result.target.readAt).toString()).to.not.equal("Invalid Date");
    });

    test("toma la base de datos de los metadatos cuando el nodo cuelga de una base", () => {
        const databaseNode = makeNode({
            nodeType: "Table",
            metadata: { metadataTypeName: "Table", name: "Cliente", schema: "ventas" },
            parentNode: {
                nodeType: "Folder",
                metadata: { metadataTypeName: "Database", name: "ParityDb" },
                parentNode: undefined,
            },
        });

        const result = resolveConnectionTarget(databaseNode, makeConnectionManager());

        // Para un nodo que no es de servidor, la base sale subiendo por los padres, no del perfil.
        expect(result.target.database).to.equal("ParityDb");
    });

    test("dice que la base es la predeterminada si el perfil no fija ninguna", () => {
        const node = makeNode({
            connectionProfile: {
                server: SERVER,
                database: "",
                authenticationType: "SqlLogin",
            },
        });

        const result = resolveConnectionTarget(node, makeConnectionManager());

        // El panel nunca debe quedarse sin decir a qué base apunta.
        expect(result.target.database).to.equal(Strings.adminPanel.defaultDatabase);
    });

    test("falla con un mensaje claro si no hay nodo", () => {
        const result = resolveConnectionTarget(undefined, makeConnectionManager());

        expect(result.errorMessage).to.equal(Strings.adminPanel.noTargetNode);
        expect(result.target).to.equal(undefined);
    });

    test("falla si el nodo no tiene perfil de conexión", () => {
        const result = resolveConnectionTarget(
            makeNode({ connectionProfile: undefined }),
            makeConnectionManager(),
        );

        expect(result.errorMessage).to.equal(Strings.adminPanel.noConnectionProfile);
    });

    test("falla, y no abre conexión propia, si el perfil no está conectado", () => {
        const isConnected = sinon.stub().returns(false);
        const connectionManager = makeConnectionManager({ isConnected });

        const result = resolveConnectionTarget(makeNode(), connectionManager);

        expect(result.errorMessage).to.equal(Strings.adminPanel.notConnected(SERVER));
        expect(isConnected).to.have.been.calledOnceWithExactly(CONNECTION_URI);
        // Regla 16.2 del brief: reutilizamos la gestión de conexiones del upstream y no creamos
        // una segunda. La función no debe intentar conectar por su cuenta.
        expect((connectionManager as unknown as { connect?: unknown }).connect).to.equal(undefined);
    });

    test("falla si la extensión no tiene URI para ese perfil", () => {
        const result = resolveConnectionTarget(
            makeNode(),
            makeConnectionManager({ getUriForConnection: sinon.stub().returns("") }),
        );

        expect(result.errorMessage).to.equal(Strings.adminPanel.notConnected(SERVER));
    });

    test("tolera que el motor no haya informado su versión", () => {
        const result = resolveConnectionTarget(
            makeNode(),
            makeConnectionManager({ getServerInfo: sinon.stub().returns(undefined) }),
        );

        expect(result.errorMessage).to.equal(undefined);
        expect(result.target.server).to.equal(SERVER);
        expect(result.target.serverVersion).to.equal(undefined);
        expect(result.target.isCloud).to.equal(undefined);
    });
});
