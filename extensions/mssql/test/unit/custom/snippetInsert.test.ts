/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { SnippetInserter, isSqlEditor } from "../../../src/custom/snippets/insert";

/**
 * `SnippetInserter` (M7): de qué editor se acuerda y cuándo avisa de que hay o no destino.
 *
 * El test que importa es «avisa cuando aparece un editor de SQL». La primera versión **no avisaba
 * nunca**, porque comparaba el estado antes y después leyendo `vscode.window.activeTextEditor`, que
 * ya refleja el cambio cuando llega el evento. Lo encontró el e2e; esto lo fija aquí para que se
 * detecte en un segundo en lugar de en una ejecución de Playwright.
 */
function fakeEditor(languageId: string, closed = false): vscode.TextEditor {
    return {
        document: { languageId, isClosed: closed },
        viewColumn: vscode.ViewColumn.One,
    } as unknown as vscode.TextEditor;
}

suite("Fork: de qué editor se acuerda el insertador", () => {
    let sandbox: sinon.SinonSandbox;
    /** Manejador que `SnippetInserter` registra, para poder dispararlo a mano. */
    let fireEditorChange: (editor: vscode.TextEditor | undefined) => void;
    let active: vscode.TextEditor | undefined;

    setup(() => {
        sandbox = sinon.createSandbox();
        active = undefined;
        // `activeTextEditor` es una propiedad de solo lectura: se sustituye con un getter para poder
        // simular que el editor activo cambia.
        sandbox.stub(vscode.window, "activeTextEditor").get(() => active);
        sandbox
            .stub(vscode.window, "onDidChangeActiveTextEditor")
            .callsFake((listener: (editor: vscode.TextEditor | undefined) => void) => {
                fireEditorChange = listener;
                return { dispose: () => undefined };
            });
    });

    teardown(() => sandbox.restore());

    /** Cambia el editor activo y avisa, como haría VS Code. */
    function activate(editor: vscode.TextEditor | undefined): void {
        active = editor;
        fireEditorChange(editor);
    }

    test("sin ningún editor, no hay destino", () => {
        const inserter = new SnippetInserter();
        expect(inserter.hasTarget).to.equal(false);
        inserter.dispose();
    });

    test("toma el editor de SQL que ya estaba activo al construirse", () => {
        active = fakeEditor("sql");
        const inserter = new SnippetInserter();
        expect(inserter.hasTarget).to.equal(true);
        inserter.dispose();
    });

    test("un editor que no es de SQL no vale como destino", () => {
        active = fakeEditor("typescript");
        const inserter = new SnippetInserter();
        expect(inserter.hasTarget).to.equal(false);
        inserter.dispose();
    });

    test("**avisa** cuando aparece un editor de SQL", () => {
        // Es el bug que encontró el e2e: esto no se disparaba nunca, y el aviso de «no hay editor»
        // se quedaba puesto con un .sql abierto delante.
        const inserter = new SnippetInserter();
        let notifications = 0;
        inserter.onDidChangeAvailability(() => {
            notifications += 1;
        });

        activate(fakeEditor("sql"));

        expect(notifications, "tenía que avisar una vez").to.equal(1);
        expect(inserter.hasTarget).to.equal(true);
        inserter.dispose();
    });

    test("no avisa dos veces por lo mismo", () => {
        const inserter = new SnippetInserter();
        let notifications = 0;
        inserter.onDidChangeAvailability(() => {
            notifications += 1;
        });

        activate(fakeEditor("sql"));
        activate(fakeEditor("sql"));

        expect(notifications).to.equal(1);
        inserter.dispose();
    });

    test("se acuerda del editor de SQL cuando el foco se va a otro sitio", () => {
        // Es el caso de verdad: pulsar en la barra lateral quita el foco del editor.
        const sql = fakeEditor("sql");
        const inserter = new SnippetInserter();
        activate(sql);
        // El foco se va a un editor que no es de SQL.
        activate(fakeEditor("markdown"));
        expect(inserter.hasTarget, "el recuerdo tiene que seguir valiendo").to.equal(true);
        inserter.dispose();
    });

    test("si el documento recordado se cerró, deja de valer y avisa", () => {
        const inserter = new SnippetInserter();
        activate(fakeEditor("sql"));

        let notifications = 0;
        inserter.onDidChangeAvailability(() => {
            notifications += 1;
        });

        // El editor se cierra: el documento queda con `isClosed`, y escribir en él no haría nada.
        const closed = fakeEditor("sql", true);
        active = undefined;
        // VS Code avisa del cambio de editor activo al cerrarse el último.
        (inserter as unknown as { lastSqlEditor?: vscode.TextEditor }).lastSqlEditor = closed;
        fireEditorChange(undefined);

        expect(inserter.hasTarget).to.equal(false);
        expect(notifications).to.equal(1);
        inserter.dispose();
    });
});

suite("Fork: qué cuenta como editor de SQL", () => {
    test("manda el lenguaje, no la extensión del archivo", () => {
        // Un documento sin título con lenguaje SQL es un destino válido; un .sql abierto como texto
        // plano no lo es.
        expect(isSqlEditor(fakeEditor("sql"))).to.equal(true);
        expect(isSqlEditor(fakeEditor("plaintext"))).to.equal(false);
        expect(isSqlEditor(undefined)).to.equal(false);
    });
});
