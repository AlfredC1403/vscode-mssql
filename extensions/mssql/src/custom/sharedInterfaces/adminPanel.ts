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
import { ChangeSetResult, PendingChange, PreviewFacts, ProductionState } from "./pendingChanges";
import {
    ActiveSession,
    DatabaseChoice,
    DatabaseRole,
    DatabaseUser,
    InstanceProperties,
    KillPermissions,
    Login,
    PermissionMatrixData,
    SchemaInfo,
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
    /**
     * Identificador del perfil de conexión, que es su identidad estable: `AGENTS.md` del upstream
     * prohíbe comparar conexiones por propiedades de presentación.
     *
     * **Solo lo tienen los perfiles guardados**: el upstream lo asigna al guardar. Una conexión
     * escrita a mano no tiene, y por eso la marca de producción admite además patrones de nombre.
     */
    profileId?: string;
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

/**
 * Secciones del panel. El orden es el del brief: primero el servidor (§8.1 a §8.5) y después la
 * base de datos seleccionada (§8.3.1 a §8.3.3, más la matriz del §10).
 */
export enum AdminSection {
    /** Resumen de la conexión, lo que el panel mostraba en M2. */
    Overview = "overview",
    Logins = "logins",
    ServerRoles = "serverRoles",
    ServerPermissions = "serverPermissions",
    Instance = "instance",
    Sessions = "sessions",
    Users = "users",
    DatabaseRoles = "databaseRoles",
    Schemas = "schemas",
    DatabasePermissions = "databasePermissions",
}

/** Secciones que cargan datos del servidor. `Overview` no consulta nada. */
export const LOADABLE_SECTIONS = [
    AdminSection.Logins,
    AdminSection.ServerRoles,
    AdminSection.ServerPermissions,
    AdminSection.Instance,
    AdminSection.Sessions,
    AdminSection.Users,
    AdminSection.DatabaseRoles,
    AdminSection.Schemas,
    AdminSection.DatabasePermissions,
] as const;

/**
 * Secciones que dependen de la base de datos seleccionada: al cambiar de base hay que volver a
 * leerlas, y las del servidor no.
 */
export const DATABASE_SECTIONS = [
    AdminSection.Users,
    AdminSection.DatabaseRoles,
    AdminSection.Schemas,
    AdminSection.DatabasePermissions,
] as const;

/** `true` si la sección lee de la base seleccionada y no de la instancia. */
export function isDatabaseSection(section: AdminSection): boolean {
    return (DATABASE_SECTIONS as readonly AdminSection[]).includes(section);
}

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

    // --- Base de datos seleccionada (M4) ---
    /**
     * Base sobre la que trabajan las secciones de base de datos. Arranca en la de la conexión, y el
     * selector de la cabecera la cambia sin tocar la conexión: las consultas llegan al catálogo con
     * nombre de tres partes, nunca con `USE`.
     */
    selectedDatabase: string;
    /** Bases de la instancia, para el selector. */
    databases: SectionState<DatabaseChoice[]>;
    users: SectionState<DatabaseUser[]>;
    databaseRoles: SectionState<DatabaseRole[]>;
    schemas: SectionState<SchemaInfo[]>;
    databasePermissions: SectionState<PermissionMatrixData>;

    // --- Cambios pendientes (M5) ---
    /** Cambios montados y sin ejecutar, en el orden en que se montaron. */
    pendingChanges: PendingChange[];
    /**
     * Vista previa del plan, con su nonce. `undefined` mientras no se haya pedido, y se invalida en
     * cuanto la lista cambia: así el webview no puede ejecutar un plan que ya no corresponde.
     */
    preview?: PreviewFacts;
    /** Resultado de la última ejecución, para pintar el estado por cambio. */
    lastResult?: ChangeSetResult;
    /** Marca de producción del objetivo (regla 11.4 del brief). */
    productionState?: ProductionState;
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
    /**
     * Cambia la base de datos sobre la que trabajan las secciones de base. **No cambia la conexión**:
     * solo el nombre con el que se construyen las consultas de catálogo.
     */
    selectDatabase: { database: string };

    // --- Cambios pendientes (M5) ---
    /**
     * Monta un cambio en la lista de pendientes. **No ejecuta nada**: el webview manda los datos del
     * cambio y el host construye la sentencia con sus generadores, que validan y abortan.
     */
    stageChange: { request: StageChangeRequest };
    /** Quita un cambio de la lista. */
    unstageChange: { id: string };
    /** Vacía la lista. */
    clearChanges: Record<string, never>;
    /** Calcula la vista previa del plan y la publica con su nonce. */
    buildPreview: Record<string, never>;
    /**
     * Ejecuta el plan. El webview manda **solo el nonce**, nunca T-SQL: así lo que se ejecuta es, por
     * construcción, lo que se mostró (regla 11.1 del brief).
     */
    applyChanges: { previewId: string };
    /** Abre el script legible en un editor sin título, para revisarlo o guardarlo. */
    copyScriptToEditor: Record<string, never>;
}

