/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { createContext, useMemo } from "react";

import { SnippetsReducers, SnippetsState } from "../../sharedInterfaces/snippets";
import { useVscodeWebview } from "../../../webviews/common/vscodeWebviewProvider";
import { getCoreRPCs } from "../../../webviews/common/utils";
import { CoreRPCs } from "../../../sharedInterfaces/webview";

export interface SnippetsContextProps extends CoreRPCs {
    reload: () => void;
    /** Pide insertar. El host busca el cuerpo por id: desde aquí no se manda el texto. */
    insert: (id: string) => void;
    copy: (id: string) => void;
    save: (snippet: SnippetsReducers["save"]) => void;
    /** Borra. El host pide confirmación antes. */
    remove: (id: string) => void;
    duplicateToOwn: (id: string) => void;
    openLibraryFile: () => void;
}

export const SnippetsContext = createContext<SnippetsContextProps | undefined>(undefined);

/** Expone las acciones del host por el mismo canal JSON-RPC que el resto del fork. */
export const SnippetsStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { extensionRpc } = useVscodeWebview<SnippetsState, SnippetsReducers>();

    const commands = useMemo<SnippetsContextProps>(
        () => ({
            ...getCoreRPCs(extensionRpc),
            reload: () => extensionRpc.action("reload", {}),
            insert: (id: string) => extensionRpc.action("insert", { id }),
            copy: (id: string) => extensionRpc.action("copy", { id }),
            save: (snippet: SnippetsReducers["save"]) => extensionRpc.action("save", snippet),
            remove: (id: string) => extensionRpc.action("remove", { id }),
            duplicateToOwn: (id: string) => extensionRpc.action("duplicateToOwn", { id }),
            openLibraryFile: () => extensionRpc.action("openLibraryFile", {}),
        }),
        [extensionRpc],
    );

    return <SnippetsContext.Provider value={commands}>{children}</SnippetsContext.Provider>;
};
