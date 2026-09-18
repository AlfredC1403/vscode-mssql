/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { identifierAfterCursor, identifierBeforeCursor } from "./typedWord";

/**
 * IntelliSense que no distingue mayúsculas y encuentra el texto en cualquier parte del nombre.
 *
 * ## El problema, tal cual se ve
 *
 * Con una tabla `DSHB_Navigation`, escribir `DSHB` la propone y escribir `dshb` no propone nada.
 * `navigation` tampoco, aunque esté dentro del nombre. Pasa igual con columnas, procedimientos y
 * funciones.
 *
 * ## Dónde está de verdad
 *
 * **No es el filtro de VS Code.** El editor filtra la lista que recibe con su propio comparador
 * difuso, que es insensible a mayúsculas y acepta el encaje por fronteras de palabra: si
 * `DSHB_Navigation` llegara a la lista, escribir `dshb` o `navigation` la encontraría. El motivo de
 * que no aparezca es que **nunca llega**: el SQL Tools Service ya ha filtrado por el texto escrito
 * antes de responder, y ese filtro sí distingue mayúsculas.
 *
 * El STS es un binario que se descarga (§5), no código de este repositorio, así que su filtro no se
 * puede tocar. Lo que sí se puede es **no dejar que filtre**.
 *
 * ## La idea
 *
 * Una petición de autocompletado en el **inicio** de la palabra —donde todavía no hay texto
 * escrito— no tiene nada por lo que filtrar: el STS devuelve entonces todo lo que cabe en ese
 * punto, que es exactamente la lista que sale hoy al pulsar Ctrl+Espacio sobre un hueco. Así que
 * por cada petición se hacen dos, **en paralelo**:
 *
 * 1. La que pedía el editor, en el cursor. Es la que manda: contexto exacto y rangos ya puestos.
 * 2. Otra en el inicio de la palabra, sin filtrar.
 *
 * Y se fusionan: lo de (1) tal cual, más lo de (2) que no estuviera ya. El filtrado final lo hace
 * VS Code, que es el que no distingue mayúsculas. El resultado es aditivo: en el peor caso —si (2)
 * fallara, se cancelara o no añadiera nada— queda exactamente lo que hay hoy.
 *
 * ## Por qué no se filtra aquí lo que devuelve (2)
 *
 * Sería lo primero que uno haría, y sale peor. Si el STS marca la lista como completa
 * (`isIncomplete: false`), VS Code se la **queda en caché** y filtra en local el resto de teclas: la
 * segunda petición se hace una vez por sesión de sugerencias, no una por tecla. Recortar aquí por lo
 * escrito rompería esa caché —al borrar una letra faltarían candidatos que ya no se volverían a
 * pedir—, y obligaría a marcar la lista como incompleta, o sea a repreguntar en cada tecla. Entre
 * transferir el catálogo una vez o hacer que el analizador del STS lo recorra en cada pulsación,
 * sale mucho más barato lo primero, y además la lista responde al instante mientras se escribe.
 *
 * ## Qué hay que arreglar de lo que llega de (2)
 *
 * El rango. El STS ancla cada sugerencia donde se le preguntó, así que las de (2) vienen ancladas al
 * inicio de la palabra con un rango vacío: aceptarlas dejaría `dshbDSHB_Navigation`. Aquí se les
 * pone el rango de la palabra escrita, con reemplazo hasta el final de ella. Ver `anchorToTypedWord`.
 */

/** Ajuste que lo enciende y lo apaga. Declarado en `contributes.configuration` del `package.json`. */
export const FLEXIBLE_MATCHING_SECTION = "sqlworks.intelliSense";
export const FLEXIBLE_MATCHING_KEY = "flexibleMatching";

/** Lo que el middleware del cliente de lenguaje pasa como `next`. */
export type ProvideCompletionItems = (
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.CompletionContext,
    token: vscode.CancellationToken,
) => vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList>;

/** Lo que devuelve un proveedor de autocompletado, en cualquiera de sus formas. */
export type CompletionResult = vscode.CompletionItem[] | vscode.CompletionList | null | undefined;

/**
 * Envuelve la petición de autocompletado del cliente de lenguaje. Ver la cabecera del archivo.
 *
 * @param next La petición original, la que haría el cliente sin el fork.
 */
export async function provideFlexibleCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.CompletionContext,
    token: vscode.CancellationToken,
    next: ProvideCompletionItems,
): Promise<CompletionResult> {
    const line = document.lineAt(position.line).text;
    const typed = identifierBeforeCursor(line.slice(0, position.character));
    // Sin texto escrito no hay nada que el STS pueda haber filtrado, y la segunda petición sería la
    // misma que la primera. Es además el caso de los disparadores por `.`, que ya funcionan bien.
    if (typed.length === 0 || !isFlexibleMatchingEnabled(document.uri)) {
        return await next(document, position, context, token);
    }

    const wordStart = position.translate(0, -typed.length);
    const wordEnd = position.translate(
        0,
        identifierAfterCursor(line.slice(position.character)).length,
    );

    const atCursor = Promise.resolve(next(document, position, context, token));
    // Si la segunda falla o se cancela no puede llevarse por delante a la primera: la petición del
    // editor tiene que responder igual que hoy. Por eso se traga el error aquí y no en el `await`.
    const atWordStart = Promise.resolve(next(document, wordStart, context, token)).catch(
        () => undefined,
    );
    const [filtered, unfiltered] = await Promise.all([atCursor, atWordStart]);

    if (token.isCancellationRequested) {
        return filtered;
    }
    return mergeCompletions(
        filtered,
        unfiltered,
        new vscode.Range(wordStart, position),
        new vscode.Range(wordStart, wordEnd),
    );
}

