/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { FrameLocator, Page, expect } from "@playwright/test";

import { test } from "./baseFixtures";
import { useSharedVsCodeLifecycle } from "./utils/testLifecycle";
import { findSqlworksWebview } from "./utils/sqlworksWebview";
import { DEFAULT_USER_CONFIG } from "./utils/launchVscodeWithMsSqlExt";

/**
 * Biblioteca de snippets (M7).
 *
 * Lo que este test resuelve y no se puede resolver leyendo código: **si insertar desde la barra
 * lateral llega al editor**. Para pulsar el botón hay que quitar el foco del editor, y
 * `window.activeTextEditor` es «el activo o, si ninguno tiene el foco, el que cambió más
 * recientemente». `SnippetInserter` no se fía y recuerda el último editor de SQL; esto comprueba
 * que el diseño funciona de punta a punta.
 *
 * **No necesita servidor**: la vista de snippets no consulta nada. Por eso va en su propio archivo
 * y no en `sqlworksAdminPanel.spec.ts`, que sí exige una instancia alcanzable.
 */
test.setTimeout(300_000);

const INITIAL_CONFIG = {
    ...DEFAULT_USER_CONFIG,
    // Los modales de VS Code son ventanas nativas salvo con esta opción, y una ventana nativa no
    // está en el DOM. La confirmación de borrado es un modal.
    "window.dialogStyle": "custom",
};

/** Abre la vista de snippets desde la paleta de comandos y devuelve su iframe. */
async function openSnippetsView(page: Page): Promise<FrameLocator> {
    await page.keyboard.press("Control+Shift+P");
    const palette = page.locator(".quick-input-widget");
    await expect(palette).toBeVisible({ timeout: 30_000 });
    await page.keyboard.type("Mostrar la biblioteca de snippets");
    await page.keyboard.press("Enter");

    // Se identifica por su buscador, que solo está en esta vista. Ver `utils/sqlworksWebview.ts`.
    const view = await findSqlworksWebview(page, (frame) =>
        frame.getByPlaceholder(/Buscar por nombre, prefijo o contenido/),
    );
    await expect(view.getByPlaceholder(/Buscar por nombre, prefijo o contenido/)).toBeVisible({
        timeout: 60_000,
    });
    return view;
}

test.describe("SQLWorks - Biblioteca de snippets", () => {
    const getContext = useSharedVsCodeLifecycle({
        launchOptions: { initialConfig: INITIAL_CONFIG },
    });

    test("crea un snippet propio y lo inserta en un editor de SQL", async () => {
        const { page } = getContext();

        const view = await openSnippetsView(page);

        // --- Los de la extensión se ven, en solo lectura ---
        // La vista es el único sitio donde buscar un snippet: los 18 de `snippets/mssql.json`
        // salen aquí además de en la autocompletación.
        await expect(view.getByText("De la extensión (solo lectura)")).toBeVisible({
            timeout: 30_000,
        });
        // `.first()`: el nombre sale en el título de la tarjeta y otra vez dentro del cuerpo.
        await expect(view.getByText("Create a new Table").first()).toBeVisible();

        // Sin editor de SQL abierto, el aviso lo dice en lugar de dejar el botón gris sin motivo.
        await expect(view.getByText(/No hay ningún editor de SQL abierto/).first()).toBeVisible();

        // --- Crear uno propio ---
        await view.getByRole("button", { name: "Crear un snippet" }).click();
        const dialog = view.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText("Nuevo snippet");

        await dialog.getByRole("textbox").first().fill("Bloqueos de prueba");
        // El prefijo con espacios se rechaza: el editor filtra por la palabra anterior al cursor.
        const prefixBox = dialog.getByRole("textbox").nth(1);
        await prefixBox.fill("dos palabras");
        await expect(dialog).toContainText(/El prefijo no puede llevar espacios/);
        await expect(dialog.getByRole("button", { name: "Guardar" })).toBeDisabled();
        await prefixBox.fill("e2ebloqueos");

        await dialog
            .getByRole("textbox")
            .nth(2)
            .fill("SELECT ${1:columnas} FROM sys.dm_tran_locks;");
        await dialog.getByRole("button", { name: "Guardar" }).click();

        // Aparece en su grupo, delante de los de la extensión.
        await expect(view.getByText("Mis snippets", { exact: true })).toBeVisible({
            timeout: 30_000,
        });
        await expect(view.getByText("Bloqueos de prueba").first()).toBeVisible();

        // --- Un editor de SQL, y la inserción ---
        // Se usa el comando «New Query» de la extensión: abre un editor sin título con lenguaje SQL
        // en un solo paso. Montarlo a mano (archivo nuevo + cambiar el lenguaje) son tres diálogos
        // encadenados y es frágil.
        await page.keyboard.press("Control+Shift+P");
        await expect(page.locator(".quick-input-widget")).toBeVisible({ timeout: 30_000 });
        await page.keyboard.type("MS SQL: New Query");
        await page.keyboard.press("Enter");
        // Sin conexión, el comando puede pedir una. El editor ya está abierto, así que se cierra el
        // diálogo: lo que este test necesita es el editor, no la conexión.
        await page.waitForTimeout(3000);
        await page.keyboard.press("Escape");
        // El editor de SQL existe: la barra de estado del upstream muestra el estado de conexión.
        await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 30_000 });

        // Con un editor de SQL delante, el aviso desaparece.
        const viewAgain = await openSnippetsView(page);
        await expect(viewAgain.getByText(/No hay ningún editor de SQL abierto/)).toHaveCount(0, {
            timeout: 30_000,
        });

        // Se inserta pulsando en la barra lateral, que es justo el caso que quita el foco al
        // editor. El botón se localiza por su nombre accesible, que lleva el del snippet.
        await viewAgain
            .getByRole("button", { name: "Insertar «Bloqueos de prueba» en el editor" })
            .click();

        // Y el texto llega al editor. Es la comprobación que justifica todo el diseño de
        // `SnippetInserter`: si `activeTextEditor` no valiera, esto fallaría.
        const editor = page.locator(".monaco-editor").first();
        await expect(editor).toContainText("sys.dm_tran_locks", { timeout: 30_000 });

        // --- Borrar pide confirmación, y se cancela ---
        const viewFinal = await openSnippetsView(page);
        await viewFinal.getByRole("button", { name: "Borrar «Bloqueos de prueba»" }).click();
        const confirm = page.locator(".monaco-dialog-box");
        await expect(confirm).toBeVisible({ timeout: 30_000 });
        await expect(confirm).toContainText("¿Borrar el snippet «Bloqueos de prueba»?");
        await page.keyboard.press("Escape");
        await expect(confirm).toBeHidden();
        // Sigue estando: cancelar no borra.
        await expect(viewFinal.getByText("Bloqueos de prueba").first()).toBeVisible();
    });
});
