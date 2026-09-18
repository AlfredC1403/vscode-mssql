/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as vscode from "vscode";

import {
    CompletionResult,
    keepCompletionRange,
    mergeCompletions,
    provideFlexibleCompletions,
} from "../../../src/custom/intellisense/completionMiddleware";
import {
    identifierAfterCursor,
    identifierBeforeCursor,
} from "../../../src/custom/intellisense/typedWord";

/**
 * Sugerencias sin distinguir mayúsculas y por cualquier parte del nombre (FORK.md §28).
 *
 * Lo que se fija aquí es el mecanismo, no el servidor: que se pregunte **también** en el inicio de
 * la palabra, que lo que solo traiga esa segunda respuesta llegue **anclado a lo escrito** —si no,
 * aceptar la sugerencia dejaría `dshbDSHB_Navigation`— y que un fallo de esa segunda petición no
 * pueda empeorar lo que ya funciona hoy.
 */

/** Una tabla del ejemplo que motivó todo esto. */
const TABLE = "DSHB_Navigation";

/** Un `TextDocument` de mentira: el middleware solo mira la línea del cursor y el URI. */
function documentWith(line: string): vscode.TextDocument {
    return {
        uri: vscode.Uri.parse("untitled:prueba.sql"),
        lineAt: () => ({ text: line }),
    } as unknown as vscode.TextDocument;
}

function item(label: string, kind = vscode.CompletionItemKind.Class): vscode.CompletionItem {
    return new vscode.CompletionItem(label, kind);
}

/** El contexto que pasa el editor. No lo leemos, pero `next` lo recibe tal cual. */
const invoked: vscode.CompletionContext = {
    triggerKind: vscode.CompletionTriggerKind.Invoke,
    triggerCharacter: undefined,
};

const notCancelled = new vscode.CancellationTokenSource().token;

suite("Fork: el identificador que se está escribiendo", () => {
    test("toma lo pegado al cursor, no la línea entera", () => {
        expect(identifierBeforeCursor("SELECT * FROM dshb")).to.equal("dshb");
        expect(identifierBeforeCursor("SELECT * FROM dbo.DSHB_Nav")).to.equal("DSHB_Nav");
    });

    test("un signo o un espacio delante cortan", () => {
        expect(identifierBeforeCursor("SELECT * FROM ")).to.equal("");
        expect(identifierBeforeCursor("SELECT * FROM dbo.")).to.equal("");
        expect(identifierBeforeCursor("WHERE x = @")).to.equal("@");
    });

    test("acepta acentos y eñes, que SQL Server admite en un nombre", () => {
        expect(identifierBeforeCursor("SELECT * FROM año_pedidos")).to.equal("año_pedidos");
    });

    test("el corchete de un nombre delimitado se queda fuera", () => {
        expect(identifierBeforeCursor("SELECT * FROM [dshb")).to.equal("dshb");
    });

    test("a la derecha del cursor llega hasta el final del nombre", () => {
        // `DSHB_Nav|igation`: aceptar una sugerencia tiene que sustituir el nombre entero.
        expect(identifierAfterCursor("igation WHERE 1 = 1")).to.equal("igation");
        expect(identifierAfterCursor(" WHERE 1 = 1")).to.equal("");
        expect(identifierAfterCursor("")).to.equal("");
    });
});

