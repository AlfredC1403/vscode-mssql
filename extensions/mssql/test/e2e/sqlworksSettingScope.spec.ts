/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { Page, expect } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { test } from "./baseFixtures";
import { useSharedVsCodeLifecycle } from "./utils/testLifecycle";
import { findSqlworksWebview } from "./utils/sqlworksWebview";
import { DEFAULT_USER_CONFIG } from "./utils/launchVscodeWithMsSqlExt";
import { getPassword, getServerName, getUserName } from "./utils/envConfigReader";

/**
 * ¿Protege de verdad `scope: "application"`? (M9, decisión (e) de §26.8)
 *
 * ## Qué se mide y por qué hacía falta
 *
 * `sqlworks.productionServers` se declaró en M5 con **`scope: "application"`**, y tanto el
 * `package.json` como §22.7 afirman lo mismo: que gracias a ese ámbito **el `settings.json` de un
 * repositorio no puede desmarcar un servidor de producción**. Esa frase sostiene la regla 11.4 del
 * brief, que es una barrera de seguridad de verdad —la que obliga a escribir el nombre del objeto
 * antes de tocar un servidor marcado—, y hasta M9 **nadie la había comprobado**: era conocimiento
 * del API de VS Code, no una medida de este repositorio.
 *
 * Se descubrió al estudiar la opción (b) de §26.8, que se apoyaba en la misma creencia. Antes de
 * recomendarla había que saber si la creencia era cierta, y al ir a comprobarlo resultó que ya
 * había un control en producción apoyado en ella.
 *
 * ## Por qué son dos arranques y no uno
 *
 * Una sola prueba no mediría nada. Si se siembra el ajuste en el `.vscode/settings.json` de una
 * carpeta y la marca no aparece, eso **por sí solo no demuestra** que lo haya filtrado el `scope`:
 * podría no aparecer porque el ajuste está mal escrito, porque el patrón no casa, o porque el panel
 * no llegó a leerlo.
 *
 * Así que es un experimento controlado con **una sola variable, el ámbito**:
 *
 * - **Control**: el mismo valor exacto, en los ajustes de **usuario**, con la misma carpeta abierta.
 *   La marca **tiene** que aparecer. Si no aparece, el test está mal y no dice nada del `scope`.
 * - **Prueba**: el mismo valor exacto, en el `.vscode/settings.json` de la **carpeta**. La marca
 *   **no** tiene que aparecer.
 *
 * Las dos abren carpeta, para que la única diferencia sea dónde está escrito el ajuste.
 *
 * ## Si este test se pone rojo
 *
 * No es un test frágil que haya que relajar: significaría que **un repositorio clonado puede
 * desmarcar un servidor de producción**, y que §22.7 y la descripción del ajuste en el
 * `package.json` están mintiendo. El arreglo sería cambiar el `scope` (`machine` es el equivalente
 * que además queda fuera de Settings Sync), no ablandar la aserción.
 */

const CONNECT_TIMEOUT_MS = 180_000;
const PROFILE_NAME = "sqlworks-scope";

test.setTimeout(900_000);

/** El valor que se siembra, idéntico en los dos arranques. Marca cualquier servidor. */
const PRODUCTION_SETTING = { serverPatterns: ["*"] };

const BASE_CONFIG = {
    ...DEFAULT_USER_CONFIG,
    "window.dialogStyle": "custom",
    /**
     * **Esto no es comodidad: sin ello el experimento no mide lo que dice medir.**
     *
     * VS Code abre una carpeta desconocida en modo restringido y, además de plantar un diálogo de
     * confianza que colgaría el test, **descarta por su cuenta parte de los ajustes del espacio de
     * trabajo**. Si la marca de producción no apareciera en ese estado, no se sabría si la filtró el
     * `scope: "application"` —que es lo que se quiere medir— o simplemente la falta de confianza.
     *
     * Con la confianza desactivada, los ajustes de la carpeta se aplican con normalidad y la única
     * cosa que puede descartar el nuestro es su ámbito. Que es justo el experimento.
     */
    "security.workspace.trust.enabled": false,
    "mssql.connections": [
        {
            profileName: PROFILE_NAME,
            server: getServerName(),
            authenticationType: "SqlLogin",
            database: "ParityDb",
            user: getUserName(),
            password: getPassword(),
            savePassword: false,
            trustServerCertificate: true,
            encrypt: "Mandatory",
        },
    ],
};

