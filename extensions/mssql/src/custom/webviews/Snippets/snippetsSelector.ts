/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SnippetsReducers, SnippetsState } from "../../sharedInterfaces/snippets";
import { useVscodeSelector } from "../../../webviews/common/useVscodeSelector";

/**
 * Selector del estado de la vista de snippets. Mismo patrón que `useAdminPanelSelector`: es lo que
 * manda AGENTS.md para el estado compartido de los webviews, y solo re-renderiza cuando cambia el
 * trozo seleccionado.
 */
export function useSnippetsSelector<T>(
    selector: (state: SnippetsState) => T,
    equals?: (a: T, b: T) => boolean,
) {
    return useVscodeSelector<SnippetsState, SnippetsReducers, T>(selector, equals);
}
