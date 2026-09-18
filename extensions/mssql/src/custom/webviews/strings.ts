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
            users: "Usuarios",
            databaseRoles: "Roles",
            schemas: "Esquemas",
            databasePermissions: "Permisos",
        },
        /** Las pestañas van en dos grupos: lo que es de la instancia y lo que es de una base. */
        groups: {
            server: "Servidor",
            database: "Base de datos",
        },
        databaseSelector: {
            label: "Base de datos que se administra",
            loading: "Leyendo bases…",
            error: "No se pudieron leer las bases de datos.",
            /** Se marca así la base que no se puede abrir con este login. */
            noAccess: "sin acceso",
            system: "sistema",
            /** Aviso de que cambiar de base aquí no cambia la conexión del editor. */
            hint: "Cambia solo lo que muestra el panel. La conexión del editor de consultas no se toca.",
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
    users: {
        searchPlaceholder: "Buscar por usuario, login, esquema o rol…",
        empty: "La base de datos no tiene usuarios visibles para esta conexión.",
        columns: {
            name: "Usuario",
            type: "Tipo",
            loginName: "Login del servidor",
            defaultSchema: "Esquema por omisión",
            authentication: "Autenticación",
            roles: "Roles de base",
        },
        types: {
            SQL_USER: "Usuario SQL",
            WINDOWS_USER: "Usuario de Windows",
            WINDOWS_GROUP: "Grupo de Windows",
            EXTERNAL_USER: "Usuario externo",
            EXTERNAL_GROUP: "Grupo externo",
            ASYMMETRIC_KEY_USER: "Clave asimétrica",
            CERTIFICATE_USER: "Certificado",
            OTHER: "Otro",
        },
        authentication: {
            INSTANCE: "Login del servidor",
            DATABASE: "Contenida en la base",
            WINDOWS: "Windows",
            NONE: "Sin login",
        },
        /** Usuario sin login asignado: no puede iniciar sesión, solo existe dentro de la base. */
        noLogin: "—",
        systemUser: "sistema",
        legend: "Los usuarios del sistema (dbo, guest, sys, INFORMATION_SCHEMA) van marcados.",
    },
    databaseRoles: {
        searchPlaceholder: "Buscar por rol o miembro…",
        empty: "La base de datos no tiene roles visibles.",
        columns: {
            name: "Rol",
            kind: "Tipo",
            owner: "Propietario",
            memberCount: "Miembros",
            members: "Quiénes",
        },
        fixed: "Fijo",
        userDefined: "De usuario",
        /** `public`: existe en toda base de datos y no se puede borrar. */
        builtIn: "Predefinido",
        applicationRole: "De aplicación",
        /** Los roles de aplicación no tienen miembros: se activan con contraseña. */
        applicationRoleNote: "Se activa con contraseña, no tiene miembros",
        legend: "Un rol puede ser miembro de otro: la herencia se resuelve en la matriz de permisos.",
    },
    schemas: {
        searchPlaceholder: "Buscar por esquema o propietario…",
        empty: "La base de datos no tiene esquemas visibles.",
        columns: {
            name: "Esquema",
            owner: "Propietario",
            objectCount: "Objetos",
        },
        systemSchema: "sistema",
        legend: "Marcados los esquemas de SQL Server y los de los roles fijos.",
    },
    permissionMatrix: {
        principalLabel: "Principal",
        principalPlaceholder: "Elige un usuario o rol",
        userGroup: "Usuarios",
        roleGroup: "Roles",
        empty: "Este principal no tiene ningún permiso, ni propio ni heredado.",
        noPrincipal: "Elige un usuario o un rol para ver qué puede hacer y por qué.",
        columns: {
            permission: "Permiso",
            securable: "Sobre",
            state: "Estado",
            origin: "Cómo lo obtiene",
        },
        classes: {
            DATABASE: "La base de datos",
            OBJECT_OR_COLUMN: "Objeto",
            SCHEMA: "Esquema",
            DATABASE_PRINCIPAL: "Usuario o rol",
            TYPE: "Tipo",
            OTHER: "Otro objeto",
        },
        /** Origen del permiso: propio, o la cadena de roles por la que llega. */
        direct: "Propio",
        inherited: (chain: string) => `Hereda de ${chain}`,
        /** Une la cadena de roles: «supervisores, que hereda de lectores». */
        chainSeparator: ", que hereda de ",
        conflict: "En conflicto",
        conflictTooltip:
            "El mismo permiso llega concedido por un camino y denegado por otro. DENY gana.",
        counts: (total: number, inherited: number) =>
            `${total} permisos efectivos, ${inherited} heredados`,
        legend: "Resuelve la herencia por pertenencia a roles, incluida la de public. No resuelve la jerarquía de objetos: un DENY sobre una columna sale como fila aparte del GRANT sobre el esquema.",
    },
} as const;
