/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
    Spill,
    findLeftoverSpills,
    isDabTempDirName,
    watchContainerSpills,
} from "../../../src/custom/overrides/containerWatch";

/**
 * El control del camino de contenedor (M10, FORK.md §28).
 *
 * Lo que se fija aquí es **de qué avisa y de qué no**. Un control que saltara con cualquier
 * directorio del temporal sería peor que no tenerlo: `os.tmpdir()` lo comparte toda la máquina, y
 * un aviso que a veces miente deja de leerse. Por eso la mitad de estos tests son negativos.
 */

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

/** Un temporal propio por test, para no depender de lo que haya en el del sistema. */
function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "sqlworks-test-"));
}

suite("Fork: vigilancia del camino de contenedor de DAB", () => {
    suite("qué nombre cuenta como directorio de DAB", () => {
        test("reconoce el que crea el upstream: `dab-` más un UUID", () => {
            // La forma sale de `dabService.ts:649`: `path.join(os.tmpdir(), \`dab-${uuid()}\`)`.
            expect(isDabTempDirName(`dab-${UUID}`)).to.equal(true);
        });

        test("acepta el UUID en mayúsculas", () => {
            expect(isDabTempDirName(`dab-${UUID.toUpperCase()}`)).to.equal(true);
        });

        test("no le vale el prefijo suelto", () => {
            // Éste es el test que importa: `dab-cache` o `dab-tmp` son de cualquiera.
            expect(isDabTempDirName("dab-cache")).to.equal(false);
            expect(isDabTempDirName("dab-")).to.equal(false);
            expect(isDabTempDirName("dab")).to.equal(false);
        });

        test("no le vale un UUID sin el prefijo, ni un prefijo distinto", () => {
            expect(isDabTempDirName(UUID)).to.equal(false);
            expect(isDabTempDirName(`sql-${UUID}`)).to.equal(false);
        });

        test("no le vale el nombre con algo pegado detrás", () => {
            expect(isDabTempDirName(`dab-${UUID}.tmp`)).to.equal(false);
        });
    });

    suite("restos de un despliegue anterior", () => {
        test("encuentra el directorio que el upstream no borró", () => {
            const tmpDir = makeTmpDir();
            const left = path.join(tmpDir, `dab-${UUID}`);
            fs.mkdirSync(left);
            // El upstream escribe aquí la cadena de conexión con `mode: 0o600`. El control **no**
            // abre el archivo; que exista es lo único que mira.
            fs.writeFileSync(path.join(left, "dab-config.json"), "{}", { mode: 0o600 });

            const found = findLeftoverSpills(tmpDir);

            expect(found).to.deep.equal([{ kind: "leftover", directory: left }]);
        });

        test("no confunde un archivo suelto con un despliegue", () => {
            const tmpDir = makeTmpDir();
            fs.writeFileSync(path.join(tmpDir, `dab-${UUID}`), "");

            expect(findLeftoverSpills(tmpDir)).to.deep.equal([]);
        });

        test("no avisa de los directorios de los demás", () => {
            const tmpDir = makeTmpDir();
            fs.mkdirSync(path.join(tmpDir, "dab-cache"));
            fs.mkdirSync(path.join(tmpDir, "vscode-typescript"));

            expect(findLeftoverSpills(tmpDir)).to.deep.equal([]);
        });

        test("un temporal que no se puede leer no es un hallazgo", () => {
            // Un entorno raro no puede convertirse en un aviso falso ni en una excepción.
            expect(
                findLeftoverSpills(path.join(os.tmpdir(), "sqlworks-no-existe-jamas")),
            ).to.deep.equal([]);
        });
    });

    suite("arranque de la vigilancia", () => {
        test("avisa una sola vez por directorio", () => {
            const tmpDir = makeTmpDir();
            fs.mkdirSync(path.join(tmpDir, `dab-${UUID}`));
            const seen: Spill[] = [];

            const watch = watchContainerSpills({ tmpDir, onSpill: (spill) => seen.push(spill) });
            watch.dispose();

            expect(seen).to.have.length(1);
            expect(seen[0].kind).to.equal("leftover");
        });

        test("no avisa de nada cuando el temporal está limpio, que es el caso normal", () => {
            const seen: Spill[] = [];

            const watch = watchContainerSpills({
                tmpDir: makeTmpDir(),
                onSpill: (s) => seen.push(s),
            });
            watch.dispose();

            expect(seen).to.deep.equal([]);
        });

        test("un temporal inexistente no impide arrancar el fork", () => {
            // `fs.watch` lanza sobre un directorio que no existe. Si eso subiera, `registerCustom`
            // se quedaría a medias y el panel no se registraría.
            const seen: Spill[] = [];
            const missing = path.join(os.tmpdir(), "sqlworks-no-existe-jamas");

            const watch = watchContainerSpills({ tmpDir: missing, onSpill: (s) => seen.push(s) });

            expect(seen).to.deep.equal([]);
            expect(() => watch.dispose()).to.not.throw();
        });
    });
});
