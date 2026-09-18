/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as vscode from "vscode";
import {
    findEnabledSettings,
    SettingInspection,
    WATCHED_SETTINGS,
} from "../../../src/custom/overrides/networkWatch";

/**
 * El control detectivo de M9 (§26.8, opción (d)).
 *
 * Lo que se fija aquí no es «que avise», sino **cuándo** avisa y **de qué ámbito**, que es lo único
 * que hace útil el aviso: si dijera siempre «usuario», nadie encontraría una clave que viene en el
 * `.vscode/settings.json` de un repositorio clonado.
 */

const deploymentsView = WATCHED_SETTINGS.find(
    (s) => s.key === "mssql.schemaDesigner.enableDeploymentsView",
)!;
const feedUrl = WATCHED_SETTINGS.find((s) => s.key === "mssql.dab.cliPackageFeedUrl")!;

/** Azúcar para no repetir el objeto de `inspect()` en cada test. */
function reading(
    setting: (typeof WATCHED_SETTINGS)[number],
    inspection: SettingInspection | undefined,
) {
    return [{ setting, inspection }];
}

suite("Fork: vigilancia de las salidas de red del upstream", () => {
    test("no avisa de nada cuando las claves no están puestas", () => {
        // El caso normal, y el que más importa: sin ruido no se ignoran los avisos de verdad.
        const found = findEnabledSettings([
            { setting: deploymentsView, inspection: {} },
            { setting: feedUrl, inspection: {} },
        ]);

        expect(found).to.deep.equal([]);
    });

    test("no avisa si `inspect` no devuelve nada", () => {
        // `inspect()` devuelve `undefined` para una clave que VS Code no conoce. Es justo el estado
        // de hoy: el upstream no declara ninguna de las dos.
        const found = findEnabledSettings(reading(deploymentsView, undefined));

        expect(found).to.deep.equal([]);
    });

    suite("la vista de despliegues", () => {
        test("avisa cuando está en los ajustes de usuario", () => {
            const found = findEnabledSettings(reading(deploymentsView, { globalValue: true }));

            expect(found).to.have.lengthOf(1);
            expect(found[0].key).to.equal("mssql.schemaDesigner.enableDeploymentsView");
            expect(found[0].scope).to.equal("usuario");
        });

        test("avisa cuando la trae el espacio de trabajo", () => {
            // El caso que preocupa: la clave viene en un repositorio clonado, no la puso nadie aquí.
            const found = findEnabledSettings(reading(deploymentsView, { workspaceValue: true }));

            expect(found).to.have.lengthOf(1);
            expect(found[0].scope).to.equal("espacio de trabajo");
        });

        test("no avisa cuando está explícitamente apagada", () => {
            const found = findEnabledSettings(reading(deploymentsView, { globalValue: false }));

            expect(found).to.deep.equal([]);
        });

        test("no confunde con `true` un valor que no lo es", () => {
            // El upstream la lee con `!!`, pero aquí se exige `=== true`: avisar por la cadena
            // "false" o por un 1 sería un falso positivo, y un falso positivo gasta la confianza
            // del aviso. Si alguien escribe eso, el upstream lo encenderá y nosotros no avisaremos;
            // se acepta a cambio de que el aviso, cuando salga, sea siempre cierto.
            for (const value of ["true", 1, {}, []]) {
                expect(
                    findEnabledSettings(reading(deploymentsView, { globalValue: value })),
                ).to.deep.equal([], `no debería avisar por ${JSON.stringify(value)}`);
            }
        });
    });

    suite("el feed de la CLI", () => {
        test("avisa cuando apunta a algún sitio", () => {
            const found = findEnabledSettings(
                reading(feedUrl, { globalValue: "https://nuget.interno/v3-flatcontainer" }),
            );

            expect(found).to.have.lengthOf(1);
            expect(found[0].key).to.equal("mssql.dab.cliPackageFeedUrl");
        });

        test("no avisa por una cadena vacía o en blanco", () => {
            // Se replica el criterio del upstream (`?.trim() || undefined` en `dabCliTool.ts`): para
            // él una cadena en blanco es no estar puesta, así que avisar sería mentir.
            for (const value of ["", "   ", "\t\n"]) {
                expect(findEnabledSettings(reading(feedUrl, { globalValue: value }))).to.deep.equal(
                    [],
                    `no debería avisar por ${JSON.stringify(value)}`,
                );
            }
        });
    });

    test("cuando está puesta en varios ámbitos, señala el más específico", () => {
        // Es el que gana en VS Code y el que hay que ir a quitar. Decir «usuario» cuando lo que
        // manda es la carpeta mandaría a la persona al archivo equivocado.
        const found = findEnabledSettings(
            reading(deploymentsView, {
                globalValue: true,
                workspaceValue: true,
                workspaceFolderValue: true,
            }),
        );

        expect(found).to.have.lengthOf(1);
        expect(found[0].scope).to.equal("carpeta");
    });

    test("un ámbito más específico que la apaga gana, y entonces no se avisa", () => {
        // `workspaceValue: false` no es «no puesto»: es la decisión de apagarla ahí, y es la que
        // vale. El valor efectivo es «apagada», así que avisar sería un falso positivo — y un aviso
        // que a veces miente deja de leerse.
        const found = findEnabledSettings(
            reading(deploymentsView, { globalValue: true, workspaceValue: false }),
        );

        expect(found).to.deep.equal([]);
    });

    test("un ámbito más específico que la enciende gana sobre uno general que la apaga", () => {
        // El simétrico del anterior, y el que de verdad preocupa: los ajustes de la persona la
        // tienen apagada, pero el repositorio que acaba de clonar la enciende.
        const found = findEnabledSettings(
            reading(deploymentsView, { globalValue: false, workspaceValue: true }),
        );

        expect(found).to.have.lengthOf(1);
        expect(found[0].scope).to.equal("espacio de trabajo");
    });

    test("avisa de las dos claves a la vez si las dos están puestas", () => {
        const found = findEnabledSettings([
            { setting: deploymentsView, inspection: { workspaceValue: true } },
            { setting: feedUrl, inspection: { globalValue: "http://feed.interno/v3" } },
        ]);

        expect(found.map((f) => f.key)).to.deep.equal([
            "mssql.schemaDesigner.enableDeploymentsView",
            "mssql.dab.cliPackageFeedUrl",
        ]);
    });

    /**
     * La suposición de la que cuelga todo lo demás.
     *
     * `findEnabledSettings` se salta las claves cuyo `inspect()` devuelve `undefined`. Las dos que
     * vigilamos **no están declaradas** por el upstream en su `contributes.configuration`, así que
     * si VS Code devolviera `undefined` para una clave sin registrar, el control detectivo no se
     * dispararía jamás y sería un adorno.
     *
     * Este test corre dentro de un VS Code de verdad, así que lo mide en lugar de suponerlo.
     */
    test("`inspect()` devuelve algo para una clave que nadie ha declarado", () => {
        const inspection = vscode.workspace
            .getConfiguration()
            .inspect<unknown>("mssql.schemaDesigner.enableDeploymentsView");

        expect(
            inspection,
            "si esto es undefined, el control detectivo no puede funcionar",
        ).to.not.equal(undefined);
        expect(inspection!.key).to.equal("mssql.schemaDesigner.enableDeploymentsView");
    });

    test("las claves vigiladas son las que de verdad gobiernan la descarga", () => {
        // Fija la lista para que nadie la recorte sin enterarse: si el upstream renombra una de las
        // dos, este test sigue pasando (son literales), pero el de arriba del e2e y §26.8 dicen
        // dónde mirar. Lo que este test impide es quitar una en silencio.
        expect(WATCHED_SETTINGS.map((s) => s.key)).to.deep.equal([
            "mssql.schemaDesigner.enableDeploymentsView",
            "mssql.dab.cliPackageFeedUrl",
        ]);
    });
});
