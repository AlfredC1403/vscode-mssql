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
 * Comprobación de M2 y M3 en un solo recorrido:
 *
 * - **M2**: el panel de administración abre desde el explorador de objetos y sabe a qué servidor y
 *   base de datos apunta, reutilizando la conexión activa de la extensión.
 * - **M3**: sus cinco secciones de seguridad del servidor leen datos reales de la instancia, y el
 *   botón de terminar sesión pide confirmación mostrando la sentencia. El test **cancela**: no
 *   termina ninguna sesión. Ver FORK.md §20.6.
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
    // Los diálogos modales de VS Code son ventanas nativas del sistema salvo con esta opción, y una
    // ventana nativa no está en el DOM, así que Playwright no puede leerla. Con «custom» el diálogo
    // se pinta dentro del workbench y el test puede comprobar que muestra la sentencia.
    "window.dialogStyle": "custom",
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

/** Conecta, abre el panel desde el menú contextual del árbol y devuelve su webview. */
async function openAdminPanel(page: Page) {
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
    const panel = await getWebviewByTitle(page, `Administración · ${getServerName()}`);
    await expect(panel.getByRole("heading", { name: "Administración" })).toBeVisible({
        timeout: 60_000,
    });
    return panel;
}

test.describe("SQLWorks - Panel de administración", () => {
    const getContext = useSharedVsCodeLifecycle({
        launchOptions: { initialConfig: INITIAL_CONFIG },
    });

    test("abre desde el árbol y lee las cinco secciones de seguridad del servidor", async () => {
        const { page } = getContext();
        const server = getServerName();

        const panel = await openAdminPanel(page);
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

        // ------------------------------------------------------------------
        // M3: las cinco secciones de seguridad del servidor, en solo lectura.
        // Van en el mismo test porque el panel se abre una vez: con el ciclo de vida compartido,
        // abrir un segundo panel deja dos iframes `.webview` y el localizador deja de ser único.
        // ------------------------------------------------------------------

        /** Abre una pestaña y espera a que su contenido esté leído. */
        const openTab = async (name: string) => {
            await panel.getByRole("tab", { name }).click();
            // La sección se lee al abrirla; mientras, la vista muestra el indicador de carga.
            await expect(panel.getByText("Leyendo del servidor…")).toBeHidden({ timeout: 90_000 });
        };

        // --- Logins (§8.1): el login sembrado, su tipo y su rol de servidor ---
        await openTab("Logins");
        await expect(panel.getByRole("gridcell", { name: "parity_user" })).toBeVisible({
            timeout: 60_000,
        });
        await expect(panel.getByRole("gridcell", { name: "Login SQL" }).first()).toBeVisible();
        // parity_user pertenece a dbcreator: se sembró así en §13.1.
        await expect(panel.getByRole("gridcell", { name: /dbcreator/ }).first()).toBeVisible();
        // sa existe siempre, y BUILTIN\Administrators es un grupo de Windows.
        await expect(panel.getByRole("gridcell", { name: "sa", exact: true })).toBeVisible();
        await expect(
            panel.getByRole("gridcell", { name: /Grupo de Windows/ }).first(),
        ).toBeVisible();

        // --- Roles de servidor (§8.2): roles fijos con sus miembros ---
        await openTab("Roles de servidor");
        await expect(panel.getByRole("gridcell", { name: "sysadmin" })).toBeVisible({
            timeout: 60_000,
        });
        await expect(panel.getByRole("gridcell", { name: "public" })).toBeVisible();
        // Los roles internos ##MS_...## se filtran, como hace SSMS.
        await expect(panel.getByRole("gridcell", { name: /##MS_/ })).toHaveCount(0);

        // --- Permisos de servidor (§8.3) ---
        await openTab("Permisos");
        await expect(panel.getByRole("gridcell", { name: "CONNECT SQL" }).first()).toBeVisible({
            timeout: 60_000,
        });
        await expect(panel.getByRole("gridcell", { name: "Concedido" }).first()).toBeVisible();
        // El objeto sobre el que cae el permiso: `public` tiene CONNECT sobre los puntos de
        // conexión de fábrica, y sin esta columna esas filas serían indistinguibles.
        await expect(
            panel.getByRole("gridcell", { name: /Punto de conexión: TSQL/ }).first(),
        ).toBeVisible();

        // --- Propiedades de la instancia (§8.4) ---
        await openTab("Instancia");
        await expect(panel.getByText("Collation", { exact: true })).toBeVisible({
            timeout: 60_000,
        });
        await expect(
            panel.getByRole("definition").filter({ hasText: "SQL_Latin1_General_CP1_CI_AS" }),
        ).toBeVisible();
        await expect(
            panel.getByRole("definition").filter({ hasText: "Developer Edition (64-bit)" }),
        ).toBeVisible();
        // Modo mixto: el contenedor de pruebas acepta autenticación SQL.
        await expect(panel.getByRole("definition").filter({ hasText: /modo mixto/ })).toBeVisible();
        await expect(panel.getByText("Rutas", { exact: true })).toBeVisible();

        // --- Sesiones activas (§8.5) ---
        await openTab("Sesiones");
        // La propia sesión del panel tiene que aparecer marcada.
        await expect(panel.getByText("Esta sesión").first()).toBeVisible({ timeout: 60_000 });
        await expect(panel.getByRole("gridcell", { name: /ParityDb/ }).first()).toBeVisible();
        // Columna del tiempo que lleva abierta la transacción más antigua de cada sesión.
        await expect(
            panel.getByRole("columnheader", { name: "Transacción abierta" }),
        ).toBeVisible();

        // El botón de terminar: deshabilitado en la sesión del propio panel, y habilitado en las
        // demás porque el perfil e2e conecta como sa, que es sysadmin.
        const ownRow = panel.getByRole("row").filter({ hasText: "Esta sesión" }).first();
        await expect(ownRow.getByRole("button", { name: /Terminar la sesión/ })).toBeDisabled();

        const otherKillButtons = panel
            .getByRole("row")
            .filter({ hasNot: panel.getByText("Esta sesión") })
            .getByRole("button", { name: /Terminar la sesión/ });
        const enabledKill = otherKillButtons.first();
        await expect(enabledKill).toBeEnabled();

        // La confirmación tiene que mostrar la sentencia exacta antes de ejecutar nada (§11.1 del
        // brief). Se cancela: este test no termina ninguna sesión.
        await enabledKill.click();
        const dialog = page.locator(".monaco-dialog-box");
        await expect(dialog).toBeVisible({ timeout: 30_000 });
        await expect(dialog).toContainText(/¿Terminar la sesión \d+\?/);
        await expect(dialog).toContainText(/KILL \d+;/);
        await expect(dialog).toContainText("irreversible");
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();

        // --- El buscador de la rejilla filtra ---
        await openTab("Logins");
        const search = panel.getByRole("textbox", { name: /Buscar por nombre/ });
        await search.fill("parity");
        await expect(panel.getByRole("gridcell", { name: "parity_user" })).toBeVisible();
        await expect(panel.getByRole("gridcell", { name: "sa", exact: true })).toHaveCount(0);
    });
});
