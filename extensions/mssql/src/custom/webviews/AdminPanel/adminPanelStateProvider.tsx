/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { createContext, useMemo } from "react";

import { AdminPanelReducers, AdminPanelState } from "../../sharedInterfaces/adminPanel";
import { useVscodeWebview } from "../../../webviews/common/vscodeWebviewProvider";
import { getCoreRPCs } from "../../../webviews/common/utils";
import { CoreRPCs } from "../../../sharedInterfaces/webview";

export interface AdminPanelContextProps extends CoreRPCs {
    /** Pide al host que vuelva a leer el objetivo de la conexión. */
    refresh: () => void;
}

const AdminPanelContext = createContext<AdminPanelContextProps | undefined>(undefined);

/**
 * Expone al panel las acciones del host, por el mismo canal JSON-RPC que usa el upstream.
 * Mismo patrón que `src/webviews/pages/ConnectionGroup/connectionGroupStateProvider.tsx`.
 */
const AdminPanelStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { extensionRpc } = useVscodeWebview<AdminPanelState, AdminPanelReducers>();

    const commands = useMemo<AdminPanelContextProps>(
        () => ({
            ...getCoreRPCs(extensionRpc),
            refresh: () => extensionRpc.action("refresh", {}),
        }),
        [extensionRpc],
    );

    return <AdminPanelContext.Provider value={commands}>{children}</AdminPanelContext.Provider>;
};

export { AdminPanelContext, AdminPanelStateProvider };
