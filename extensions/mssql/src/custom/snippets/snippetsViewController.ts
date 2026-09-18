/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { WebviewViewController } from "../../controllers/webviewViewController";
import { CustomWebviewKind } from "../sharedInterfaces/customWebview";
import { Snippet, SnippetsReducers, SnippetsState } from "../sharedInterfaces/snippets";
import { SHARED_LIBRARIES_SETTING, SnippetStore } from "./store";
import { SnippetInserter } from "./insert";
import { isEditable, sortForDisplay, validateOwnSnippet } from "./library";
import { Strings } from "../strings";

/**
 * Vista de snippets en la barra lateral (M7).
 *
 * Es un `WebviewViewProvider`, **no un `TreeDataProvider`**, que es lo que pide el punto 12 del
 * brief. No hizo falta infraestructura: `WebviewViewController` del upstream ya implementa la
 * interfaz (FORK.md §3.1).
 *
 * Como el resto del fork, el webview **manda datos y nunca T-SQL ejecutable**: pide «inserta el
 * snippet con este id» y el host busca el cuerpo en su propia copia. Aquí la razón no es de
 * seguridad de escritura —un snippet no se ejecuta, se escribe en el editor— sino la misma de
 * siempre: que lo que pasa sea lo que se mostró.
 */
export class SnippetsViewController extends WebviewViewController<SnippetsState, SnippetsReducers> {
    public static readonly viewId = "sqlworksSnippets";

    private readonly store: SnippetStore;
    private readonly inserter: SnippetInserter;
    /** La copia del host. El webview solo tiene ids. */
    private snippets: Snippet[] = [];
    /** Si ya se leyó el disco alguna vez. La primera lectura es diferida. */
    private loadedOnce = false;

