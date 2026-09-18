/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { Snippet } from "../sharedInterfaces/snippets";
import { Strings } from "../strings";

/**
 * Los snippets propios y compartidos, en la autocompletación del editor (M7).
 *
 * ## Por qué esto no duplica lo que ya hay
 *
 * El upstream ofrece snippets en el editor por **dos** caminos, y los dos son estáticos:
 * `contributes.snippets` con `snippets/mssql.json` (18 entradas, fijas en el `.vsix`) y
 * `TSQL_SNIPPETS` de `src/sqlLanguage/data/snippets.ts`, compilado dentro del motor de lenguaje
 * nativo. Ninguno de los dos puede crecer con lo que escriba el usuario.
 *
 * Ese es exactamente el hueco: una biblioteca propia que solo se pudiera usar desde la barra
 * lateral serviría para consultar, no para escribir SQL. Un proveedor de autocompletación es
 * **aditivo** —VS Code combina todos los registrados, no los sustituye—, así que los dos caminos
 * del upstream siguen funcionando igual y este añade los del usuario.
 *
 * No entra un segundo motor de lenguaje ni se toca el del upstream, que es lo que prohíbe el §16
 * del brief. Son sugerencias, nada más.
 *
 * Los de la extensión se excluyen a propósito: ya los ofrece VS Code por `contributes.snippets`, y
 * volver a ofrecerlos daría **dos entradas idénticas** por snippet en la lista.
 */
export class SnippetCompletionProvider implements vscode.CompletionItemProvider {
    /**
     * @param getSnippets De dónde salen. Se pasa una función y no una lista porque la biblioteca
     *   cambia cuando el usuario guarda, y el proveedor tiene que ver lo último sin volver a
     *   registrarse.
     */
    constructor(private readonly getSnippets: () => readonly Snippet[]) {}

    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.CompletionItem[] {
        // Dentro de una cadena o un comentario, una sugerencia de snippet es ruido. Se mira el
        // texto de la línea hasta el cursor, que es barato y no necesita analizar el documento:
        // el §16 del brief prohíbe escribir un analizador de SQL, y para esto no hace falta.
        const upToCursor = document.lineAt(position.line).text.slice(0, position.character);
        if (isInsideLineComment(upToCursor) || hasUnclosedQuote(upToCursor)) {
            return [];
        }

        return this.getSnippets().map((snippet) => {
            const item = new vscode.CompletionItem(
                snippet.prefix,
                vscode.CompletionItemKind.Snippet,
            );
            item.insertText = new vscode.SnippetString(snippet.body);
            // `detail` sale junto a la entrada; `documentation` en el panel de al lado. Se marca de
            // dónde viene para que no parezca uno de los de la extensión.
            item.detail = Strings.snippets.completionDetail(snippet.name, snippet.library);
            item.documentation = new vscode.MarkdownString(
                `${snippet.description ? `${snippet.description}\n\n` : ""}\`\`\`sql\n${snippet.body}\n\`\`\``,
            );
            // El nombre también filtra: quien escribe «ventana» encuentra el de funciones de
            // ventana aunque su prefijo sea «over».
            item.filterText = `${snippet.prefix} ${snippet.name}`;
            // Los propios se ordenan antes que el resto de la lista del editor: son los que esta
            // persona ha escrito, así que son los que más probablemente quiere.
            item.sortText =
                snippet.origin === "own" ? `0_${snippet.prefix}` : `1_${snippet.prefix}`;
            return item;
        });
    }
}

/** `true` si el cursor está detrás de un `--` en la misma línea. */
export function isInsideLineComment(upToCursor: string): boolean {
    return upToCursor.includes("--");
}

/**
 * `true` si hay un número impar de comillas simples antes del cursor, es decir, si el cursor está
 * dentro de un literal.
 *
 * Cuenta las comillas dobladas (`''`) como una escapada y no como dos delimitadores, que es como
 * las trata T-SQL. Solo mira la línea: un literal partido en varias líneas es raro y el coste de
 * equivocarse aquí es una sugerencia de más, no un error.
 */
export function hasUnclosedQuote(upToCursor: string): boolean {
    let quotes = 0;
    for (let index = 0; index < upToCursor.length; index += 1) {
        if (upToCursor[index] !== "'") {
            continue;
        }
        if (upToCursor[index + 1] === "'") {
            index += 1;
            continue;
        }
        quotes += 1;
    }
    return quotes % 2 === 1;
}
