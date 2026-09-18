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
import { findSqlworksWebview } from "./utils/sqlworksWebview";
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

    // No se usa `getWebviewByTitle`: busca `.webview` sin acotar, y desde M7 hay **dos** webviews
    // abiertos —este panel y la vista de snippets de la barra lateral—, así que dejó de ser único.
    // Se identifica por su contenido; el motivo largo está en `utils/sqlworksWebview.ts`.
    const panel = await findSqlworksWebview(page, (frame) =>
        frame.getByRole("heading", { name: "Administración" }),
    );
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
        // Se buscan como etiquetas de la ficha (`<dt>`), no con getByText: desde M4 «Servidor» y
        // «Base de datos» son además los nombres de los dos grupos de pestañas.
        await expect(panel.getByRole("term").filter({ hasText: "Servidor" }).first()).toBeVisible();
        await expect(
            panel.getByRole("term").filter({ hasText: "Base de datos" }).first(),
        ).toBeVisible();

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

        /**
         * Abre una pestaña y espera a que su contenido esté leído.
         *
         * Se busca dentro de su grupo porque los dos grupos tienen pestañas con el mismo nombre:
         * «Permisos» es de servidor y de base de datos.
         */
        const openTab = async (group: "Servidor" | "Base de datos", name: string) => {
            await panel
                .getByRole("tablist", { name: group })
                .getByRole("tab", { name, exact: true })
                .click();
            // La sección se lee al abrirla; mientras, la vista muestra el indicador de carga.
            await expect(panel.getByText("Leyendo del servidor…")).toBeHidden({ timeout: 90_000 });
        };

        // --- Logins (§8.1): el login sembrado, su tipo y su rol de servidor ---
        await openTab("Servidor", "Logins");
        // `exact` desde M5: la columna de acciones lleva un botón por fila, y el nombre accesible
        // de su celda («Deshabilitar el login parity_user») contiene el del login. Sin `exact` el
        // localizador encontraría dos celdas.
        await expect(panel.getByRole("gridcell", { name: "parity_user", exact: true })).toBeVisible(
            {
                timeout: 60_000,
            },
        );
        await expect(panel.getByRole("gridcell", { name: "Login SQL" }).first()).toBeVisible();
        // parity_user pertenece a dbcreator: se sembró así en §13.1.
        await expect(panel.getByRole("gridcell", { name: /dbcreator/ }).first()).toBeVisible();
        // sa existe siempre, y BUILTIN\Administrators es un grupo de Windows.
        await expect(panel.getByRole("gridcell", { name: "sa", exact: true })).toBeVisible();
        await expect(
            panel.getByRole("gridcell", { name: /Grupo de Windows/ }).first(),
        ).toBeVisible();

        // --- Roles de servidor (§8.2): roles fijos con sus miembros ---
        await openTab("Servidor", "Roles de servidor");
        // Aquí se mira la **fila**, no la celda: `sysadmin` lleva además la insignia de rol
        // peligroso, así que su celda no se llama exactamente «sysadmin»; y desde M5 cada miembro
        // es un botón cuya etiqueta («Quitar sa del rol sysadmin») también contiene el nombre.
        await expect(panel.getByRole("row").filter({ hasText: "sysadmin" }).first()).toBeVisible({
            timeout: 60_000,
        });
        await expect(panel.getByRole("row").filter({ hasText: "public" }).first()).toBeVisible();
        // Los roles internos ##MS_...## se filtran, como hace SSMS.
        await expect(panel.getByRole("gridcell", { name: /##MS_/ })).toHaveCount(0);

        // --- Permisos de servidor (§8.3) ---
        await openTab("Servidor", "Permisos");
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
        await openTab("Servidor", "Instancia");
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
        await openTab("Servidor", "Sesiones");
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
        await openTab("Servidor", "Logins");
        const search = panel.getByRole("textbox", { name: /Buscar por nombre/ });
        await search.fill("parity");
        await expect(
            panel.getByRole("gridcell", { name: "parity_user", exact: true }),
        ).toBeVisible();
        await expect(panel.getByRole("gridcell", { name: "sa", exact: true })).toHaveCount(0);

        // ------------------------------------------------------------------
        // M4: seguridad de la base de datos seleccionada, en solo lectura.
        // ------------------------------------------------------------------

        // El selector de bases arranca en la base de la conexión.
        const databasePicker = panel.getByRole("combobox", {
            name: "Base de datos que se administra",
        });
        // El `Dropdown` de Fluent es un botón con role combobox, no un input: se mira su texto.
        await expect(databasePicker).toContainText("ParityDb");

        // --- Usuarios (§8.3.1): el usuario con login, el usuario sin login y sus roles ---
        await openTab("Base de datos", "Usuarios");
        // `parity_user` sale dos veces en la misma fila: como usuario y como login del servidor,
        // que es justo lo que significa un usuario asignado a un login del mismo nombre.
        // `exact` desde M5: la columna de acciones añade «Borrar el usuario parity_user», que
        // también contiene el nombre; las dos celdas que interesan son la del usuario y la del login.
        await expect(
            panel.getByRole("gridcell", { name: "parity_user", exact: true }).first(),
        ).toBeVisible({
            timeout: 60_000,
        });
        await expect(panel.getByRole("gridcell", { name: "parity_user", exact: true })).toHaveCount(
            2,
        );
        // `analista` se creó WITHOUT LOGIN: sale sin login y con esquema por omisión `ventas`.
        await expect(panel.getByRole("gridcell", { name: "analista", exact: true })).toBeVisible();
        await expect(panel.getByRole("gridcell", { name: /ventas_supervisores/ })).toBeVisible();
        // Los cuatro usuarios que crea SQL Server van marcados.
        await expect(panel.getByRole("gridcell", { name: /dbo/ }).first()).toBeVisible();
        await expect(panel.getByRole("gridcell", { name: /sistema/ }).first()).toBeVisible();

        // --- Roles de base (§8.3.2): fijos, propios, y un rol miembro de otro ---
        await openTab("Base de datos", "Roles");
        // `exact` desde M5: «Quitar ventas_supervisores del rol ventas_lectores» contiene el nombre
        // del rol, igual que en los roles de servidor.
        await expect(
            panel.getByRole("gridcell", { name: "ventas_lectores", exact: true }),
        ).toBeVisible({
            timeout: 60_000,
        });
        await expect(panel.getByRole("gridcell", { name: "db_owner", exact: true })).toBeVisible();
        // ventas_supervisores es miembro de ventas_lectores: eso es lo que da la herencia.
        await expect(
            panel
                .getByRole("row")
                .filter({ hasText: "ventas_lectores" })
                .filter({ hasText: "ventas_supervisores" }),
        ).toBeVisible();

        // --- Esquemas (§8.3.3): propietario y número de objetos ---
        await openTab("Base de datos", "Esquemas");
        const ventasSchemaRow = panel.getByRole("row").filter({ hasText: "ventas" }).first();
        await expect(ventasSchemaRow).toBeVisible({ timeout: 60_000 });
        await expect(ventasSchemaRow.getByRole("gridcell", { name: "dbo" })).toBeVisible();
        await expect(panel.getByRole("gridcell", { name: /sys/ }).first()).toBeVisible();

        // --- Matriz de permisos (§10): lo propio, lo heredado y la cadena de roles ---
        await openTab("Base de datos", "Permisos");
        const principalPicker = panel.getByRole("combobox", { name: "Principal" });
        await expect(principalPicker).toBeVisible({ timeout: 60_000 });

        await principalPicker.click();
        await panel.getByRole("option", { name: "analista", exact: true }).click();

        // analista -> ventas_supervisores -> ventas_lectores: un salto y dos saltos.
        await expect(
            panel.getByRole("row").filter({ hasText: "INSERT" }).filter({ hasText: "ventas" }),
        ).toContainText("Hereda de ventas_supervisores");
        await expect(
            panel.getByRole("row").filter({ hasText: "SELECT" }).filter({ hasText: "ventas" }),
        ).toContainText("Hereda de ventas_supervisores, que hereda de ventas_lectores");
        // CONNECT es propio, no heredado.
        await expect(panel.getByRole("row").filter({ hasText: "CONNECT" }).first()).toContainText(
            "Propio",
        );

        // parity_user tiene un DENY propio a nivel de columna, y el SELECT heredado del esquema.
        await principalPicker.click();
        await panel.getByRole("option", { name: "parity_user", exact: true }).click();
        const denyRow = panel.getByRole("row").filter({ hasText: "ventas.Cliente" });
        await expect(denyRow).toContainText("Denegado");
        await expect(denyRow, "el DENY es sobre una columna").toContainText("Email");
        await expect(
            panel.getByRole("row").filter({ hasText: "SELECT" }).filter({ hasText: "Esquema" }),
        ).toContainText("Hereda de ventas_lectores");

        // --- Cambiar de base recarga las secciones de base, no las del servidor ---
        await openTab("Base de datos", "Esquemas");
        await expect(panel.getByRole("gridcell", { name: "ventas", exact: true })).toBeVisible();
        await databasePicker.click();
        await panel.getByRole("option", { name: "master", exact: true }).click();
        await expect(panel.getByText("Leyendo del servidor…")).toBeHidden({ timeout: 90_000 });
        // `ventas` es de ParityDb: en master no está.
        await expect(panel.getByRole("gridcell", { name: "ventas", exact: true })).toHaveCount(0);
        await expect(panel.getByRole("gridcell", { name: "dbo", exact: true })).toBeVisible();

        // ------------------------------------------------------------------
        // M5: montar cambios, verlos y **cancelar**. Este test no escribe nada en el servidor.
        // ------------------------------------------------------------------

        // Se vuelve a ParityDb: los cambios de ámbito de base se montan contra la base seleccionada.
        await databasePicker.click();
        await panel.getByRole("option", { name: "ParityDb", exact: true }).click();
        await expect(panel.getByText("Leyendo del servidor…")).toBeHidden({ timeout: 90_000 });

        // Regla 11.4: con el ajuste vacío el panel tiene que **decirlo**. Que nadie haya marcado
        // nada no puede parecer lo mismo que «este servidor no es de producción».
        await expect(
            panel.getByText(/Ningún servidor está marcado como de producción/),
        ).toBeVisible();
        // `exact` no es opcional aquí: sin él, `getByText` busca subcadena **sin distinguir
        // mayúsculas**, y el propio aviso de «…como de producción» encajaría con la insignia.
        await expect(panel.getByText("PRODUCCIÓN", { exact: true })).toHaveCount(0);

        // --- Un cambio de ámbito de servidor, desde la sección de permisos ---
        await openTab("Servidor", "Permisos");
        await panel.getByRole("button", { name: "Revocar CONNECT SQL a parity_user" }).click();
        await expect(panel.getByText("1 cambio pendiente")).toBeVisible();

        // --- Y uno de ámbito de base, desde otra sección: el cajón junta los dos ---
        await openTab("Base de datos", "Roles");
        await panel
            .getByRole("button", { name: "Quitar ventas_supervisores del rol ventas_lectores" })
            .click();
        await expect(panel.getByText("2 cambios pendientes")).toBeVisible();

        // El cajón se ve desde cualquier sección, que es para lo que está anclado al pie.
        await expect(panel.getByText(/REVOKE CONNECT SQL/)).toBeVisible();

        // --- La vista previa: el script legible y el texto exacto (regla 11.1) ---
        await panel.getByRole("button", { name: "Revisar y aplicar" }).click();

        const readableScript = panel.locator("pre").first();
        await expect(readableScript).toBeVisible();
        await expect(readableScript).toContainText("SET XACT_ABORT ON;");
        await expect(readableScript).toContainText("BEGIN TRANSACTION;");
        await expect(readableScript).toContainText("COMMIT TRANSACTION;");
        await expect(readableScript).toContainText("REVOKE CONNECT SQL");
        await expect(readableScript).toContainText("ALTER ROLE");
        // Las dos rutas: el permiso de servidor va por master, el cambio de rol por la base.
        await expect(readableScript).toContainText("USE [master];");
        await expect(readableScript).toContainText("USE [ParityDb];");

        // El texto **exacto** que se envía no es el legible: va envuelto en sp_executesql, y eso es
        // lo que el usuario tiene derecho a ver antes de que se ejecute.
        await panel
            .getByRole("button", { name: "Ver el texto exacto que se envía al servidor" })
            .click();
        const exactBatch = panel.locator("pre").nth(1);
        await expect(exactBatch).toContainText("SET XACT_ABORT ON;");
        await expect(exactBatch).toContainText("BEGIN TRANSACTION;");
        await expect(exactBatch).toContainText("EXEC [master].sys.sp_executesql");
        await expect(exactBatch).toContainText("EXEC [ParityDb].sys.sp_executesql");
        // La guarda de transacción heredada y el informe final forman parte del lote real.
        await expect(exactBatch).toContainText("IF @@TRANCOUNT > 0");
        await expect(exactBatch).toContainText("BEGIN CATCH");

        // Se vuelve a plegar: el conmutador es estado del componente y **persiste** entre vistas
        // previas, así que dejarlo abierto rompería el bloque de M6, que lo despliega otra vez.
        await panel.getByRole("button", { name: "Ocultar el texto exacto" }).click();
        await expect(panel.locator("pre")).toHaveCount(1);

        // --- El diálogo modal muestra el lote completo, y se cancela ---
        await panel.getByRole("button", { name: "Aplicar 2 cambios" }).click();
        const applyDialog = page.locator(".monaco-dialog-box");
        await expect(applyDialog).toBeVisible({ timeout: 30_000 });
        await expect(applyDialog).toContainText("¿Aplicar 2 cambios?");
        await expect(applyDialog).toContainText("REVOKE CONNECT SQL");
        await expect(applyDialog).toContainText("ALTER ROLE");
        await expect(applyDialog).toContainText(/se revierten todas/);
        await page.keyboard.press("Escape");
        await expect(applyDialog).toBeHidden();

        // --- Y el catálogo sigue como estaba: cancelar no escribe ---
        // Se vuelve a leer del servidor con el botón de actualizar, no se mira la copia en pantalla.
        await openTab("Servidor", "Permisos");
        await panel.getByRole("button", { name: "Volver a leer los datos de la conexión" }).click();
        await expect(panel.getByText("Leyendo del servidor…")).toBeHidden({ timeout: 90_000 });
        await expect(
            panel
                .getByRole("row")
                .filter({ hasText: "parity_user" })
                .filter({ hasText: "CONNECT SQL" }),
        ).toBeVisible();

        await openTab("Base de datos", "Roles");
        await panel.getByRole("button", { name: "Volver a leer los datos de la conexión" }).click();
        await expect(panel.getByText("Leyendo del servidor…")).toBeHidden({ timeout: 90_000 });
        await expect(
            panel
                .getByRole("row")
                .filter({ hasText: "ventas_lectores" })
                .filter({ hasText: "ventas_supervisores" }),
        ).toBeVisible();

        // --- Descartar deja el cajón vacío ---
        await panel.getByRole("button", { name: "Descartar todo" }).click();
        await expect(panel.getByText(/cambios? pendientes?/)).toHaveCount(0);

        // ------------------------------------------------------------------
        // M5, regla 11.5: lo destructivo pide **escribir el nombre** del objeto.
        // ------------------------------------------------------------------
        await openTab("Base de datos", "Usuarios");
        await panel.getByRole("button", { name: "Borrar el usuario analista" }).click();
        await expect(panel.getByText("1 cambio pendiente")).toBeVisible();

        await panel.getByRole("button", { name: "Revisar y aplicar" }).click();
        await expect(panel.locator("pre").first()).toContainText("DROP USER [analista]");
        // El cajón avisa de la caja de texto **en la vista previa**, antes del diálogo: el aviso
        // forma parte de lo que se revisa, no de lo que se ejecuta.
        await expect(
            panel.getByText(/Antes de ejecutar habrá que escribir «analista»/),
        ).toBeVisible();
        await panel.getByRole("button", { name: "Aplicar 1 cambio" }).click();

        const dropDialog = page.locator(".monaco-dialog-box");
        await expect(dropDialog).toBeVisible({ timeout: 30_000 });
        await expect(dropDialog).toContainText("DROP USER [analista]");
        // Se confirma el primer diálogo **a propósito**: lo que se comprueba es que detrás hay una
        // segunda barrera. Si no la hubiera, el usuario se borraría, y la última comprobación de
        // este bloque lo detectaría en lugar de dejarlo pasar.
        await dropDialog.getByRole("button", { name: "Aplicar 1 cambio" }).click();

        const typeBox = page.locator(".quick-input-widget");
        await expect(typeBox).toBeVisible({ timeout: 30_000 });
        await expect(typeBox).toContainText(/Escribe «analista» para confirmar/);
        // Escribir otra cosa no vale: la caja lo dice y no deja seguir.
        await page.keyboard.type("analist");
        await expect(typeBox).toContainText(/Tiene que coincidir exactamente con «analista»/);
        await page.keyboard.press("Escape");
        await expect(typeBox).toBeHidden();

        // El usuario sigue ahí: ni el diálogo confirmado ni la caja cancelada escribieron nada.
        await panel.getByRole("button", { name: "Volver a leer los datos de la conexión" }).click();
        await expect(panel.getByText("Leyendo del servidor…")).toBeHidden({ timeout: 90_000 });
        await expect(panel.getByRole("gridcell", { name: "analista", exact: true })).toBeVisible();

        await panel.getByRole("button", { name: "Descartar todo" }).click();

        // ------------------------------------------------------------------
        // M6, regla 11.3: crear un login. La contraseña **no se pide en el formulario** y el script
        // muestra un marcador de posición. Se cancela en la caja de la contraseña.
        // ------------------------------------------------------------------
        await openTab("Servidor", "Logins");
        await panel.getByRole("button", { name: "Nuevo" }).click();

        const createDialog = panel.getByRole("dialog");
        await expect(createDialog).toBeVisible();
        await expect(createDialog).toContainText("Crear un login de servidor");
        // Lo que hace falta comprobar: el formulario **dice** por qué no hay campo de contraseña.
        await expect(createDialog).toContainText(/La contraseña no se pide aquí/);
        // Y de verdad no hay ninguna caja de contraseña en el formulario.
        await expect(createDialog.locator('input[type="password"]')).toHaveCount(0);

        await createDialog.getByRole("textbox").first().fill("e2e_login_nuevo");
        await createDialog.getByRole("button", { name: "Añadir a los cambios pendientes" }).click();
        await expect(panel.getByText("1 cambio pendiente")).toBeVisible();

        await panel.getByRole("button", { name: "Revisar y aplicar" }).click();
        const createScript = panel.locator("pre").first();
        await expect(createScript).toContainText("CREATE LOGIN [e2e_login_nuevo]");
        // El script muestra el hueco, no la contraseña, y el panel lo dice en pantalla.
        await expect(createScript).toContainText("N'<contraseña>'");
        await expect(
            panel.getByText(/Donde dice «<contraseña>» irá la que escribas al aplicar/),
        ).toBeVisible();

        // El texto exacto que se envía también lleva el marcador de posición, no un valor.
        await panel
            .getByRole("button", { name: "Ver el texto exacto que se envía al servidor" })
            .click();
        const createExact = panel.locator("pre").nth(1);
        await expect(createExact).toContainText(
            "DECLARE @secreto1 nvarchar(128) = N'<contraseña>'",
        );
        // El escapado lo hace el motor, no el panel: por eso aparece QUOTENAME en el lote.
        await expect(createExact).toContainText("QUOTENAME(@secreto1, '''')");

        await panel.getByRole("button", { name: "Aplicar 1 cambio" }).click();
        const createConfirm = page.locator(".monaco-dialog-box");
        await expect(createConfirm).toBeVisible({ timeout: 30_000 });
        await expect(createConfirm).toContainText("CREATE LOGIN [e2e_login_nuevo]");
        // Se confirma a propósito, igual que antes: detrás tiene que estar la caja de la contraseña.
        await createConfirm.getByRole("button", { name: "Aplicar 1 cambio" }).click();

        const secretBox = page.locator(".quick-input-widget");
        await expect(secretBox).toBeVisible({ timeout: 30_000 });
        await expect(secretBox).toContainText(/Contraseña del login e2e_login_nuevo/);
        await expect(secretBox).toContainText(/No se guarda en ningún sitio/);
        // La caja oculta lo que se escribe: es una caja de contraseña de verdad.
        await expect(secretBox.locator('input[type="password"]')).toHaveCount(1);
        await page.keyboard.press("Escape");
        await expect(secretBox).toBeHidden();

        // Y el login NO se creó: cancelar en la caja de la contraseña no ejecuta nada.
        await panel.getByRole("button", { name: "Volver a leer los datos de la conexión" }).click();
        await expect(panel.getByText("Leyendo del servidor…")).toBeHidden({ timeout: 90_000 });
        await expect(
            panel.getByRole("gridcell", { name: "e2e_login_nuevo", exact: true }),
        ).toHaveCount(0);

        await panel.getByRole("button", { name: "Descartar todo" }).click();
    });
});

