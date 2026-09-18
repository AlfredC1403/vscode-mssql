/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { createContext, useMemo } from "react";

import { FormatProfilesReducers, FormatProfilesState } from "../../sharedInterfaces/formatProfiles";
import { useVscodeWebview } from "../../../webviews/common/vscodeWebviewProvider";
import { getCoreRPCs } from "../../../webviews/common/utils";
import { CoreRPCs } from "../../../sharedInterfaces/webview";

export interface FormatContextProps extends CoreRPCs {
    setOption: (name: string, value: boolean | string | number) => void;
    selectProfile: (name: string) => void;
    /** Escribe el borrador en los ajustes del upstream. Nada se aplica hasta aquí. */
    apply: (scope: "user" | "workspace") => void;
    saveProfile: (name: string) => void;
    deleteProfile: (name: string) => void;
    revert: () => void;
    resetToDefaults: () => void;
    setSample: (sql: string) => void;
    refreshPreview: () => void;
}

export const FormatContext = createContext<FormatContextProps | undefined>(undefined);

export const FormatStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { extensionRpc } = useVscodeWebview<FormatProfilesState, FormatProfilesReducers>();

    const commands = useMemo<FormatContextProps>(
        () => ({
            ...getCoreRPCs(extensionRpc),
            setOption: (name, value) => extensionRpc.action("setOption", { name, value }),
            selectProfile: (name: string) => extensionRpc.action("selectProfile", { name }),
            apply: (scope) => extensionRpc.action("apply", { scope }),
            saveProfile: (name: string) => extensionRpc.action("saveProfile", { name }),
            deleteProfile: (name: string) => extensionRpc.action("deleteProfile", { name }),
            revert: () => extensionRpc.action("revert", {}),
            resetToDefaults: () => extensionRpc.action("resetToDefaults", {}),
            setSample: (sql: string) => extensionRpc.action("setSample", { sql }),
            refreshPreview: () => extensionRpc.action("refreshPreview", {}),
        }),
        [extensionRpc],
    );

    return <FormatContext.Provider value={commands}>{children}</FormatContext.Provider>;
};
