/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Tipos compartidos entre el host de extensión y el webview del panel de administración.
 *
 * Esta carpeta se compila con los dos `tsconfig`, así que **no puede importar nada de `vscode`
 * ni del resto del host**. Solo tipos.
 */

import { CustomWebviewKind, CustomWebviewStateBase } from "./customWebview";

/** A qué está apuntando el panel: servidor, base de datos y cómo se conectó. */
export interface ConnectionTarget {
    /** Nombre del servidor, tal como está en el perfil de conexión. */
    server: string;
    /** Base de datos en cuyo contexto se abrió el panel. */
    database: string;
    /** Tipo de autenticación del perfil (`SqlLogin`, `Integrated`, `AzureMFA`…). */
    authenticationType: string;
    /** Nombre del perfil guardado, si tiene uno. */
    profileName?: string;
    /** Usuario, solo cuando la autenticación es SQL. */
    userName?: string;
    /** Versión completa del motor, de la información que devolvió la conexión. */
    serverVersion?: string;
    /** Edición del motor. */
    serverEdition?: string;
    /** Si la instancia es de nube (Azure SQL, Fabric). */
    isCloud?: boolean;
    /** Momento en que se leyeron estos datos, en ISO 8601. */
    readAt: string;
}

/** Estado del panel de administración. */
export interface AdminPanelState extends CustomWebviewStateBase {
    view: CustomWebviewKind.AdminPanel;
    /** Objetivo resuelto, o `undefined` mientras se está resolviendo. */
    target: ConnectionTarget | undefined;
    /** Mensaje de error si el objetivo no se pudo resolver. */
    errorMessage?: string;
}

/**
 * Acciones que el webview puede pedir al host.
 *
 * El nombre de cada clave es el nombre de la acción; el valor, su carga. Los hitos siguientes
 * añaden aquí las suyas.
 */
export interface AdminPanelReducers {
    /** Vuelve a leer el objetivo de la conexión activa. */
    refresh: Record<string, never>;
}