/**
 * Lo que el webview manda para montar un cambio: **datos, no T-SQL**.
 *
 * Es una unión por `kind`, y el host la traduce con los generadores de `admin/sql/ddl/`, que son los
 * únicos que construyen sentencias.
 */
export type StageChangeRequest =
    | {
          kind: "serverPermission";
          action: "GRANT" | "GRANT_WITH_GRANT_OPTION" | "DENY" | "REVOKE";
          permission: string;
          principal: string;
          /** Estado que se leyó, para la precondición. */
          currentState: "G" | "D" | "W" | "NONE";
          grantable?: boolean;
      }
    | {
          kind: "databasePermission";
          action: "GRANT" | "GRANT_WITH_GRANT_OPTION" | "DENY" | "REVOKE";
          permission: string;
          principal: string;
          /** Clase tal como la muestra M4. Las que M5 no sabe expresar se rechazan con motivo. */
          securableClass: string;
          securable: string;
          columnName?: string;
          grantable?: boolean;
      }
    | {
          kind: "serverRoleMembership";
          action: "ADD" | "DROP";
          role: string;
          member: string;
      }
    | {
          kind: "databaseRoleMembership";
          action: "ADD" | "DROP";
          role: string;
          member: string;
      }
    | { kind: "loginEnabled"; login: string; enabled: boolean; createDate: string }
    | { kind: "userDefaultSchema"; user: string; schema: string; createDate: string }
    | { kind: "dropUser"; user: string; createDate: string }
    // --- M6: creación de principales. Ninguna lleva la contraseña: el host la pide al ejecutar. ---
    | {
          kind: "createLogin";
          login: string;
          checkPolicy: boolean;
          checkExpiration: boolean;
          mustChange: boolean;
          defaultDatabase?: string;
      }
    | { kind: "resetPassword"; login: string; mustChange: boolean; unlock: boolean }
    | { kind: "dropLogin"; login: string; createDate: string }
    | {
          kind: "createUser";
          user: string;
          /** Login al que se asigna. Vacío significa `WITHOUT LOGIN`. */
          login?: string;
          defaultSchema?: string;
      }
    | { kind: "createServerRole"; role: string; owner?: string }
    | { kind: "createDatabaseRole"; role: string; owner?: string }
    | { kind: "dropServerRole"; role: string }
    | { kind: "dropDatabaseRole"; role: string };

/** Clave del estado donde vive cada sección cargable. */
export const SECTION_STATE_KEYS = {
    [AdminSection.Logins]: "logins",
    [AdminSection.ServerRoles]: "serverRoles",
    [AdminSection.ServerPermissions]: "serverPermissions",
    [AdminSection.Instance]: "instance",
    [AdminSection.Sessions]: "sessions",
    [AdminSection.Users]: "users",
    [AdminSection.DatabaseRoles]: "databaseRoles",
    [AdminSection.Schemas]: "schemas",
    [AdminSection.DatabasePermissions]: "databasePermissions",
} as const satisfies Record<(typeof LOADABLE_SECTIONS)[number], keyof AdminPanelState>;
