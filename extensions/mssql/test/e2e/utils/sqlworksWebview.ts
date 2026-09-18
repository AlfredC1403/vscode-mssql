/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { FrameLocator, Locator, Page } from "@playwright/test";

/**
 * Localiza el webview del fork **por su contenido**, no por su posición.
 *
 * ## Por qué hace falta
 *
 * `getWebviewByTitle` de `testHelpers.ts` hace `frameLocator(".webview")` sin acotar, y eso solo
 * funciona mientras haya **un** webview abierto. Desde M7 hay dos a la vez: el panel de
 * administración en el área de editores y la vista de snippets en la barra lateral, así que ese
 * localizador pasó a ser ambiguo y los tests de administración empezaron a fallar con «resolved to
 * 2 elements».
 *
 * Acotar por la parte del área de trabajo (`.part.editor`, `.part.sidebar`) **no sirve**: VS Code
 * aloja todos los iframes de webview en un contenedor común del workbench, no dentro del DOM de la
 * parte que los muestra, precisamente para que un cambio de distribución no los destruya. Se
 * comprobó, y ahí ninguno de los dos aparece.
 *
 * Así que se identifican por lo que hay dentro, que es lo único estable: se recorren los webviews
 * abiertos y se devuelve el primero donde aparece el elemento que se busca.
 */

/** Cuánto se espera a que el webview cargue y pinte su contenido. */
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Devuelve el iframe interno del webview donde existe `probe`.
 *
 * @param probe Cómo reconocer el webview que se quiere, a partir de su iframe interno. Tiene que ser
 *   algo que **solo** esté en ese webview: el encabezado del panel, el buscador de la vista…
 */
export async function findSqlworksWebview(
    page: Page,
    probe: (frame: FrameLocator) => Locator,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<FrameLocator> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        // Se vuelve a contar en cada vuelta: un webview puede aparecer mientras se busca.
        const count = await page.locator(".webview").count();
        for (let index = 0; index < count; index += 1) {
            const inner = page.frameLocator(".webview").nth(index).frameLocator("iframe");
            // `count()` en lugar de `isVisible()`: no lanza si el iframe todavía no está listo.
            if ((await probe(inner).count()) > 0) {
                return inner;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(
        "Ningún webview abierto contiene el elemento buscado. ¿Se abrió el panel o la vista?",
    );
}
