/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { Page, expect } from "@playwright/test";

import { test } from "./baseFixtures";
import { useSharedVsCodeLifecycle } from "./utils/testLifecycle";
import { getWebviewByTitle } from "./utils/testHelpers";
import { DEFAULT_USER_CONFIG } from "./utils/launchVscodeWithMsSqlExt";
import { getPassword, getServerName, getUserName } from "./utils/envConfigReader";

/**
 * Comprobación del hito M2: el panel de administración abre desde el explorador de objetos y
 * sabe a qué servidor y base de datos apunta, reutilizando la conexión activa de la extensión.
 *
 * Requiere `test/e2e/.env` apuntando a una instancia alcanzable, igual que el resto de la suite.
 * FORK.md §13.1 explica cómo levantar una con Docker.
 */
const CONNECT_TIMEOUT_MS = 180_000;
const PROFILE_NAME = "sqlworks-e2e";

test.setTimeout(900_000);

/**
 * El perfil se precarga en `settings.json` en lugar de rellenar el diálogo de conexión.
 *
 * Dos razones. La primera es que así el test comprueba lo que de verdad interesa —que el panel
 * abre desde el árbol— sin depender de la interfaz del diálogo. La segunda es que el diálogo del
 * upstream se queda colgado en «Connecting…» cuando el primer intento falla por el certificado
 * autofirmado y se reintenta: la conexión se establece (el servidor devuelve su información) pero
 * la interfaz nunca se entera. Ver FORK.md §17.3.
 */
const INITIAL_CONFIG = {
    ...DEFAULT_USER_CONFIG,
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

/** Espera a que el nodo del servidor aparezca en el árbol y lo conecta. */
async function connectServerNode(page: Page) {
    const node = page.locator(`[role="treeitem"][aria-label^="${PROFILE_NAME}"]`).first();
    await node.waitFor({ state: "visible", timeout: 60_000 });
    await node.click();
    await page.keyboard.press("ArrowRight");

    // Hay que esperar a que el **propio nodo** quede expandido, no a que aparezca una carpeta
    // concreta: cuando el perfil fija una base de datos, la conexión queda acotada a ella y el
    // árbol muestra sus objetos en lugar de una carpeta «Databases». Y el nodo solo se expande
    // cuando la conexión está viva, que es la condición que necesita el panel.
    const deadline = Date.now() + CONNECT_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if ((await node.getAttribute("aria-expanded")) === "true") {
            // El árbol vuelve a renderizarse justo después de expandir; sin este margen el clic
            // derecho puede caer sobre un elemento que ya no es el mismo.
            await new Promise((resolve) => setTimeout(resolve, 3000));
            return node;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`El nodo "${PROFILE_NAME}" no llegó a conectarse y expandirse.`);
}

test.describe("SQLWorks - Panel de administración", () => {
    const getContext = useSharedVsCodeLifecycle({
        launchOptions: { initialConfig: INITIAL_CONFIG },
    });

    test("abre desde el explorador de objetos y muestra servidor y base de datos", async () => {
        const { page } = getContext();
        const server = getServerName();

        const serverNode = await connectServerNode(page);
        await serverNode.click({ button: "right" });

        const menuItem = page
            .locator('.monaco-menu [role="menuitem"], .context-view [role="menuitem"]')
            .filter({ hasText: /Administraci/ })
            .first();
        await menuItem.waitFor({ state: "visible", timeout: 30_000 });
        // Los menús de VS Code no siempre confirman con un clic de ratón sintético: se enfoca el
        // elemento pasando el cursor y se confirma con Enter.
        await menuItem.hover();
        await page.keyboard.press("Enter");

        // El título del panel lo pone AdminPanelController a partir del nombre del servidor.
        const panel = await getWebviewByTitle(page, `Administración · ${server}`);

        // Cabecera del panel, y las filas de servidor y base de datos.
        await expect(panel.getByRole("heading", { name: "Administración" })).toBeVisible({
            timeout: 60_000,
        });
        await expect(panel.getByText("Servidor", { exact: true })).toBeVisible();
        await expect(panel.getByText("Base de datos", { exact: true })).toBeVisible();

        // Los valores se comprueban en su fila (`<dd>`), no con getByText a secas: el servidor y
        // la base también salen en la línea de contexto de la cabecera, y habría dos coincidencias.
        await expect(panel.getByRole("definition").filter({ hasText: server })).toBeVisible();
        await expect(panel.getByRole("definition").filter({ hasText: "ParityDb" })).toBeVisible();

        // La línea de contexto de la cabecera también los lleva.
        await expect(panel.getByRole("banner").getByText("ParityDb")).toBeVisible();

        // El botón de actualizar es un elemento real con su etiqueta accesible (§14 del brief).
        await expect(
            panel.getByRole("button", { name: "Volver a leer los datos de la conexión" }),
        ).toBeVisible();
    });
});
