/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Tipos del dominio de administración, según el §9 del brief.
 *
 * Este archivo no importa nada: son tipos puros, y se compila tanto para el host como para los
 * webviews porque el panel los muestra tal cual.
 */

/** Tipo de un login del servidor. */
export type LoginKind = "SQL_LOGIN" | "WINDOWS_LOGIN" | "WINDOWS_GROUP";

/** Un login del servidor. */
export interface Login {
    name: string;
    sid: string;
    type: LoginKind;
    defaultDatabase: string;
    disabled: boolean;
    /** `CHECK_POLICY`. Solo tiene sentido en logins SQL. */
    passwordPolicy: boolean;
    /** `CHECK_EXPIRATION`. Solo tiene sentido en logins SQL. */
    passwordExpiration: boolean;
    createDate: string;
    /** Roles de servidor a los que pertenece, resueltos aparte y unidos en el mapeo. */
    serverRoles: string[];
}

/** Un rol de servidor, fijo o definido por el usuario. */
export interface ServerRole {
    name: string;
    /** `true` para los roles fijos de SQL Server (`sysadmin`, `securityadmin`…). */
    fixed: boolean;
    /** Principal propietario del rol. Vacío en los fijos. */
    owner: string;
    members: string[];
}

/** Estado de un permiso, tal como lo informa `sys.server_permissions`. */
export type PermissionGrantState = "GRANT" | "DENY" | "GRANT_WITH_GRANT_OPTION" | "REVOKE";

/**
 * Clase del objeto sobre el que se concede un permiso de servidor.
 *
 * `SERVER` es la instancia entera; `ENDPOINT` un punto de conexión (`CONNECT` a `TSQL Default TCP`
 * y compañía, que es lo que `public` tiene concedido de fábrica); `SERVER_PRINCIPAL` otro login o
 * rol, que es el caso de `IMPERSONATE`.
 */
export type ServerSecurableClass = "SERVER" | "ENDPOINT" | "SERVER_PRINCIPAL" | "OTHER";

/** Un permiso explícito a nivel de servidor. */
export interface ServerPermission {
    grantee: string;
    permission: string;
    state: PermissionGrantState;
    /** Texto del estado tal como lo devuelve el motor, para mostrarlo sin traducir de más. */
    stateDescription: string;
    securableClass: ServerSecurableClass;
    /**
     * Nombre del objeto concreto dentro de esa clase. Vacío cuando la clase es `SERVER`, porque
     * entonces el objeto es la propia instancia.
     */
    securable: string;
}

/** Propiedades de la instancia, en solo lectura (§8.4 del brief). */
export interface InstanceProperties {
    serverName: string;
    machineName: string;
    instanceName: string;
    productVersion: string;
    productLevel: string;
    edition: string;
    engineEdition: string;
    collation: string;
    /** Modo de autenticación: «Windows» o «Windows y SQL Server». */
    authenticationMode: string;
    isClustered: boolean;
    isHadrEnabled: boolean;
    defaultDataPath: string;
    defaultLogPath: string;
    backupPath: string;
    errorLogPath: string;
    /** `max server memory` configurada, en MB. 0 o 2147483647 significa «sin límite». */
    maxServerMemoryMb: number;
    minServerMemoryMb: number;
    /** Memoria física de la máquina, en MB. */
    physicalMemoryMb: number;
    cpuCount: number;
    /** Momento de arranque del servicio, en ISO 8601. */
    startTime: string;
}

/** Una sesión activa (§8.5 del brief). */
export interface ActiveSession {
    sessionId: number;
    loginName: string;
    hostName: string;
    programName: string;
    status: string;
    databaseName: string;
    loginTime: string;
    lastRequestStartTime: string;
    /** Última sentencia que ejecutó, recortada por la consulta. */
    lastStatement: string;
    /** `true` si es la propia sesión del panel. */
    isCurrentSession: boolean;
    cpuTimeMs: number;
    logicalReads: number;
    openTransactionCount: number;
    /**
     * Momento en que empezó la **más antigua** de sus transacciones abiertas, en ISO 8601. Vacío
     * cuando no tiene ninguna.
     *
     * Una sesión puede tener varias transacciones abiertas a la vez (anidadas o en varias bases),
     * y la que bloquea a los demás es siempre la que lleva más tiempo abierta.
     */
    oldestTransactionStart: string;
    /** Segundos que lleva abierta esa transacción. 0 cuando no hay ninguna. */
    longestOpenTransactionSeconds: number;
}

/**
 * Permisos de la conexión actual para terminar sesiones ajenas.
 *
 * `KILL` exige `ALTER ANY CONNECTION`, que traen los roles fijos `sysadmin` y `processadmin`. Se
 * leen los tres por separado para poder decir **por qué** se puede o no se puede, en lugar de un
 * «no tienes permiso» a secas.
 */
export interface KillPermissions {
    /** `@@SPID` de la conexión del panel: nunca se puede terminar a sí misma. */
    currentSessionId: number;
    loginName: string;
    isSysadmin: boolean;
    isProcessAdmin: boolean;
    hasAlterAnyConnection: boolean;
}

/**
 * Identidad de una sesión, para comprobar justo antes de terminarla que sigue siendo la misma.
 *
 * **SQL Server reutiliza los identificadores de sesión de inmediato.** Comprobado: al terminar la
 * sesión 54, la conexión siguiente del propio sondeo recibió el 54. Si el panel lleva un rato
 * abierto, el número de la fila puede pertenecer ya a otra conexión, así que antes de ejecutar
 * `KILL` se vuelve a leer la sesión y se compara su identidad con la que el usuario confirmó.
 */
export interface SessionSnapshot {
    sessionId: number;
    loginName: string;
    hostName: string;
    programName: string;
    /** Momento de inicio de sesión, en ISO 8601. Es lo que mejor distingue una reutilización. */
    loginTime: string;
}