/**
 * Añade a `filtered` lo que solo trae `unfiltered`, anclado a la palabra escrita.
 *
 * Exportada para los tests: es donde vive la decisión, y no necesita ni editor ni servidor.
 *
 * @param filtered Lo que respondió el STS en el cursor. Manda: se devuelve entero y sin tocar.
 * @param unfiltered Lo que respondió en el inicio de la palabra, sin filtrar.
 * @param insertRange De dónde a dónde escribe una sugerencia nueva: la palabra hasta el cursor.
 * @param replaceRange Lo que sustituye si se acepta en modo reemplazo: la palabra entera.
 */
export function mergeCompletions(
    filtered: CompletionResult,
    unfiltered: CompletionResult,
    insertRange: vscode.Range,
    replaceRange: vscode.Range,
): CompletionResult {
    const extraItems = itemsOf(unfiltered);
    if (extraItems.length === 0) {
        return filtered;
    }
    const baseItems = itemsOf(filtered);
    const seen = new Set(baseItems.map(dedupeKey));
    const merged = [...baseItems];
    for (const item of extraItems) {
        const key = dedupeKey(item);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        merged.push(anchorToTypedWord(item, insertRange, replaceRange));
    }
    if (merged.length === baseItems.length) {
        // El STS no filtraba, o filtraba y no sobraba nada. Se devuelve lo original tal cual para no
        // cambiar ni el tipo de la respuesta.
        return filtered;
    }
    return new vscode.CompletionList(merged, isIncomplete(filtered) || isIncomplete(unfiltered));
}

/**
 * Mueve una sugerencia al rango de la palabra escrita.
 *
 * Sin esto, las de la segunda petición vienen ancladas a un rango vacío en el inicio de la palabra
 * y aceptarlas pegaría el nombre **delante** de lo ya escrito: `dshb` + `DSHB_Navigation`.
 */
function anchorToTypedWord(
    item: vscode.CompletionItem,
    insertRange: vscode.Range,
    replaceRange: vscode.Range,
): vscode.CompletionItem {
    // `textEdit` está en desuso y el cliente de lenguaje no lo rellena —convierte el del protocolo
    // en `range` + `insertText`—, pero si alguna vez lo hiciera mandaría sobre `range` y volvería el
    // texto duplicado. Se traspasa su texto y se quita, para que el rango tenga una sola fuente.
    const legacy = item as vscode.CompletionItem & { textEdit?: { newText: string } };
    if (legacy.textEdit !== undefined) {
        item.insertText = item.insertText ?? legacy.textEdit.newText;
        delete legacy.textEdit;
    }
    item.range = { inserting: insertRange, replacing: replaceRange };
    return item;
}

/**
 * Impide que resolver una sugerencia mueva el rango con el que se mostró.
 *
 * VS Code fusiona lo que devuelve `resolveCompletionItem` sobre la sugerencia ya mostrada con un
 * `Object.assign`, así que **todas** sus propiedades ganan, el rango incluido. El STS devuelve en la
 * resolución la sugerencia entera, no solo la documentación que se le pide: si su copia trae el
 * rango con el que se pidió, desharía lo que hace `anchorToTypedWord` justo antes de insertar.
 */
export async function keepCompletionRange(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken,
    next: (
        item: vscode.CompletionItem,
        token: vscode.CancellationToken,
    ) => vscode.ProviderResult<vscode.CompletionItem>,
): Promise<vscode.CompletionItem> {
    const shownRange = item.range;
    const resolved = await next(item, token);
    if (resolved === null || resolved === undefined) {
        return item;
    }
    if (shownRange !== undefined) {
        resolved.range = shownRange;
    }
    return resolved;
}

/** `true` salvo que alguien lo apague. Ver el ajuste en `package.json`. */
function isFlexibleMatchingEnabled(resource: vscode.Uri): boolean {
    return vscode.workspace
        .getConfiguration(FLEXIBLE_MATCHING_SECTION, resource)
        .get<boolean>(FLEXIBLE_MATCHING_KEY, true);
}

/** Las dos formas de respuesta de un proveedor, en una sola. */
function itemsOf(result: CompletionResult): readonly vscode.CompletionItem[] {
    if (result === null || result === undefined) {
        return [];
    }
    return Array.isArray(result) ? result : result.items;
}

/** Un array suelto es siempre una lista completa; solo `CompletionList` puede decir lo contrario. */
function isIncomplete(result: CompletionResult): boolean {
    return result !== null && result !== undefined && !Array.isArray(result) && result.isIncomplete;
}

/**
 * Identidad de una sugerencia, para no ofrecer la misma dos veces.
 *
 * Etiqueta y tipo bastan: dos sugerencias con el mismo nombre y el mismo tipo en el mismo punto son
 * la misma cosa, la haya devuelto el STS en una petición o en la otra.
 */
function dedupeKey(item: vscode.CompletionItem): string {
    const label = typeof item.label === "string" ? item.label : item.label.label;
    return `${item.kind ?? ""}\u0000${label}`;
}
