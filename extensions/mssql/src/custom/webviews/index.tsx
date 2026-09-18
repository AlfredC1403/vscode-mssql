/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import ReactDOM from "react-dom/client";

import { VscodeWebviewProvider } from "../../webviews/common/vscodeWebviewProvider";
import { useVscodeSelector } from "../../webviews/common/useVscodeSelector";
import { CustomWebviewKind, CustomWebviewStateBase } from "../sharedInterfaces/customWebview";
import { AdminPanelStateProvider } from "./AdminPanel/adminPanelStateProvider";
import { AdminPanelPage } from "./AdminPanel/adminPanelPage";
import { SnippetsStateProvider } from "./Snippets/snippetsStateProvider";
import { SnippetsPage } from "./Snippets/snippetsPage";
import { FormatStateProvider } from "./Format/formatStateProvider";
import { FormatPage } from "./Format/formatPage";
import "../../webviews/index.css";

/**
 * Router de todas las vistas del fork.
 *
 * Hay un solo entry point de esbuild (`sqlworks`) y esta función elige qué renderizar según el
 * campo `view` del estado que envía el host. Añadir un panel nuevo es añadir un `case` aquí, no
 * una línea en `scripts/bundle-webviews.js`.
 *
 * Mientras el estado no ha llegado por RPC, `view` es `undefined` y no se renderiza nada: el
 * `VscodeWebviewProvider` ya muestra su propio indicador de carga.
 */
const CustomWebviewRouter = () => {
    const view = useVscodeSelector<CustomWebviewStateBase, unknown, CustomWebviewKind | undefined>(
        (state) => state?.view,
    );

    switch (view) {
        case CustomWebviewKind.AdminPanel:
            return (
                <AdminPanelStateProvider>
                    <AdminPanelPage />
                </AdminPanelStateProvider>
            );
        case CustomWebviewKind.FormatProfiles:
            return (
                <FormatStateProvider>
                    <FormatPage />
                </FormatStateProvider>
            );
        case CustomWebviewKind.Snippets:
            return (
                <SnippetsStateProvider>
                    <SnippetsPage />
                </SnippetsStateProvider>
            );
        default:
            return undefined;
    }
};

ReactDOM.createRoot(document.getElementById("root")!).render(
    <VscodeWebviewProvider>
        <CustomWebviewRouter />
    </VscodeWebviewProvider>,
);
