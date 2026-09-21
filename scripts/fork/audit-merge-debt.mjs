/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Auditoría de la deuda de merge del fork (M10).
 *
 * ## Qué problema resuelve
 *
 * La tabla del §0 de FORK.md es lo que predice el coste de cada merge: dice qué archivos del
 * upstream hemos tocado y, por tanto, cuáles pueden entrar en conflicto. Se mantiene a mano, y en
 * M9 se descubrió que **no era exacta** (§26.5): un archivo de la tabla no llevaba el marcador
 * `// [FORK]`, así que `git grep "\[FORK\]"` no lo veía. El hallazgo no fue el archivo: fue que la
 * tabla y el código podían separarse sin que nadie se enterara.
 *
 * Esto compara las tres fuentes que tienen que decir lo mismo y falla cuando no cuadran:
 *
 * 1. **Lo que git dice** que hemos cambiado respecto al último punto del upstream.
 * 2. **Lo que la tabla del §0 declara.**
 * 3. **Los marcadores `// [FORK]`** dentro de cada archivo del upstream modificado.
 *
 * Y una cuarta comprobación, que es la que sostiene la convención del §0 para `package.json`: todo
 * lo que el fork añade al manifiesto lleva el prefijo `sqlworks.`. En cuanto una clave `mssql.*`
 * propia entrara ahí, `git grep '"sqlworks\.'` dejaría de bastar como auditoría (§26.8, corrección 3).
 *
 * ## De dónde sale el punto de comparación
 *
 * **Del propio FORK.md**, de la fila «Último merge con el upstream» de la tabla de cabecera. Es
 * deliberado: si alguien integra el upstream y no actualiza esa fila, esta auditoría se rompe, que
 * es exactamente la disciplina que pide el punto 5 de la política de merge del §12. No hace falta
 * el remoto `upstream` ni red, solo que ese commit esté en la historia.
 *
 * Uso:
 *
 *     node scripts/fork/audit-merge-debt.mjs [--json]
 *
 * Sale con 0 si todo cuadra, 1 si algo no cuadra, y 2 si no pudo ni empezar.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
    FORK_MD,
    git,
    readBaseline,
    readDeclaredPaths,
    readForkMd,
    repoRoot,
    tryGit,
} from "./forkMd.mjs";

const MANIFEST = "extensions/mssql/package.json";

/**
 * Archivos del upstream que se modifican y **no pueden** llevar el marcador, con el motivo.
 *
 * Es una lista corta y cerrada a propósito: cada entrada es una excepción a la regla, y una
 * excepción sin motivo escrito es un agujero. Si la lista crece, la regla está mal planteada.
 */
const MARKER_EXEMPT = new Map([
    [MANIFEST, "JSON no admite comentarios; se audita por el prefijo `sqlworks.` (ver abajo)"],
    [
        "extensions/mssql/package-lock.json",
        "JSON, y además generado: lo reescribe npm a partir del manifiesto",
    ],
    [
        "extensions/mssql/README.md",
        "reescrito entero por el fork: no hay líneas del upstream que marcar",
    ],
    ["extensions/mssql/images/extensionIcon.png", "binario"],
    ["extensions/mssql/images/mssql-chat-avatar.jpg", "binario"],
]);

/** Extensiones cuyo contenido se puede leer como texto para buscar el marcador. */
const TEXT_FILE = /\.(ts|tsx|js|mjs|cjs|json|jsonc|md|yml|yaml)$/;

/** Rutas cuyo contenido es del fork: archivos nuevos, sin deuda de merge y sin marcador. */
const FORK_OWNED = [
    "extensions/mssql/src/custom/",
    "extensions/mssql/test/unit/custom/",
    "extensions/mssql/test/e2e/sqlworks",
    "extensions/mssql/test/e2e/utils/sqlworks",
    "scripts/fork/",
];

/** Lo que git dice: qué cambió respecto al punto del upstream, y cómo. */
function readChanges(baseline) {
    const changes = new Map();
    for (const line of git("diff", "--name-status", `${baseline}..HEAD`).split("\n")) {
        if (!line.trim()) continue;
        const [status, file] = line.split("\t");
        changes.set(file, status[0]);
    }
    return changes;
}

const problems = [];
const notes = [];

function fail(message) {
    console.error(`\n  auditoría de la deuda de merge: ${message}\n`);
    process.exit(2);
}

const forkMd = readForkMd();
const baseline = readBaseline(forkMd, { requireInHistory: true });
if (!baseline) {
    fail(
        `No se puede leer un commit del upstream válido de la fila «Último merge con el upstream» de ${FORK_MD}. Sin él no hay contra qué medir; si el repositorio está clonado en superficie, prueba con \`git fetch --unshallow\`.`,
    );
}
const declared = readDeclaredPaths(forkMd);
const changes = readChanges(baseline);

const isForkOwned = (file) => FORK_OWNED.some((prefix) => file.startsWith(prefix));

// --- 1. Todo archivo del upstream modificado o borrado está declarado en el §0 ---
const touched = [...changes]
    .filter(([file, status]) => (status === "M" || status === "D") && !isForkOwned(file))
    .map(([file]) => file)
    .sort();

