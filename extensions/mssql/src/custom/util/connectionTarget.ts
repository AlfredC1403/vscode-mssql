/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import ConnectionManager from "../../controllers/connectionManager";
import { ObjectExplorerUtils } from "../../objectExplorer/objectExplorerUtils";
import { TreeNodeInfo } from "../../objectExplorer/nodes/treeNodeInfo";
import { ConnectionTarget } from "../sharedInterfaces/adminPanel";
import { Strings } from "../strings";

/**
 * Resultado de resolver un nodo del árbol a un objetivo de administración.
 *
 * Campos opcionales en vez de una unión discriminada a propósito: el repositorio compila con
 * `strict: false` (ver `extensions/tsconfig.base.json`), y sin `strictNullChecks` TypeScript no
 * estrecha una unión por un discriminante booleano. `errorMessage` presente significa fallo.
 */
export interface ResolveResult {
    /** El objetivo, cuando se pudo resolver. */
    target?: ConnectionTarget;
    /** URI con la que el SQL Tools Service conoce esta conexión. */
    connectionUri?: string;
    /** Motivo del fallo, en español y listo para mostrar. */
    errorMessage?: string;
}

/**
 * Traduce un nodo del explorador de objetos al servidor y la base de datos sobre los que va a
 * trabajar un panel, reutilizando la conexión que la extensión ya tiene abierta.
 *
 * Deliberadamente **no abre ninguna conexión propia** (regla 16.2 del brief): si el perfil no está
 * conectado, devuelve un error y el usuario conecta desde el árbol como haría siempre.
 */
export function resolveConnectionTarget(
    node: TreeNodeInfo | undefined,
    connectionManager: ConnectionManager,
): ResolveResult {
    if (!node) {
        return { errorMessage: Strings.adminPanel.noTargetNode };
    }

    const profile = node.connectionProfile;
    if (!profile) {
        return { errorMessage: Strings.adminPanel.noConnectionProfile };
    }

    // La URI de conexión es la identidad con la que el SQL Tools Service conoce esta sesión.
    // Es lo que usarán los hitos siguientes para hablar con él (ver FORK.md §4.1).
    const connectionUri = connectionManager.getUriForConnection(profile);
    if (!connectionUri || !connectionManager.isConnected(connectionUri)) {
        return { errorMessage: Strings.adminPanel.notConnected(profile.server) };
    }

    // getServerInfo devuelve lo que el motor informó al establecer la conexión, así que no hay
    // que ejecutar T-SQL para esto. El T-SQL llega en M3 y vive en src/custom/admin/sql/.
    const serverInfo = connectionManager.getServerInfo(profile);

    return {
        connectionUri,
        target: {
            server: profile.server,
            // ObjectExplorerUtils resuelve la base subiendo por los padres del nodo, así que
            // funciona igual para un nodo de servidor que para uno colgado de una base. Para un
            // nodo de servidor devuelve la base del perfil, que puede venir vacía: en ese caso la
            // conexión usa la predeterminada del login, y el panel lo dice en lugar de callarse.
            database:
                ObjectExplorerUtils.getDatabaseName(node) || Strings.adminPanel.defaultDatabase,
            authenticationType: profile.authenticationType,
            profileName: profile.profileName || undefined,
            userName: profile.user || undefined,
            serverVersion: serverInfo?.serverVersion,
            serverEdition: serverInfo?.serverEdition,
            isCloud: serverInfo?.isCloud,
            readAt: new Date().toISOString(),
        },
    };
}
