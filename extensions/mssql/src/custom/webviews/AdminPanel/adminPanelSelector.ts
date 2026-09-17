/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { AdminPanelReducers, AdminPanelState } from "../../sharedInterfaces/adminPanel";
import { useVscodeSelector } from "../../../webviews/common/useVscodeSelector";

/**
 * Selector del estado del panel. `useVscodeSelector` es lo que manda AGENTS.md para el estado
 * compartido de los webviews: solo re-renderiza cuando cambia el trozo seleccionado.
 */
export function useAdminPanelSelector<T>(
    selector: (state: AdminPanelState) => T,
    equals?: (a: T, b: T) => boolean,
) {
    return useVscodeSelector<AdminPanelState, AdminPanelReducers, T>(selector, equals);
}
