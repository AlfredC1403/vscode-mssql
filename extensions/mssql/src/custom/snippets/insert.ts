/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { Strings } from "../strings";

/**
 * Inserción de un snippet en el editor (M7).
 *
 * ## El problema que resuelve, que no es evidente
 *
 * La vista de snippets vive en la barra lateral, así que para pulsar «Insertar» hay que **quitar el
 * foco del editor**. La documentación de VS Code dice que `window.activeTextEditor` es «el editor
 * activo o, cuando ninguno tiene el foco, el que cambió de contenido más recientemente», así que en
 * teoría sigue valiendo. Pero eso es una garantía sobre el editor que *cambió*, no sobre el que la
 * persona estaba mirando, y depende de un comportamiento que no controlamos.
 *
 * Así que no se confía en él: esta clase **se acuerda del último editor de SQL** que estuvo activo y
 * es el que usa. Es una suscripción de diez líneas y elimina la duda entera, en lugar de dejarla
 * dependiendo de una medida que podría cambiar con una versión de VS Code.
 *
 * `activeTextEditor` se sigue consultando **primero**, porque cuando sí es un editor de SQL es la
 * respuesta correcta y más fresca. El recuerdo es la red.
 */
export class SnippetInserter implements vscode.Disposable {
    /** Último editor de SQL que estuvo activo. */
    private lastSqlEditor?: vscode.TextEditor;
    /**
     * Si la última vez que se avisó había destino o no.
     *
     * Hace falta guardarlo: `target` lee `vscode.window.activeTextEditor` **en vivo**, y cuando el
     * evento de cambio de editor llega, ese valor ya refleja el cambio. Comparar contra `target`
     * antes y después dentro del propio manejador da siempre lo mismo, así que el evento no se
     * dispararía nunca. Lo encontró el e2e de M7: el aviso de «no hay editor de SQL» se quedaba
     * puesto con un `.sql` abierto delante.
     */
    private lastAvailability = false;
    private readonly subscription: vscode.Disposable;
    private readonly emitter = new vscode.EventEmitter<void>();

    /** Se dispara cuando cambia si hay o no un editor de SQL donde insertar. */
    public readonly onDidChangeAvailability = this.emitter.event;

    constructor() {
        // Se toma el actual al arrancar: la vista puede abrirse con un .sql ya delante.
        this.remember(vscode.window.activeTextEditor);
        this.lastAvailability = this.hasTarget;
        this.subscription = vscode.window.onDidChangeActiveTextEditor((editor) => {
            this.remember(editor);
            const available = this.hasTarget;
            if (available !== this.lastAvailability) {
                this.lastAvailability = available;
                this.emitter.fire();
            }
        });
    }

    public dispose(): void {
        this.subscription.dispose();
        this.emitter.dispose();
    }

    /** El editor donde se insertaría, o `undefined` si no hay ninguno. */
    public get target(): vscode.TextEditor | undefined {
        const active = vscode.window.activeTextEditor;
        if (isSqlEditor(active)) {
            return active;
        }
        // El recordado puede haberse cerrado. Un documento cerrado queda con `isClosed`, y escribir
        // en él no haría nada visible.
        return this.lastSqlEditor && !this.lastSqlEditor.document.isClosed
            ? this.lastSqlEditor
            : undefined;
    }

    /** `true` si hay dónde insertar. Lo consume la vista para activar o no el botón. */
    public get hasTarget(): boolean {
        return this.target !== undefined;
    }

    /**
     * Inserta el cuerpo como snippet, con sus tabuladores.
     *
     * Devuelve el motivo si no se pudo, o `undefined` si se insertó. **No lanza.**
     */
    public async insert(body: string): Promise<string | undefined> {
        const editor = this.target;
        if (!editor) {
            return Strings.snippets.noEditor;
        }

        try {
            // `insertSnippet` es lo que respeta `$1`, `${2:valor}` y los espejos. Insertar el texto
            // plano perdería justo lo que hace útil a un snippet.
            const inserted = await editor.insertSnippet(new vscode.SnippetString(body));
            if (!inserted) {
                return Strings.snippets.insertRejected;
            }
            // Se lleva el foco al editor: quien inserta un snippet con tabuladores quiere escribir
            // en ellos, y dejarlo en la barra lateral obligaría a un clic más.
            await vscode.window.showTextDocument(editor.document, {
                viewColumn: editor.viewColumn,
                preserveFocus: false,
            });
            return undefined;
        } catch (error) {
            return error instanceof Error ? error.message : Strings.snippets.insertRejected;
        }
    }

    private remember(editor: vscode.TextEditor | undefined): void {
        if (isSqlEditor(editor)) {
            this.lastSqlEditor = editor;
        }
    }
}

/**
 * `true` si el editor es de SQL.
 *
 * Se mira el `languageId`, no la extensión del archivo: un documento sin título al que se le puso
 * lenguaje SQL a mano es un destino perfectamente válido, y un `.sql` abierto como texto plano no
 * lo es.
 */
export function isSqlEditor(editor: vscode.TextEditor | undefined): boolean {
    return editor?.document.languageId === "sql";
}
