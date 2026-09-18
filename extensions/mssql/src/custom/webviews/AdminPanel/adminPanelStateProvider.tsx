/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { createContext, useMemo } from "react";

import {
    AdminPanelReducers,
    AdminPanelState,
    AdminSection,
    StageChangeRequest,
} from "../../sharedInterfaces/adminPanel";
import { useVscodeWebview } from "../../../webviews/common/vscodeWebviewProvider";
import { getCoreRPCs } from "../../../webviews/common/utils";
import { CoreRPCs } from "../../../sharedInterfaces/webview";

export interface AdminPanelContextProps extends CoreRPCs {
    /** Vuelve a leer el objetivo de la conexión y la sección visible. */
    refresh: () => void;
    /** Cambia de sección. El host la carga si aún no se leyó. */
    selectSection: (section: AdminSection) => void;
    /** Fuerza la relectura de una sección. */
    loadSection: (section: AdminSection) => void;
    /**
     * Pide terminar una sesión. El host comprueba permisos e identidad y **pide confirmación
     * mostrando la sentencia** antes de ejecutar: desde aquí no se ejecuta nada directamente.
     */
    killSession: (sessionId: number) => void;
    /**
     * Cambia la base que administran las secciones de base. **No cambia la conexión**: solo el
     * nombre con el que el host construye las consultas de catálogo.
     */
    selectDatabase: (database: string) => void;
    /** Monta un cambio en la lista de pendientes. **No ejecuta nada.** */
    stageChange: (request: StageChangeRequest) => void;
    unstageChange: (id: string) => void;
    clearChanges: () => void;
    buildPreview: () => void;
    /** Ejecuta el plan, identificado por su nonce. Desde aquí no se manda T-SQL. */
    applyChanges: (previewId: string) => void;
    copyScriptToEditor: () => void;
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
            selectSection: (section: AdminSection) =>
                extensionRpc.action("selectSection", { section }),
            loadSection: (section: AdminSection) => extensionRpc.action("loadSection", { section }),
            killSession: (sessionId: number) => extensionRpc.action("killSession", { sessionId }),
            selectDatabase: (database: string) =>
                extensionRpc.action("selectDatabase", { database }),
            stageChange: (request: StageChangeRequest) =>
                extensionRpc.action("stageChange", { request }),
            unstageChange: (id: string) => extensionRpc.action("unstageChange", { id }),
            clearChanges: () => extensionRpc.action("clearChanges", {}),
            buildPreview: () => extensionRpc.action("buildPreview", {}),
            applyChanges: (previewId: string) => extensionRpc.action("applyChanges", { previewId }),
            copyScriptToEditor: () => extensionRpc.action("copyScriptToEditor", {}),
        }),
        [extensionRpc],
    );

    return <AdminPanelContext.Provider value={commands}>{children}</AdminPanelContext.Provider>;
};

export { AdminPanelContext, AdminPanelStateProvider };
