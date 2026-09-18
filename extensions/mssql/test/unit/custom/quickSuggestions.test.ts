/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as vscode from "vscode";

/**
 * Las sugerencias se abren solas al escribir, también con Copilot delante (FORK.md §29).
 *
 * ## Qué se fija aquí, y por qué hace falta fijarlo
 *
 * VS Code trae `editor.quickSuggestions.other` en **`offWhenInlineCompletions`**: mientras haya una
 * sugerencia en línea visible —el texto fantasma de Copilot, que en un editor de SQL está casi
 * siempre—, el widget de sugerencias no se abre solo. Ctrl+Espacio es explícito y se salta la regla,
 * así que el síntoma es exactamente «solo me sale con Ctrl+Espacio».
 *
 * El fork lo pone en `on` para `[sql]` desde `contributes.configurationDefaults`. Es un **valor de
 * fábrica**, por debajo de los ajustes del usuario: quien prefiera lo de VS Code solo tiene que
 * escribirlo en su `settings.json`.
 *
 * Estos tests no miran el ajuste, miran **la consecuencia**: que el proveedor se llame al escribir.
 * Se escribe con el comando `type`, que es el mismo camino que el teclado, y se registra un
 * proveedor propio para no depender de que haya un servidor conectado.
 */

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Un proveedor de sugerencias en línea que siempre propone algo, como haría Copilot. */
function inlineCompletionsLike(language: string): vscode.Disposable {
    return vscode.languages.registerInlineCompletionItemProvider(
        { language },
        {
            provideInlineCompletionItems(_document, position) {
                return [
                    new vscode.InlineCompletionItem(
                        "igationNodes n WHERE n.Id = 1",
                        new vscode.Range(position, position),
                    ),
                ];
            },
        },
    );
}

/**
 * Escribe `text` al final de la primera línea y cuenta cuántas veces se pide autocompletado.
 *
 * @param withInline Registra también un proveedor de sugerencias en línea, para reproducir Copilot.
 */
async function countCompletionRequests(
    language: string,
    content: string,
    text: string,
    withInline: boolean,
): Promise<number> {
    const document = await vscode.workspace.openTextDocument({ language, content });
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    const end = document.lineAt(0).text.length;
    editor.selection = new vscode.Selection(0, end, 0, end);
    await settle(300);

    let calls = 0;
    const inline = withInline ? inlineCompletionsLike(language) : undefined;
    const completions = vscode.languages.registerCompletionItemProvider(
        { language },
        {
            provideCompletionItems() {
                calls += 1;
                return [
                    new vscode.CompletionItem("DSHB_Navigation", vscode.CompletionItemKind.Class),
                ];
            },
        },
    );
    try {
        for (const character of text) {
            await vscode.commands.executeCommand("type", { text: character });
            await settle(250);
        }
        await settle(800);
        return calls;
    } finally {
        completions.dispose();
        inline?.dispose();
        await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }
}

suite("Fork: las sugerencias se abren solas al escribir", () => {
    test("escribir detrás de FROM las pide, sin pulsar nada", async () => {
        const calls = await countCompletionRequests("sql", "SELECT * FROM ", "nav", false);

        expect(calls, "no se pidió autocompletado ni una vez").to.be.greaterThan(0);
    });

    test("y las sigue pidiendo con sugerencias en línea delante", async () => {
        // Esta es la que importa: sin el valor de fábrica del fork, aquí salen **cero** llamadas, y
        // ese cero es el fallo que reportó el usuario.
        const calls = await countCompletionRequests("sql", "SELECT * FROM ", "nav", true);

        expect(calls, "Copilot delante y las sugerencias no se abrieron").to.be.greaterThan(0);
    });

    test("el valor de fábrica llega al editor", async () => {
        const forSql = vscode.workspace.getConfiguration("editor", {
            languageId: "sql",
            uri: undefined,
        });

        expect(forSql.get<{ other?: string }>("quickSuggestions")?.other).to.equal("on");
    });

    test("en el hueco vacío no se abren solas, y es correcto", async () => {
        // Sin palabra que completar, VS Code no dispara: es su diseño, no un fallo. El STS tampoco
        // declara el espacio como carácter de disparo (sus caracteres son . : \\ [ y "). Ahí el
        // gesto es Ctrl+Espacio, y se deja documentado en lugar de forzarlo.
        const calls = await countCompletionRequests("sql", "SELECT * FROM", " ", false);

        expect(calls).to.equal(0);
    });
});
