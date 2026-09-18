/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Sonda JSON-RPC contra el SQL Tools Service: qué devuelve de verdad al pedirle sugerencias.
 *
 * Es el arnés nº 2 de FORK.md §13.1, ahora en el repositorio. Habla directamente con el binario del
 * STS por los mismos contratos que usa la extensión, sin VS Code de por medio, así que separa lo que
 * hace el servidor de lo que hace el editor. Con eso se cerró §28.
 *
 * ## Uso
 *
 * ```bash
 * # 1. Una instancia con la base sembrada (ver §13.1 y §28.2)
 * docker run -d --name mssql-prueba -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='<contraseña>' \
 *   -e MSSQL_PID=Developer -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest
 *
 * # 2. El binario del STS. Si la extensión ya arrancó alguna vez está en
 * #    extensions/mssql/sqltoolsservice/<versión>/<plataforma>/; si no, se baja el mismo artefacto
 * #    que se baja ella sola (la URL está en src/configurations/config.ts).
 *
 * node extensions/mssql/test/harness/stsCompletionProbe.mjs \
 *   --sts <ruta>/MicrosoftSqlToolsServiceLayer \
 *   --password '<contraseña>' [--server localhost,1433] [--database SqlWorksPrueba] [--user sa]
 * ```
 *
 * ## Dos formas de medir mal, las dos vividas
 *
 * **Una.** La primera versión mandaba el contenido entero en `textDocument/didChange`. Las
 * respuestas salían **idénticas en todos los casos**, que era justo lo que se quería demostrar, así
 * que parecía un hallazgo. No lo era: el STS declara `textDocumentSync: 2` (incremental) y no
 * aplicaba esos cambios, o sea que el documento que tenía seguía siendo el del `didOpen`. Una
 * medición equivocada que confirmaba la hipótesis, que es la peor clase.
 *
 * **Y dos.** El arreglo siguiente —un URI y una conexión por caso— medía bien, pero a partir del
 * quinto caso el STS dejaba de mandar `intelliSenseReady` y la sonda se colgaba: cada caso dejaba
 * una conexión viva y la cola de binding del servidor se atascaba.
 *
 * Así que esto hace lo que hace VS Code: **una conexión, un documento, y cambios incrementales con
 * su rango**. Y trae su propia comprobación: si los cambios no se estuvieran aplicando, el rango del
 * `textEdit` saldría igual en todos los casos en lugar de seguir a lo escrito (14→18, 14→24, 14→14).
 * Si eso pasa, la medición no vale, por muy redonda que parezca.
 */

import { spawn } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
if (!args.sts || !args.password) {
    console.error("Faltan --sts y/o --password. Ver la cabecera de este archivo.");
    process.exit(2);
}

const CONNECTION_OPTIONS = {
    server: args.server ?? "localhost,1433",
    database: args.database ?? "SqlWorksPrueba",
    user: args.user ?? "sa",
    password: args.password,
    authenticationType: "SqlLogin",
    encrypt: "Optional",
    trustServerCertificate: true,
    applicationName: "sqlworks-sts-probe",
};

/**
 * Los casos. Cada uno es el texto de una línea, dónde está el cursor, y qué se espera encontrar.
 * Son los de §28: el mismo nombre escrito de tres formas, y el cursor en dos sitios.
 */
const CASES = [
    { name: "«DSHB» en mayúsculas, cursor al final", text: "SELECT * FROM DSHB", character: 18 },
    { name: "«dshb» en minúsculas, cursor al final", text: "SELECT * FROM dshb", character: 18 },
    { name: "«navigation», cursor al final", text: "SELECT * FROM navigation", character: 24 },
    { name: "nada escrito (Ctrl+Espacio en el hueco)", text: "SELECT * FROM ", character: 14 },
    {
        name: "«dshb» escrito, preguntando en el INICIO de la palabra",
        text: "SELECT * FROM dshb",
        character: 14,
    },
];

/** Lo que se busca en cada respuesta. */
const LOOKING_FOR = /^\[?DSHB_Navigation\]?$/i;

const child = spawn(args.sts, [], { stdio: ["pipe", "pipe", "pipe"] });
child.stderr.on("data", (data) => process.stderr.write(`[sts] ${data}`));

let buffer = Buffer.alloc(0);
let nextId = 1;
const pending = new Map();
const waiters = [];

function send(message) {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    child.stdin.write(body);
}

function request(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ jsonrpc: "2.0", id, method, params });
    });
}

function notify(method, params) {
    send({ jsonrpc: "2.0", method, params });
}

/** Espera una notificación del servidor. `match` acota a la del documento que toca. */
function waitFor(method, match, timeoutMs = 180000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`sin '${method}' en ${timeoutMs} ms`)),
            timeoutMs,
        );
        waiters.push({
            method,
            match,
            resolve: (params) => {
                clearTimeout(timer);
                resolve(params);
            },
        });
    });
}