suite("Fork: fusión de las dos respuestas de autocompletado", () => {
    const insertRange = new vscode.Range(0, 14, 0, 18);
    const replaceRange = new vscode.Range(0, 14, 0, 18);

    const merge = (filtered: CompletionResult, unfiltered: CompletionResult) =>
        mergeCompletions(filtered, unfiltered, insertRange, replaceRange);

    test("lo que el STS escondió por las mayúsculas entra en la lista", () => {
        const merged = merge([item("dbo.dshb_log")], [item("dbo.dshb_log"), item(TABLE)]);

        expect(labelsOf(merged)).to.deep.equal(["dbo.dshb_log", TABLE]);
    });

    test("y entra anclado a lo escrito, no al inicio de la palabra", () => {
        // Sin esto, el rango vacío con el que responde el STS pegaría el nombre delante de lo
        // escrito. Es el único cambio que se le hace a una sugerencia ajena.
        const merged = merge([], [item(TABLE)]);
        const added = itemsOf(merged)[0];

        expect(added.range).to.deep.equal({
            inserting: insertRange,
            replacing: replaceRange,
        });
    });

    test("un `textEdit` en desuso no puede ganarle al rango", () => {
        const withEdit = item(TABLE);
        withEdit.textEdit = new vscode.TextEdit(new vscode.Range(0, 14, 0, 14), TABLE);

        const added = itemsOf(merge([], [withEdit]))[0];

        expect(added).to.not.have.property("textEdit");
        // Su texto no se pierde: pasa a ser lo que se inserta.
        expect(added.insertText).to.equal(TABLE);
    });

    test("no se ofrece dos veces lo que estaba en las dos respuestas", () => {
        const merged = merge([item(TABLE)], [item(TABLE)]);

        expect(labelsOf(merged)).to.deep.equal([TABLE]);
    });

    test("el mismo nombre con otro tipo sí es otra sugerencia", () => {
        // Una tabla y una columna pueden llamarse igual, y son cosas distintas.
        const merged = merge(
            [item("nombre", vscode.CompletionItemKind.Field)],
            [item("nombre", vscode.CompletionItemKind.Class)],
        );

        expect(itemsOf(merged)).to.have.lengthOf(2);
    });

    test("las del cursor se quedan delante y sin tocar", () => {
        // La respuesta del editor manda: su contexto es el exacto y sus rangos ya venían bien.
        const original = item("dbo.dshb_log");
        const merged = merge([original], [item(TABLE)]);

        expect(itemsOf(merged)[0]).to.equal(original);
        expect(original.range).to.equal(undefined);
    });

    test("sin nada nuevo que añadir, se devuelve la respuesta original tal cual", () => {
        const filtered = [item(TABLE)];

        expect(merge(filtered, [item(TABLE)])).to.equal(filtered);
        expect(merge(filtered, [])).to.equal(filtered);
        expect(merge(filtered, undefined)).to.equal(filtered);
    });

    test("si la primera no devolvió nada, la segunda sigue valiendo", () => {
        const merged = merge(undefined, [item(TABLE)]);

        expect(labelsOf(merged)).to.deep.equal([TABLE]);
    });

    test("la lista solo se marca completa si lo estaban las dos", () => {
        const incomplete = new vscode.CompletionList([item("dbo.dshb_log")], true);
        const complete = new vscode.CompletionList([item(TABLE)], false);

        expect(asList(merge(incomplete, complete)).isIncomplete).to.equal(true);
        expect(
            asList(merge(complete, new vscode.CompletionList([item("otra")], true))).isIncomplete,
        ).to.equal(true);
        expect(
            asList(merge(complete, new vscode.CompletionList([item("otra")], false))).isIncomplete,
        ).to.equal(false);
    });
});