/**
 * Regla 11.4 del brief: un servidor marcado como de producción se ve, y exige una barrera más.
 *
 * Va en su propio `describe` porque la marca es un ajuste de usuario (`scope: "application"`) y cada
 * `describe` levanta su propio VS Code con su propio `settings.json`. Aquí también se **cancela**.
 */
test.describe("SQLWorks - Panel de administración contra un servidor de producción", () => {
    const getContext = useSharedVsCodeLifecycle({
        launchOptions: {
            initialConfig: {
                ...INITIAL_CONFIG,
                // Se marca por patrón, que es el caso de una conexión sin perfil guardado: el id
                // solo existe cuando el perfil se ha guardado, y aquí se escribe a mano.
                "sqlworks.productionServers": { serverPatterns: ["*"] },
            },
        },
    });

    test("marca el servidor y exige escribir su nombre incluso para un cambio reversible", async () => {
        const { page } = getContext();
        const panel = await openAdminPanel(page);

        // La insignia es visible desde que se abre, sin tener que montar ningún cambio.
        await expect(panel.getByText("PRODUCCIÓN", { exact: true }).first()).toBeVisible({
            timeout: 60_000,
        });
        await expect(panel.getByText(/Ningún servidor está marcado/)).toHaveCount(0);

        await panel
            .getByRole("tablist", { name: "Servidor" })
            .getByRole("tab", { name: "Permisos", exact: true })
            .click();
        await expect(panel.getByText("Leyendo del servidor…")).toBeHidden({ timeout: 90_000 });

        await panel.getByRole("button", { name: "Revocar CONNECT SQL a parity_user" }).click();
        await expect(panel.getByText("1 cambio pendiente")).toBeVisible();

        await panel.getByRole("button", { name: "Revisar y aplicar" }).click();
        // La vista previa avisa de que habrá que escribir el nombre **del servidor**, no de un
        // objeto: en producción la barrera se aplica también a un cambio que no borra nada.
        // El nombre sale del `.env` y puede llevar `\` o `.`, así que se escapa antes de meterlo
        // en una expresión regular.
        const escapedServer = getServerName().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        await expect(
            panel.getByText(new RegExp(`Antes de ejecutar habrá que escribir «${escapedServer}»`)),
        ).toBeVisible();

        await panel.getByRole("button", { name: "Aplicar 1 cambio" }).click();

        const dialog = page.locator(".monaco-dialog-box");
        await expect(dialog).toBeVisible({ timeout: 30_000 });
        await expect(dialog).toContainText("este servidor está marcado como de producción");
        await expect(dialog).toContainText("REVOKE CONNECT SQL");
        // Se cancela en el primer diálogo: este test no escribe nada.
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();

        await panel.getByRole("button", { name: "Descartar todo" }).click();
    });
});
