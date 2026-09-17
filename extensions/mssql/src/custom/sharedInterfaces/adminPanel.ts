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
import {
    ActiveSession,
    InstanceProperties,
    KillPermissions,
    Login,
    ServerPermission,
    ServerRole,
} from "../admin/sql/types";

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

/** Secciones del panel. El orden es el del brief: §8.1 a §8.5. */
export enum AdminSection {
    /** Resumen de la conexión, lo que el panel mostraba en M2. */
    Overview = "overview",
    Logins = "logins",
    ServerRoles = "serverRoles",
    ServerPermissions = "serverPermissions",
    Instance = "instance",
    Sessions = "sessions",
}

/** Secciones que cargan datos del servidor. `Overview` no consulta nada. */
export const LOADABLE_SECTIONS = [
    AdminSection.Logins,
    AdminSection.ServerRoles,
    AdminSection.ServerPermissions,
    AdminSection.Instance,
    AdminSection.Sessions,
] as const;

/** Estado de carga de una sección. */
export type SectionStatus = "idle" | "loading" | "loaded" | "error";

/**
 * Datos de una sección, con su estado.
 *
 * Cada sección se carga por separado, así que un permiso que falta solo afecta a la suya. Ver
 * `ServerSecurityService`.
 */
export interface SectionState<T> {
    status: SectionStatus;
    data?: T;
    /** Motivo por el que no se pudo leer, listo para mostrar. */
    errorMessage?: string;
    /** Cuándo se leyó, en ISO 8601. */
    readAt?: string;
}

/**
 * Qué puede hacer la conexión actual con las sesiones.
 *
 * Se publican los hechos, no el texto: el webview arma el mensaje con sus propios textos, igual que
 * el resto de la interfaz. `undefined` en el estado significa «todavía no se ha comprobado», que no
 * es lo mismo que «no se puede».
 */
export interface SessionCapabilities extends KillPermissions {
    /** `true` si alguno de los tres permisos anteriores alcanza para `KILL`. */
    canKill: boolean;
}

/** Estado del panel de administración. */
export interface AdminPanelState extends CustomWebviewStateBase {
    view: CustomWebviewKind.AdminPanel;
    /** Objetivo resuelto, o `undefined` mientras se está resolviendo. */
    target: ConnectionTarget | undefined;
    /** Mensaje de error si el objetivo no se pudo resolver. */
    errorMessage?: string;
    /** Sección visible. */
    activeSection: AdminSection;
    logins: SectionState<Login[]>;
    serverRoles: SectionState<ServerRole[]>;
    serverPermissions: SectionState<ServerPermission[]>;
    instance: SectionState<InstanceProperties>;
    sessions: SectionState<ActiveSession[]>;
    /** Permisos sobre sesiones, leídos junto con la sección de sesiones. */
    sessionCapabilities?: SessionCapabilities;
}

/**
 * Acciones que el webview puede pedir al host.
 *
 * El nombre de cada clave es el nombre de la acción; el valor, su carga.
 */
export interface AdminPanelReducers {
    /** Vuelve a leer el objetivo de la conexión y la sección visible. */
    refresh: Record<string, never>;
    /** Cambia de sección, y la carga si aún no se leyó. */
    selectSection: { section: AdminSection };
    /** Fuerza la relectura de una sección. */
    loadSection: { section: AdminSection };
    /**
     * Pide terminar una sesión. El host comprueba permisos, que no sea la propia y que el
     * identificador siga siendo de la misma sesión, y **pide confirmación mostrando la sentencia**
     * antes de ejecutar nada.
     */
    killSession: { sessionId: number };
}

/** Clave del estado donde vive cada sección cargable. */
export const SECTION_STATE_KEYS = {
    [AdminSection.Logins]: "logins",
    [AdminSection.ServerRoles]: "serverRoles",
    [AdminSection.ServerPermissions]: "serverPermissions",
    [AdminSection.Instance]: "instance",
    [AdminSection.Sessions]: "sessions",
} as const satisfies Record<(typeof LOADABLE_SECTIONS)[number], keyof AdminPanelState>;