    constructor(context: vscode.ExtensionContext) {
        super(context, "sqlworks", SnippetsViewController.viewId, {
            view: CustomWebviewKind.Snippets,
            snippets: [],
            loading: true,
            errorMessage: "",
            ownLibraryPath: "",
            sharedWarnings: [],
            hasSqlEditor: false,
        });

        this.store = new SnippetStore(context);
        this.inserter = new SnippetInserter();
        context.subscriptions.push(this.inserter);

        // Si se abre o se cierra un editor de SQL, el botón de insertar cambia de estado.
        context.subscriptions.push(
            this.inserter.onDidChangeAvailability(() => {
                this.state = { ...this.state, hasSqlEditor: this.inserter.hasTarget };
            }),
        );

        // Cambiar las rutas compartidas en los ajustes recarga sin tener que pulsar nada.
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (event.affectsConfiguration(SHARED_LIBRARIES_SETTING)) {
                    void this.reload();
                }
            }),
        );

        // Y si se edita el archivo de la biblioteca **desde un editor** —que es justo lo que ofrece
        // el botón de «abrir el archivo»—, la vista se entera al guardar. Sin esto, editar en bloque
        // dejaría la lista desfasada hasta que alguien pulsara recargar.
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                if (document.uri.fsPath === this.store.ownLibraryUri.fsPath) {
                    void this.reload();
                }
            }),
        );

        this.registerReducers();
        // **No se lee el disco aquí.** La vista puede no abrirse nunca en una sesión, y la
        // extensión no debe pagar E/S en la activación por algo que quizá nadie mire. La primera
        // lectura ocurre en `resolveWebviewView`, cuando la vista se abre de verdad.
    }

    /**
     * VS Code llama a esto la primera vez que la vista se hace visible, y es donde se lee el disco.
     *
     * Aparte del arranque, esto evita un fallo real: `stubExtensionContext` de los tests del
     * upstream no define `globalStorageUri`, así que construir el almacén en la activación rompía
     * `extension.test.ts` con una promesa rechazada. Cargar cuando la vista se abre significa que
     * nada toca el disco a menos que haya una vista de verdad.
     */
    public override resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken,
    ): void {
        super.resolveWebviewView(webviewView, context, token);
        if (!this.loadedOnce) {
            this.loadedOnce = true;
            void this.reload();
        }
    }

    private registerReducers(): void {
        this.registerReducer("reload", (state) => {
            void this.reload();
            return { ...state, loading: true };
        });

        this.registerReducer("insert", (state, payload) => {
            void this.insert(payload.id);
            return state;
        });

        this.registerReducer("copy", (state, payload) => {
            void this.copy(payload.id);
            return state;
        });

        this.registerReducer("save", (state, payload) => {
            void this.save(payload);
            return state;
        });

        this.registerReducer("remove", (state, payload) => {
            void this.remove(payload.id);
            return state;
        });

        this.registerReducer("duplicateToOwn", (state, payload) => {
            void this.duplicateToOwn(payload.id);
            return state;
        });

        this.registerReducer("openLibraryFile", (state) => {
            void this.openLibraryFile();
            return state;
        });
    }

    /**
     * Vuelve a leer las tres fuentes y publica el resultado.
     *
     * **No lanza**, que es la invariante del módulo: se llama con `void` desde los reducers y desde
     * suscripciones a eventos, así que un rechazo aquí sería una promesa sin manejar en el host de
     * extensión y no un error que alguien pueda ver.
     */
    private async reload(): Promise<void> {
        let loaded;
        try {
            loaded = await this.store.loadAll();
        } catch (error) {
            if (!this.isDisposed) {
                this.state = {
                    ...this.state,
                    loading: false,
                    errorMessage:
                        error instanceof Error ? error.message : Strings.snippets.loadFailed,
                };
            }
            return;
        }
        if (this.isDisposed) {
            return;
        }
        this.snippets = loaded.snippets;
        this.state = {
            ...this.state,
            snippets: loaded.snippets,
            loading: false,
            errorMessage: "",
            ownLibraryPath: this.store.ownLibraryUri.fsPath,
            sharedWarnings: loaded.warnings,
            hasSqlEditor: this.inserter.hasTarget,
        };
    }

    private find(id: string): Snippet | undefined {
        return this.snippets.find((snippet) => snippet.id === id);
    }

    private async insert(id: string): Promise<void> {
        const snippet = this.find(id);
        if (!snippet) {
            void vscode.window.showWarningMessage(Strings.snippets.notFound);
            return;
        }
        const problem = await this.inserter.insert(snippet.body);
        if (problem) {
            void vscode.window.showWarningMessage(problem);
        }
    }

    private async copy(id: string): Promise<void> {
        const snippet = this.find(id);
        if (!snippet) {
            void vscode.window.showWarningMessage(Strings.snippets.notFound);
            return;
        }
        await vscode.env.clipboard.writeText(snippet.body);
        void vscode.window.setStatusBarMessage(Strings.snippets.copied(snippet.name), 3000);
    }

    /** Crea o actualiza un snippet propio. */
    private async save(payload: SnippetsReducers["save"]): Promise<void> {
        const problem = validateOwnSnippet(payload);
        if (problem) {
            void vscode.window.showWarningMessage(problem);
            return;
        }

        const existing = payload.id ? this.find(payload.id) : undefined;
        if (existing && !isEditable(existing)) {
            // No debería llegar: la vista no ofrece editar los de solo lectura. Si llega, es un
            // fallo nuestro, y sobrescribir la biblioteca de un equipo no es la forma de tratarlo.
            void vscode.window.showWarningMessage(Strings.snippets.readOnly);
            return;
        }

        const saved: Snippet = {
            id:
                existing?.id ??
                `own:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
            name: payload.name.trim(),
            prefix: payload.prefix.trim(),
            body: payload.body,
            description: payload.description.trim(),
            category: payload.category.trim(),
            origin: "own",
            library: "",
        };

        const next = existing
            ? this.snippets.map((snippet) => (snippet.id === existing.id ? saved : snippet))
            : [...this.snippets, saved];

        await this.persist(next);
    }

    private async remove(id: string): Promise<void> {
        const snippet = this.find(id);
        if (!snippet) {
            return;
        }
        if (!isEditable(snippet)) {
            void vscode.window.showWarningMessage(Strings.snippets.readOnly);
            return;
        }

        // Confirmación modal: borrar un snippet no tiene vuelta atrás y el archivo se reescribe.
        const confirm = await vscode.window.showWarningMessage(
            Strings.snippets.confirmDelete(snippet.name),
            { modal: true },
            Strings.snippets.deleteAction,
        );
        if (confirm !== Strings.snippets.deleteAction) {
            return;
        }

        await this.persist(this.snippets.filter((entry) => entry.id !== id));
    }

    /** Copia un snippet de solo lectura a la biblioteca propia, para poder modificarlo. */
    private async duplicateToOwn(id: string): Promise<void> {
        const snippet = this.find(id);
        if (!snippet) {
            return;
        }
        const copy: Snippet = {
            ...snippet,
            id: `own:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
            name: Strings.snippets.copyName(snippet.name),
            origin: "own",
            library: "",
        };
        await this.persist([...this.snippets, copy]);
    }

    /** Escribe la biblioteca propia y recarga, para que lo que se ve venga del disco. */
    private async persist(next: readonly Snippet[]): Promise<void> {
        const problem = await this.store.saveOwn(next);
        if (problem) {
            void vscode.window.showErrorMessage(Strings.snippets.saveFailedWith(problem));
            return;
        }
        await this.reload();
    }

    private async openLibraryFile(): Promise<void> {
        // Si no existe todavía, se crea vacía: abrir un editor sobre un archivo que falta daría un
        // error y lo que la persona quiere es empezar a escribir.
        const problem = await this.store.saveOwn(this.snippets);
        if (problem) {
            void vscode.window.showErrorMessage(Strings.snippets.saveFailedWith(problem));
            return;
        }
        const document = await vscode.workspace.openTextDocument(this.store.ownLibraryUri);
        await vscode.window.showTextDocument(document);
    }

    /** Los propios y los compartidos, para la autocompletación. Ordenados como se muestran. */
    public get completionSnippets(): Snippet[] {
        return sortForDisplay(
            this.snippets.filter((snippet) => snippet.origin !== "builtin" && snippet.prefix),
        );
    }
}
