/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { Strings } from "../strings";

/**
 * Formatea SQL de muestra con opciones **candidatas**, sin tocar los ajustes de nadie (M8).
 *
 * ## Por qué hace falta un proceso aparte
 *
 * Medido contra el STS real (FORK.md §25.1): las opciones de formato pasadas en la petición
 * `textDocument/formatting` **se ignoran**, y solo se respetan las que llegan por
 * `workspace/didChangeConfiguration`. Y esa configuración es **del proceso**, no del documento.
 *
 * Consecuencia: con el STS que usa el editor no hay forma de formatear «como quedaría» sin cambiar
 * de verdad cómo formatea todo lo demás. Previsualizar escribiendo los ajustes del usuario y
 * restaurándolos después es intrusivo y tiene carreras —el formateo al guardar podría dispararse
 * con las opciones equivocadas—, y si VS Code se cierra a media vista previa los ajustes se quedan
 * cambiados.
 *
 * Así que la vista previa habla con **su propio STS**, efímero:
 *
 * - No toca los ajustes del usuario ni su conexión. De hecho **no se conecta a ningún servidor**:
 *   está medido que el STS formatea sin conexión, porque el formateo es puramente sintáctico.
 * - Usa el binario que ya va en el `.vsix`, así que no entra ninguna dependencia nueva y **no se
 *   toca el descargador ni el arranque del STS del upstream**, que es lo que prohíbe el §16.
 *
 * Coste, medido: **785 ms** hasta que responde y **123 MB** residentes. No es gratis, así que se
 * arranca **en la primera vista previa** y se cierra al cerrar el panel.
 */

/** Cuánto se espera una respuesta antes de darla por perdida. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Entrada pendiente del protocolo. */
interface Pending {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
}

/** Un edit de texto tal como lo devuelve el LSP. */
interface TextEdit {
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    newText: string;
}

export class PreviewFormatter implements vscode.Disposable {
    private server?: ChildProcessWithoutNullStreams;
    private buffer = Buffer.alloc(0);
    private nextId = 1;
    private readonly pending = new Map<number, Pending>();
    private startup?: Promise<void>;
    /** Documentos que ya se abrieron en este proceso, para no repetir `didOpen`. */
    private readonly opened = new Set<string>();
    private disposed = false;

    constructor(private readonly extensionUri: vscode.Uri) {}

    public dispose(): void {
        this.disposed = true;
        for (const entry of this.pending.values()) {
            clearTimeout(entry.timer);
            entry.reject(new Error("cerrado"));
        }
        this.pending.clear();
        this.server?.kill();
        this.server = undefined;
        this.startup = undefined;
        this.opened.clear();
    }

    /**
     * Formatea `sql` con esas opciones. Devuelve el texto formateado, o el motivo del fallo.
     *
     * **No lanza**: se llama desde un reducer, y un rechazo ahí acabaría en el registro.
     */
    public async format(
        sql: string,
        values: Record<string, boolean | string | number>,
    ): Promise<{ text?: string; errorMessage?: string }> {
        try {
            await this.ensureStarted();
        } catch (error) {
            return {
                errorMessage:
                    error instanceof Error ? error.message : Strings.format.previewUnavailable,
            };
        }

        try {
            // Cada combinación de opciones se manda como configuración antes de formatear. El STS
            // la guarda por proceso, así que basta con hacerlo justo antes de cada petición.
            this.notify("workspace/didChangeConfiguration", {
                settings: { mssql: { format: { options: values } } },
            });

            // Un URI distinto por texto: el STS guarda el contenido del documento abierto, y
            // reabrir el mismo URI con otro texto obligaría a llevar versiones.
            const uri = `file:///sqlworks-preview/${hash(sql)}.sql`;
            if (!this.opened.has(uri)) {
                this.notify("textDocument/didOpen", {
                    textDocument: { uri, languageId: "sql", version: 1, text: sql },
                });
                this.opened.add(uri);
            }

            const edits = (await this.request("textDocument/formatting", {
                textDocument: { uri },
                options: { tabSize: 4, insertSpaces: true },
            })) as TextEdit[] | null;

            return { text: applyEdits(sql, edits ?? []) };
        } catch (error) {
            return {
                errorMessage: error instanceof Error ? error.message : Strings.format.previewFailed,
            };
        }
    }

    /** Arranca el proceso la primera vez. Las llamadas siguientes esperan al mismo arranque. */
    private ensureStarted(): Promise<void> {
        if (this.startup) {
            return this.startup;
        }
        this.startup = this.start();
        return this.startup;
    }