for (const file of touched) {
    if (!declared.has(file)) {
        problems.push(
            `${file} está ${changes.get(file) === "D" ? "borrado" : "modificado"} respecto al upstream y no aparece en la tabla del §0 de ${FORK_MD}.`,
        );
    }
}

// --- 2. Todo archivo del upstream modificado lleva su marcador `// [FORK]` ---
for (const file of touched) {
    if (changes.get(file) === "D" || MARKER_EXEMPT.has(file) || !TEXT_FILE.test(file)) {
        continue;
    }
    const contents = readFileSync(path.join(repoRoot, file), "utf8");
    if (!contents.includes("[FORK]")) {
        problems.push(
            `${file} es del upstream y lo hemos modificado, pero no lleva ningún marcador \`[FORK]\`: \`git grep "\\[FORK\\]"\` no lo encuentra. Es el defecto del §26.5.`,
        );
    }
}

// --- 3. Nada declarado en el §0 se ha quedado obsoleto ---
for (const file of [...declared].sort()) {
    if (!changes.has(file)) {
        problems.push(
            `${file} aparece en el §0 de ${FORK_MD} pero ya no se diferencia del upstream. Si un merge lo devolvió a su estado original, sácalo de la tabla.`,
        );
    }
}

// --- 4. Todo lo que el fork añade al manifiesto lleva el prefijo `sqlworks.` ---
//
// Es la convención que sustituye al marcador en `package.json`, y la que hace que
// `git grep '"sqlworks\.'` sea una auditoría completa y no una parcial.
if (changes.get(MANIFEST) === "M") {
    const before = JSON.parse(git("show", `${baseline}:${MANIFEST}`));
    const after = JSON.parse(readFileSync(path.join(repoRoot, MANIFEST), "utf8"));

    const contributedIds = (manifest) => {
        const ids = new Set();
        for (const command of manifest.contributes?.commands ?? []) {
            ids.add(`comando ${command.command}`);
        }
        for (const key of Object.keys(manifest.contributes?.configuration?.properties ?? {})) {
            ids.add(`ajuste ${key}`);
        }
        for (const container of Object.values(manifest.contributes?.viewsContainers ?? {}).flat()) {
            ids.add(`contenedor ${container.id}`);
        }
        for (const view of Object.values(manifest.contributes?.views ?? {}).flat()) {
            ids.add(`vista ${view.id}`);
        }
        return ids;
    };

    const upstreamIds = contributedIds(before);
    for (const id of contributedIds(after)) {
        if (upstreamIds.has(id)) {
            continue;
        }
        const name = id.split(" ")[1];
        if (!name.startsWith("sqlworks.") && !name.startsWith("sqlworks")) {
            problems.push(
                `El fork añade «${id}» al manifiesto sin el prefijo \`sqlworks.\`. La auditoría del §0 se hace con \`git grep '"sqlworks\\.'\`, así que una clave con otro prefijo queda fuera de ella.`,
            );
        }
    }
    notes.push(
        `manifiesto: ${[...contributedIds(after)].filter((id) => !upstreamIds.has(id)).length} contribuciones propias, todas con prefijo del fork`,
    );
}

// --- 5. Nadie se busca a sí mismo por el identificador viejo ---
//
// El §15.6 cuenta lo caro que salió esto en M1: la extensión se autolocaliza con
// `vscode.extensions.getExtension(extensionId)`, y una referencia al identificador de Microsoft
// devuelve `undefined`. El síntoma no es una función que falla, es **el host de extensiones
// cayéndose al cargar el módulo**, y la suite pasando de 5103 pruebas a 89. Un merge que traiga una
// referencia nueva lo reintroduce en silencio, así que se mira en cada build.
const staleSelfReference = tryGit("grep", "-n", '"ms-mssql\\.mssql"', "--", "extensions/mssql/src");
if (staleSelfReference) {
    for (const line of staleSelfReference.split("\n").filter((l) => l.trim())) {
        problems.push(
            `${line.trim()} — referencia al identificador del upstream. La extensión se autolocaliza con ese valor y aquí vale \`alfredc1403.sqlworks\`; si esto se queda, el host de extensiones se cae al cargar (§15.6).`,
        );
    }
}

notes.push(`punto de comparación: ${baseline} (declarado en ${FORK_MD})`);
notes.push(`archivos del upstream con deuda: ${touched.length}`);
notes.push(
    `archivos nuevos del fork: ${[...changes].filter(([f, s]) => s === "A" && isForkOwned(f)).length}`,
);

if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ baseline, touched, problems, notes }, undefined, 2));
} else {
    for (const note of notes) {
        console.log(`  · ${note}`);
    }
    if (problems.length === 0) {
        console.log(`\n  ✔ La tabla del §0, el código y el manifiesto dicen lo mismo.\n`);
    } else {
        console.error(`\n  ✘ ${problems.length} problema(s):\n`);
        for (const problem of problems) {
            console.error(`    - ${problem}`);
        }
        console.error("");
    }
}

process.exit(problems.length === 0 ? 0 : 1);