child.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd < 0) {
            return;
        }
        const header = buffer.subarray(0, headerEnd).toString("ascii");
        const length = Number(/Content-Length: (\d+)/i.exec(header)?.[1]);
        if (!Number.isFinite(length) || buffer.length < headerEnd + 4 + length) {
            return;
        }
        const body = buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString("utf8");
        buffer = buffer.subarray(headerEnd + 4 + length);
        let message;
        try {
            message = JSON.parse(body);
        } catch {
            continue;
        }
        if (message.id !== undefined && pending.has(message.id)) {
            const { resolve, reject } = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) {
                reject(new Error(JSON.stringify(message.error)));
            } else {
                resolve(message.result);
            }
        } else if (message.method) {
            const index = waiters.findIndex(
                (waiter) =>
                    waiter.method === message.method &&
                    (!waiter.match || waiter.match(message.params)),
            );
            if (index >= 0) {
                waiters.splice(index, 1)[0].resolve(message.params);
            }
        }
    }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** El STS responde un array suelto o una `CompletionList`; aquí da igual cuál. */
const itemsOf = (result) => (Array.isArray(result) ? result : (result?.items ?? []));

const URI = "file:///tmp/sqlworks-probe.sql";
/** Lo que el servidor tiene ahora mismo en la línea 0, para poder mandar el cambio con su rango. */
let currentLine = "";
let version = 1;

/** Conecta y abre el documento, vacío. Una sola vez. */
async function openDocument() {
    const connected = waitFor("connection/complete", (params) => params.ownerUri === URI);
    await request("connection/connect", {
        ownerUri: URI,
        connection: { options: CONNECTION_OPTIONS },
    });
    const complete = await connected;
    if (complete.errorMessage) {
        throw new Error(`conexión: ${complete.errorMessage}`);
    }
    console.log(`Conectado: ${complete.serverInfo?.serverVersion?.split("\n")[0] ?? "?"}`);

    const ready = waitFor("textDocument/intelliSenseReady", (params) => params.ownerUri === URI);
    notify("textDocument/didOpen", {
        textDocument: { uri: URI, languageId: "sql", version, text: currentLine },
    });
    await ready;
    console.log("IntelliSense listo.\n");
}

/** Deja la línea 0 en `text` con un cambio incremental y pide sugerencias en `character`. */
async function completionIn(text, character) {
    notify("textDocument/didChange", {
        textDocument: { uri: URI, version: ++version },
        contentChanges: [
            {
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: currentLine.length },
                },
                rangeLength: currentLine.length,
                text,
            },
        ],
    });
    currentLine = text;
    // El análisis del documento va por detrás de la notificación. Sin esperar, el primer caso sale
    // corto y parece un filtro del servidor.
    await sleep(700);

    const result = await request("textDocument/completion", {
        textDocument: { uri: URI },
        position: { line: 0, character },
        context: { triggerKind: 1 },
    });
    return { result, items: itemsOf(result) };
}

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 2) {
        if (argv[index]?.startsWith("--")) {
            parsed[argv[index].slice(2)] = argv[index + 1];
        }
    }
    return parsed;
}

(async () => {
    const initialize = await request("initialize", {
        processId: process.pid,
        rootPath: "/tmp",
        capabilities: {},
        trace: "off",
    });
    const sync = initialize?.capabilities?.textDocumentSync;
    console.log(`textDocumentSync del STS: ${JSON.stringify(sync)} (1 = entero, 2 = incremental)`);
    await openDocument();

    /** Para la autocomprobación del final: si no varían, los cambios no se estaban aplicando. */
    const ranges = new Set();

    for (const testCase of CASES) {
        const { result, items } = await completionIn(testCase.text, testCase.character);
        const wanted = items.find((item) => LOOKING_FOR.test(item.label));
        const range = wanted?.textEdit?.range;

        console.log(testCase.name);
        console.log(
            `   sugerencias: ${items.length}   isIncomplete: ${
                Array.isArray(result) ? "(array suelto)" : result?.isIncomplete
            }`,
        );
        console.log(`   ¿está la tabla buscada?: ${wanted ? "SÍ" : "NO"}`);
        if (wanted) {
            const printed = range
                ? `${range.start.character}→${range.end.character}`
                : "(sin textEdit)";
            ranges.add(printed);
            console.log(`   rango del textEdit: ${printed}   cursor en ${testCase.character}`);
            console.log(
                `   filterText: ${JSON.stringify(wanted.filterText)}   sortText: ${JSON.stringify(
                    wanted.sortText,
                )}`,
            );
        }
        console.log();
    }

    // La autocomprobación. Ver la cabecera: sin esto, una sonda que no aplica los cambios saca
    // respuestas idénticas y parece que el servidor no filtra, midiendo nada.
    if (ranges.size <= 1) {
        console.error(
            `AVISO: el rango del textEdit no varía entre casos (${[...ranges].join(", ")}). Los` +
                " cambios no se están aplicando y esta ejecución no mide nada.",
        );
        child.kill();
        process.exit(1);
    }
    console.log(`El rango sigue a lo escrito (${[...ranges].join(", ")}): la medición es válida.`);

    child.kill();
    process.exit(0);
})().catch((error) => {
    console.error("FALLO:", error.message);
    child.kill();
    process.exit(1);
});