    private async start(): Promise<void> {
        const executable = this.findExecutable();
        if (!executable) {
            throw new Error(Strings.format.previewNoBinary);
        }

        const server = spawn(executable, [], { stdio: ["pipe", "pipe", "pipe"] });
        this.server = server;
        // El STS escribe trazas por stderr. No interesan, pero hay que consumirlas: si nadie lee
        // la tubería, se llena y el proceso se bloquea.
        server.stderr.on("data", () => undefined);
        server.stdout.on("data", (chunk: Buffer) => this.onData(chunk));
        server.on("exit", () => {
            // Si se muere, la próxima vista previa lo vuelve a arrancar en lugar de quedarse colgada.
            this.server = undefined;
            this.startup = undefined;
            this.opened.clear();
        });

        await this.request("initialize", {
            processId: process.pid,
            rootPath: null,
            rootUri: null,
            capabilities: {},
        });
        this.notify("initialized", {});
    }

    /**
     * Ruta del ejecutable del STS que ya va en el paquete.
     *
     * Se busca el que hay, sin descargar nada y sin mirar la versión: el descargador y el arranque
     * del STS son del upstream y no se tocan (§16 del brief).
     */
    private findExecutable(): string | undefined {
        const root = path.join(this.extensionUri.fsPath, "sqltoolsservice");
        let versions: string[];
        try {
            versions = fs.readdirSync(root);
        } catch {
            return undefined;
        }

        const names =
            process.platform === "win32"
                ? ["MicrosoftSqlToolsServiceLayer.exe"]
                : ["MicrosoftSqlToolsServiceLayer"];
        const platforms = ["Windows", "Linux", "MacOs", "OSX", "."];

        for (const version of versions) {
            for (const platform of platforms) {
                for (const name of names) {
                    const candidate = path.join(root, version, platform, name);
                    if (fs.existsSync(candidate)) {
                        return candidate;
                    }
                }
            }
        }
        return undefined;
    }

    private onData(chunk: Buffer): void {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        for (;;) {
            const headerEnd = this.buffer.indexOf("\r\n\r\n");
            if (headerEnd < 0) {
                return;
            }
            const header = this.buffer.subarray(0, headerEnd).toString("utf8");
            const match = /Content-Length: (\d+)/i.exec(header);
            if (!match) {
                // Cabecera que no se entiende: se descarta para no quedarse atascado en ella.
                this.buffer = this.buffer.subarray(headerEnd + 4);
                continue;
            }
            const length = Number(match[1]);
            const start = headerEnd + 4;
            if (this.buffer.length < start + length) {
                return;
            }
            const payload = this.buffer.subarray(start, start + length).toString("utf8");
            this.buffer = this.buffer.subarray(start + length);

            let message: { id?: number; result?: unknown; error?: unknown };
            try {
                message = JSON.parse(payload);
            } catch {
                continue;
            }
            if (typeof message.id !== "number") {
                continue;
            }
            const entry = this.pending.get(message.id);
            if (!entry) {
                continue;
            }
            this.pending.delete(message.id);
            clearTimeout(entry.timer);
            if (message.error) {
                entry.reject(new Error(Strings.format.previewFailed));
            } else {
                entry.resolve(message.result);
            }
        }
    }

    private request(method: string, params: unknown): Promise<unknown> {
        if (this.disposed) {
            return Promise.reject(new Error("cerrado"));
        }
        const id = this.nextId++;
        const promise = new Promise<unknown>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(Strings.format.previewTimeout));
            }, REQUEST_TIMEOUT_MS);
            this.pending.set(id, { resolve, reject, timer });
        });
        this.send({ jsonrpc: "2.0", id, method, params });
        return promise;
    }

    private notify(method: string, params: unknown): void {
        this.send({ jsonrpc: "2.0", method, params });
    }

    private send(message: unknown): void {
        const server = this.server;
        if (!server?.stdin.writable) {
            return;
        }
        const body = Buffer.from(JSON.stringify(message), "utf8");
        server.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
        server.stdin.write(body);
    }
}

/**
 * Aplica los edits del formateador sobre el texto. Función pura, exportada para probarla.
 *
 * Se aplican **de atrás hacia delante** para que los desplazamientos de un edit no invaliden las
 * posiciones de los siguientes.
 */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
    if (edits.length === 0) {
        return text;
    }
    const lines = text.split("\n");
    const offsetOf = (position: { line: number; character: number }): number => {
        let offset = 0;
        for (let index = 0; index < position.line && index < lines.length; index += 1) {
            offset += lines[index].length + 1;
        }
        return offset + position.character;
    };

    return [...edits]
        .sort((a, b) => offsetOf(b.range.start) - offsetOf(a.range.start))
        .reduce(
            (accumulated, edit) =>
                accumulated.slice(0, offsetOf(edit.range.start)) +
                edit.newText +
                accumulated.slice(offsetOf(edit.range.end)),
            text,
        );
}

/** Identificador corto y estable de un texto, para darle un URI propio a cada muestra. */
export function hash(text: string): string {
    let value = 0;
    for (let index = 0; index < text.length; index += 1) {
        value = (value * 31 + text.charCodeAt(index)) | 0;
    }
    return (value >>> 0).toString(36);
}
