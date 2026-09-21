/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Distancia con el upstream (M10).
 *
 * ## Por qué medir en lugar de mirar el calendario
 *
 * El punto 3 del §12 fija integrar el upstream cada tres meses, y el aviso que va justo debajo
 * reconoce que puede ser demasiado: entre `v1.42.2` y `1.46.0` entraron un motor de lenguaje SQL
 * nuevo, un servidor MCP y la migración de la rejilla. Una fecha no dice nada de eso.
 *
 * Lo que sí lo dice es **cuántos de los commits nuevos tocan los archivos de la tabla del §0**,
 * porque son los únicos que pueden entrar en conflicto. Ése es el número que decide si un merge es
 * un trámite o un hito, y es el que esto imprime.
 *
 * ## Lo que no hace
 *
 * **No integra nada.** Ni hace merge, ni cambia de rama, ni escribe en el repositorio. Con
 * `--fetch` trae las referencias del remoto `upstream`, y eso es todo lo que toca.
 *
 * Uso:
 *
 *     node scripts/fork/upstream-distance.mjs [--fetch] [--json] [--ref upstream/main]
 *
 * Sale con 0 tanto si hay commits nuevos como si no: es un informe, no una comprobación. Sale con 2
 * si `FORK.md` no declara un punto de comparación usable, que sí es un defecto.
 */

import { FORK_MD, git, readBaseline, readDeclaredPaths, readForkMd, tryGit } from "./forkMd.mjs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const refIndex = args.indexOf("--ref");
const ref = refIndex >= 0 ? args[refIndex + 1] : "upstream/main";

const forkMd = readForkMd();
const baseline = readBaseline(forkMd, { requireInHistory: true });
if (!baseline) {
    console.error(
        `\n  distancia con el upstream: ${FORK_MD} no declara un commit del upstream que esté en esta historia. Es la fila «Último merge con el upstream».\n`,
    );
    process.exit(2);
}

if (args.includes("--fetch")) {
    // Falla en silencio a propósito: sin red se mide con lo que ya haya en local, y el informe lo
    // dice. Un error de red no es un hallazgo sobre el fork.
    tryGit("fetch", "--quiet", ref.split("/")[0], ref.split("/").slice(1).join("/") || "main");
}

/**
 * Sin la referencia del upstream no hay nada que medir, y eso **no es un fallo**: una máquina
 * recién clonada no tiene el remoto `upstream` configurado. Se dice y se sale con 0, para que una
 * rutina periódica no empiece a dar rojos que nadie puede arreglar.
 */
if (tryGit("rev-parse", "--verify", "--quiet", `${ref}^{commit}`) === undefined) {
    const report = {
        measured: false,
        reason: `No existe la referencia \`${ref}\` en este clon. Configúrala con \`git remote add upstream https://github.com/microsoft/vscode-mssql.git\` y vuelve a lanzarlo con --fetch.`,
    };
    console.log(asJson ? JSON.stringify(report, undefined, 2) : `  · ${report.reason}`);
    process.exit(0);
}

const declared = [...readDeclaredPaths(forkMd)];
const range = `${baseline}..${ref}`;

const lines = (output) => (output ?? "").split("\n").filter((line) => line.trim().length > 0);

const commits = lines(git("rev-list", range)).length;
// `--` separa los commits de las rutas: sin él, git interpretaría un nombre de archivo como rama.
const risky = lines(git("log", "--oneline", "--no-decorate", range, "--", ...declared));
const riskyFiles = [...new Set(lines(git("diff", "--name-only", range, "--", ...declared)))].sort();

/** La versión de la extensión en la punta del upstream, que es lo que hereda el fork al integrar. */
const upstreamVersion = (() => {
    const manifest = tryGit("show", `${ref}:extensions/mssql/package.json`);
    try {
        return JSON.parse(manifest).version;
    } catch {
        return undefined;
    }
})();

const report = {
    measured: true,
    baseline,
    ref,
    commits,
    riskyCommits: risky.length,
    riskyFiles,
    upstreamVersion,
};

if (asJson) {
    console.log(JSON.stringify(report, undefined, 2));
    process.exit(0);
}

console.log(`  · punto de comparación: ${baseline} (declarado en ${FORK_MD})`);
console.log(
    `  · referencia del upstream: ${ref}${upstreamVersion ? ` (versión ${upstreamVersion})` : ""}`,
);
console.log(`  · commits nuevos del upstream: ${commits}`);

if (commits === 0) {
    console.log(`\n  El fork está al día con ${ref}.\n`);
    process.exit(0);
}

console.log(`  · de ésos, tocan archivos de la tabla del §0: ${risky.length}`);

if (risky.length === 0) {
    console.log(
        `\n  Hay ${commits} commit(s) por integrar y ninguno toca un archivo nuestro: el merge no debería dar conflictos.\n`,
    );
    process.exit(0);
}

console.log(`\n  Archivos nuestros que el upstream ha tocado:\n`);
for (const file of riskyFiles) {
    console.log(`    - ${file}`);
}
console.log(`\n  Commits que los tocan (los 10 más recientes):\n`);
for (const commit of risky.slice(0, 10)) {
    console.log(`    ${commit}`);
}
console.log(
    `\n  Son los que pueden dar conflicto. El resto del merge es incorporar archivos que no tocamos.\n`,
);