/**
 * Crea una carpeta temporal que hace de repositorio clonado.
 *
 * `workspaceSettings` es lo que iría en su `.vscode/settings.json`; si no se pasa, la carpeta se
 * abre sin ajustes propios, que es lo que necesita el control.
 */
function makeWorkspaceFolder(label: string, workspaceSettings?: Record<string, unknown>): string {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), `sqlworks-scope-${label}-`));
    if (workspaceSettings) {
        const vscodeDir = path.join(folder, ".vscode");
        fs.mkdirSync(vscodeDir, { recursive: true });
        fs.writeFileSync(
            path.join(vscodeDir, "settings.json"),
            JSON.stringify(workspaceSettings, undefined, 4),
        );
    }
    return folder;
}

/**
 * Comprueba que la carpeta **está de verdad abierta** antes de medir nada.
 *
 * No es celo: la primera versión de este test **pasaba sin que la carpeta se abriera**. VS Code se
 * tragaba la ruta pasada como argumento suelto y arrancaba con la ventana vacía, así que no había
 * ajustes de espacio de trabajo, así que la marca no aparecía, así que el test se ponía verde… y no
 * demostraba nada. Un test cuya premisa no se comprueba puede pasar por el motivo equivocado, y éste
 * lo hizo.
 *
 * Se mira el **título de la ventana**, que lleva el nombre de la carpeta abierta. Se eligió por ser
 * lo que menos depende de la interfaz: no hay que pulsar nada, no cambia la vista activa —el resto
 * del test necesita la barra de SQLWorks tal y como la dejó el lanzador— y no se rompe si VS Code
 * reorganiza el Explorador.
 */
async function assertWorkspaceFolderIsOpen(page: Page, folder: string) {
    const name = path.basename(folder);
    await expect
        .poll(async () => await page.title(), {
            timeout: 60_000,
            message: `La carpeta ${name} no está abierta: sin espacio de trabajo este test no mide nada.`,
        })
        .toContain(name);
}

