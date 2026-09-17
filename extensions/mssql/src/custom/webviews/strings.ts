/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Textos de los webviews del fork.
 *
 * Constantes planas y no `l10n.t()`, por lo mismo que en `src/custom/strings.ts`: la interfaz
 * nueva es solo en español. Los textos del upstream siguen su propia tubería y no se tocan.
 */
export const WebviewStrings = {
    common: {
        loading: "Leyendo del servidor…",
        unknownError: "No se pudo leer del servidor.",
        searchPlaceholder: "Buscar…",
        noMatches: "Ningún elemento coincide con la búsqueda.",
        empty: "No hay nada que mostrar.",
        count: (total: number) => (total === 1 ? "1 elemento" : `${total} elementos`),
        countFiltered: (shown: number, total: number) => `${shown} de ${total} elementos`,
        yes: "Sí",
        no: "No",
        none: "Ninguno",
        unknown: "Desconocido",
    },
    adminPanel: {
        title: "Administración",
        subtitleEmpty: "Sin conexión resuelta",
        refresh: "Actualizar",
        refreshAriaLabel: "Volver a leer los datos de la conexión",
        sectionsAriaLabel: "Secciones de administración",
        sections: {
            connection: "Conexión",
            instance: "Instancia",
        },
        tabs: {
            overview: "Resumen",
            logins: "Logins",
            serverRoles: "Roles de servidor",
            serverPermissions: "Permisos",
            instance: "Instancia",
            sessions: "Sesiones",
        },
        fields: {
            server: "Servidor",
            database: "Base de datos",
            authentication: "Autenticación",
            profile: "Perfil",
            user: "Usuario",
            version: "Versión del motor",
            edition: "Edición",
            hosting: "Alojamiento",
        },
        hosting: {
            cloud: "Nube",
            onPremises: "Local",
        },
        readAt: (moment: string) => `Leído a las ${moment}`,
        overviewNote:
            "Este resumen sale de los datos que devolvió la conexión, sin consultar nada. Las demás secciones leen del servidor al abrirlas.",
    },
    logins: {
        searchPlaceholder: "Buscar por nombre, tipo o rol…",
        empty: "El servidor no tiene logins visibles para esta conexión.",
        columns: {
            name: "Nombre",
            type: "Tipo",
            status: "Estado",
            defaultDatabase: "Base predeterminada",
            policy: "Política",
            roles: "Roles de servidor",
            created: "Creado",
        },
        kinds: {
            SQL_LOGIN: "Login SQL",
            WINDOWS_LOGIN: "Login de Windows",
            WINDOWS_GROUP: "Grupo de Windows",
        },
        enabled: "Habilitado",
        disabled: "Deshabilitado",
        policyChecked: "Política",
        expirationChecked: "Caducidad",
        policyNotApplicable: "No aplica",
        legend: "La política de contraseñas solo aplica a logins SQL.",
    },
    serverRoles: {
        searchPlaceholder: "Buscar por nombre o miembro…",
        empty: "No hay roles de servidor visibles.",
        columns: {
            name: "Nombre",
            kind: "Tipo",
            owner: "Propietario",
            memberCount: "Miembros",
            members: "Quiénes",
        },
        fixed: "Fijo",
        userDefined: "De usuario",
        legend: "Los roles fijos los crea SQL Server y no se pueden eliminar.",
        dangerous: "Concede control total del servidor.",
    },
    serverPermissions: {
        searchPlaceholder: "Buscar por principal o permiso…",
        empty: "No hay permisos explícitos a nivel de servidor.",
        columns: {
            grantee: "Principal",
            permission: "Permiso",
            securable: "Sobre",
            state: "Estado",
        },
        states: {
            GRANT: "Concedido",
            DENY: "Denegado",
            GRANT_WITH_GRANT_OPTION: "Concedido con opción de conceder",
            REVOKE: "Revocado",
        },
        /** Clase del objeto sobre el que cae el permiso. */
        securableClasses: {
            SERVER: "La instancia",
            ENDPOINT: "Punto de conexión",
            SERVER_PRINCIPAL: "Login o rol",
            OTHER: "Otro objeto",
        },
        legend: "Solo permisos explícitos: lo heredado de un rol no aparece aquí.",
    },
    instance: {
        sections: {
            identity: "Identidad",
            version: "Versión",
            security: "Seguridad",
            paths: "Rutas",
            resources: "Recursos",
        },
        fields: {
            serverName: "Nombre del servidor",
            machineName: "Equipo",
            instanceName: "Instancia",
            productVersion: "Versión del producto",
            productLevel: "Nivel",
            edition: "Edición",
            engineEdition: "Edición del motor",
            collation: "Collation",
            authenticationMode: "Modo de autenticación",
            clustered: "En clúster",
            hadr: "Grupos de disponibilidad",
            dataPath: "Datos",
            logPath: "Log",
            backupPath: "Copias de seguridad",
            errorLogPath: "Registro de errores",
            maxMemory: "Memoria máxima",
            minMemory: "Memoria mínima",
            physicalMemory: "Memoria física",
            cpuCount: "CPU",
            startTime: "Arranque",
        },
        defaultInstance: "Instancia predeterminada",
        unlimitedMemory: "Sin límite",
        megabytes: (value: number) => `${value.toLocaleString()} MB`,
        cores: (value: number) => (value === 1 ? "1 procesador" : `${value} procesadores`),
        runtimeUnavailable:
            "No se pudieron leer CPU, memoria física ni fecha de arranque. Requieren el permiso VIEW SERVER STATE.",
    },
    sessions: {
        searchPlaceholder: "Buscar por login, equipo, aplicación o base…",
        empty: "No hay sesiones de usuario activas.",
        columns: {
            sessionId: "Sesión",
            loginName: "Login",
            hostName: "Equipo",
            programName: "Aplicación",
            status: "Estado",
            databaseName: "Base de datos",
            cpu: "CPU",
            reads: "Lecturas",
            transactions: "Trans.",
            openTransactionAge: "Transacción abierta",
            lastRequest: "Última petición",
            lastStatement: "Última sentencia",
            actions: "Acción",
        },
        currentSession: "Esta sesión",
        noStatement: "Sin sentencia registrada",
        missingViewServerState:
            "Solo se ve esta sesión. SQL Server oculta las demás cuando el login no tiene el permiso VIEW SERVER STATE, sin dar error.",
        legend: "Ordenado por transacción abierta más antigua. CPU en milisegundos.",
        /** Antigüedad de la transacción más vieja de la sesión, con su explicación. */
        openTransactionTooltip: (since: string) => `Abierta desde ${since}`,
        noOpenTransaction: "—",
        kill: "Terminar",
        killAria: (sessionId: number) => `Terminar la sesión ${sessionId}`,
        /** Por qué el botón está deshabilitado. Sale en el tooltip, no en un aviso aparte. */
        killDisabledOwn: "No se puede terminar la sesión que usa este panel.",
        killDisabledPermission:
            "Hace falta ALTER ANY CONNECTION, o pertenecer a sysadmin o processadmin, para terminar sesiones.",
        killDisabledUnknown: "Todavía no se sabe si esta conexión puede terminar sesiones.",
        /** De dónde sale el permiso, para que se vea con qué autoridad se actúa. */
        killAllowedBySysadmin: "Permitido: eres sysadmin.",
        killAllowedByProcessAdmin: "Permitido: eres processadmin.",
        killAllowedByPermission: "Permitido: tienes ALTER ANY CONNECTION.",
        killWarning: "Pide confirmación y muestra la sentencia antes de ejecutar nada.",
    },
} as const;