suite("Fork: la segunda petición, en el inicio de la palabra", () => {
    test("se pregunta dos veces, en el cursor y en el inicio de lo escrito", async () => {
        const asked: vscode.Position[] = [];
        const document = documentWith("SELECT * FROM dshb");
        const cursor = new vscode.Position(0, 18);

        await provideFlexibleCompletions(
            document,
            cursor,
            invoked,
            notCancelled,
            (_d, position) => {
                asked.push(position);
                return [];
            },
        );

        expect(asked).to.have.lengthOf(2);
        expect(asked[0].isEqual(cursor)).to.equal(true);
        expect(asked[1].isEqual(new vscode.Position(0, 14))).to.equal(true);
    });

    test("sin nada escrito no se pregunta dos veces", async () => {
        // Es el caso de Ctrl+Espacio sobre un hueco y el del disparador por `.`: el STS no tiene
        // por qué filtrar nada, así que la segunda petición sería la misma.
        const asked: vscode.Position[] = [];
        const document = documentWith("SELECT * FROM ");

        await provideFlexibleCompletions(
            document,
            new vscode.Position(0, 14),
            invoked,
            notCancelled,
            (_d, position) => {
                asked.push(position);
                return [];
            },
        );

        expect(asked).to.have.lengthOf(1);
    });

    test("la tabla que solo aparece sin filtrar llega a la lista", async () => {
        const document = documentWith("SELECT * FROM dshb");

        const result = await provideFlexibleCompletions(
            document,
            new vscode.Position(0, 18),
            invoked,
            notCancelled,
            (_d, position) => (position.character === 18 ? [] : [item(TABLE)]),
        );

        expect(labelsOf(result)).to.deep.equal([TABLE]);
        expect(itemsOf(result)[0].range).to.deep.equal({
            inserting: new vscode.Range(0, 14, 0, 18),
            replacing: new vscode.Range(0, 14, 0, 18),
        });
    });

    test("con el cursor en medio del nombre, el reemplazo llega hasta el final", async () => {
        // `DSHB_Nav|igation`.
        const document = documentWith("SELECT * FROM DSHB_Navigation");

        const result = await provideFlexibleCompletions(
            document,
            new vscode.Position(0, 22),
            invoked,
            notCancelled,
            (_d, position) => (position.character === 22 ? [] : [item(TABLE)]),
        );

        expect(itemsOf(result)[0].range).to.deep.equal({
            inserting: new vscode.Range(0, 14, 0, 22),
            replacing: new vscode.Range(0, 14, 0, 29),
        });
    });

    test("si la segunda falla, queda lo que hay hoy", async () => {
        const document = documentWith("SELECT * FROM dshb");
        const fromServer = [item("dbo.dshb_log")];

        const result = await provideFlexibleCompletions(
            document,
            new vscode.Position(0, 18),
            invoked,
            notCancelled,
            (_d, position) => {
                if (position.character === 14) {
                    return Promise.reject(new Error("el STS se cayó"));
                }
                return fromServer;
            },
        );

        expect(result).to.equal(fromServer);
    });

    test("un fallo de la petición del editor sigue siendo un fallo", async () => {
        // El fork no puede tapar un error del STS: el cliente de lenguaje tiene que verlo igual.
        const document = documentWith("SELECT * FROM dshb");

        let thrown: unknown;
        try {
            await provideFlexibleCompletions(
                document,
                new vscode.Position(0, 18),
                invoked,
                notCancelled,
                (_d, position) =>
                    position.character === 18 ? Promise.reject(new Error("caído")) : [],
            );
        } catch (error) {
            thrown = error;
        }

        expect((thrown as Error | undefined)?.message).to.equal("caído");
    });

    test("si se cancela, no se fusiona nada", async () => {
        const document = documentWith("SELECT * FROM dshb");
        const source = new vscode.CancellationTokenSource();
        const fromServer = [item("dbo.dshb_log")];
        source.cancel();

        const result = await provideFlexibleCompletions(
            document,
            new vscode.Position(0, 18),
            invoked,
            source.token,
            (_d, position) => (position.character === 18 ? fromServer : [item(TABLE)]),
        );

        expect(result).to.equal(fromServer);
    });
});

suite("Fork: resolver una sugerencia no mueve su rango", () => {
    test("el rango con el que se mostró gana al que devuelve el servidor", async () => {
        const shown = item(TABLE);
        shown.range = new vscode.Range(0, 14, 0, 18);
        const resolvedByServer = item(TABLE);
        resolvedByServer.range = new vscode.Range(0, 14, 0, 14);
        resolvedByServer.documentation = "Tabla de navegación";

        const resolved = await keepCompletionRange(shown, notCancelled, () => resolvedByServer);

        expect(resolved.range).to.deep.equal(new vscode.Range(0, 14, 0, 18));
        expect(resolved.documentation).to.equal("Tabla de navegación");
    });

    test("si el servidor no resuelve nada, se queda la sugerencia mostrada", async () => {
        const shown = item(TABLE);

        expect(await keepCompletionRange(shown, notCancelled, () => undefined)).to.equal(shown);
    });
});

function itemsOf(result: CompletionResult): readonly vscode.CompletionItem[] {
    if (result === null || result === undefined) {
        return [];
    }
    return Array.isArray(result) ? result : result.items;
}

function labelsOf(result: CompletionResult): string[] {
    return itemsOf(result).map((entry) =>
        typeof entry.label === "string" ? entry.label : entry.label.label,
    );
}

function asList(result: CompletionResult): vscode.CompletionList {
    expect(result).to.be.instanceOf(vscode.CompletionList);
    return result as vscode.CompletionList;
}