/** Conecta el nodo del servidor y abre el panel. Igual que en `sqlworksAdminPanel.spec.ts`. */
async function openAdminPanel(page: Page) {
    const node = page.locator(`[role="treeitem"][aria-label^="${PROFILE_NAME}"]`).first();
    await node.waitFor({ state: "visible", timeout: 60_000 });
    await node.click();
    await page.keyboard.press("ArrowRight");

    const deadline = Date.now() + CONNECT_TIMEOUT_MS;
    let expanded = false;
    while (Date.now() < deadline) {
        if ((await node.getAttribute("aria-expanded")) === "true") {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            expanded = true;
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!expanded) {
        throw new Error(`El nodo "${PROFILE_NAME}" no llegó a conectarse y expandirse.`);
    }

    await node.click({ button: "right" });
    const menuItem = page
        .locator('.monaco-menu [role="menuitem"], .context-view [role="menuitem"]')
        .filter({ hasText: /Administraci/ })
        .first();
    await menuItem.waitFor({ state: "visible", timeout: 30_000 });
    await menuItem.hover();
    await page.keyboard.press("Enter");

    const panel = await findSqlworksWebview(page, (frame) =>
        frame.getByRole("heading", { name: "Administración" }),
    );
    await expect(panel.getByRole("heading", { name: "Administración" })).toBeVisible({
        timeout: 60_000,
    });
    return panel;
}

test.describe("SQLWorks - control: el ajuste de producción en los ajustes de usuario SÍ manda", () => {
    // Carpeta abierta, pero sin ajustes propios: la única fuente del ajuste son los de usuario.
    const folder = makeWorkspaceFolder("user");

    const getContext = useSharedVsCodeLifecycle({
        launchOptions: {
            initialConfig: {
                ...BASE_CONFIG,
                "sqlworks.productionServers": PRODUCTION_SETTING,
            },
            workspaceFolder: folder,
        },
    });

    test("la marca de producción aparece", async () => {
        const { page } = getContext();
        await assertWorkspaceFolderIsOpen(page, folder);
        const panel = await openAdminPanel(page);

        // Esto es lo que valida el experimento: con el mismo valor en el ámbito que SÍ admite el
        // `scope: "application"`, la marca aparece. Si esto fallara, la prueba de abajo no
        // significaría nada.
        await expect(panel.getByText("PRODUCCIÓN", { exact: true }).first()).toBeVisible({
            timeout: 60_000,
        });
        await expect(panel.getByText(/Ningún servidor está marcado/)).toHaveCount(0);
    });
});

test.describe("SQLWorks - `scope: application` descarta el ajuste de un repositorio", () => {
    // La misma carpeta, pero esta vez su `.vscode/settings.json` intenta marcar el servidor.
    const folder = makeWorkspaceFolder("workspace", {
        "sqlworks.productionServers": PRODUCTION_SETTING,
    });

    const getContext = useSharedVsCodeLifecycle({
        launchOptions: {
            // Sin el ajuste en los de usuario: el único sitio donde está es la carpeta.
            initialConfig: BASE_CONFIG,
            workspaceFolder: folder,
        },
    });

    test("la marca de producción NO aparece, aunque el repositorio la pida", async () => {
        const { page } = getContext();
        await assertWorkspaceFolderIsOpen(page, folder);
        const panel = await openAdminPanel(page);

        // El panel siempre dice a qué atenerse; si no hay ningún servidor marcado, lo dice. Se
        // espera a ese texto en lugar de a la ausencia de la insignia, porque esperar una ausencia
        // pasaría también si el panel no hubiera llegado a cargar.
        await expect(panel.getByText(/Ningún servidor está marcado/)).toBeVisible({
            timeout: 60_000,
        });
        await expect(panel.getByText("PRODUCCIÓN", { exact: true })).toHaveCount(0);
    });
});

/**
 * La otra cara de la moneda: una clave **sin declarar** sí la puede poner un repositorio.
 *
 * §26.8 afirma que el apagado de la vista de despliegues de Data API Builder «no es decisión
 * nuestra», porque el upstream se dejó la clave sin declarar en su `contributes.configuration` y
 * cualquier `.vscode/settings.json` puede encenderla. Eso también era una creencia, y con la carpeta
 * ya disponible sale barato medirlo.
 *
 * Aquí se mide a la vez el control detectivo de la opción (d): si la clave se enciende desde el
 * repositorio, el fork tiene que **avisar**, nombrando el ámbito. Si este test se pusiera verde a
 * medias —clave encendida pero sin aviso— el control no serviría de nada.
 */
test.describe("SQLWorks - una clave sin declarar sí la enciende un repositorio, y el fork avisa", () => {
    const folder = makeWorkspaceFolder("dab", {
        // La clave de DAB que abre el camino de descarga. El upstream la lee, pero no la declara.
        "mssql.schemaDesigner.enableDeploymentsView": true,
    });

    const getContext = useSharedVsCodeLifecycle({
        launchOptions: { initialConfig: BASE_CONFIG, workspaceFolder: folder },
    });

    test("sale el aviso, y dice que viene del espacio de trabajo", async () => {
        const { page } = getContext();
        await assertWorkspaceFolderIsOpen(page, folder);

        // El aviso sale en la activación, sin tener que abrir nada del fork.
        const notification = page
            .locator(".notification-list-item-message, .notifications-toasts")
            .filter({ hasText: /SQLWorks:/ })
            .first();
        await notification.waitFor({ state: "visible", timeout: 120_000 });

        await expect(notification).toContainText("vista de despliegues");
        // Lo que hace útil el aviso: dónde está puesta. Si dijera «usuario», mandaría a la persona
        // al archivo equivocado.
        await expect(notification).toContainText("espacio de trabajo");
        await expect(notification).toContainText("mssql.schemaDesigner.enableDeploymentsView");
    });
});
