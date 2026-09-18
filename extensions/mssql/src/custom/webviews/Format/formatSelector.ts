/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { FormatProfilesReducers, FormatProfilesState } from "../../sharedInterfaces/formatProfiles";
import { useVscodeSelector } from "../../../webviews/common/useVscodeSelector";

/** Selector del estado del panel de formato. Mismo patrón que el resto del fork. */
export function useFormatSelector<T>(
    selector: (state: FormatProfilesState) => T,
    equals?: (a: T, b: T) => boolean,
) {
    return useVscodeSelector<FormatProfilesState, FormatProfilesReducers, T>(selector, equals);
}
