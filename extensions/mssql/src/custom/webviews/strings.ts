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
    /** Cajón de cambios pendientes y marca de producción (M5). */
    pendingChanges: {
        title: (count: number) =>
            count === 1 ? "1 cambio pendiente" : `${count} cambios pendientes`,
        review: "Revisar y aplicar",
        apply: (count: number) => (count === 1 ? "Aplicar 1 cambio" : `Aplicar ${count} cambios`),
        openInEditor: "Abrir en un editor",
        discardAll: "Descartar todo",
        discardOne: "Quitar este cambio",
        discardOneAria: (subject: string) => `Quitar el cambio de ${subject}`,
        showExact: "Ver el texto exacto que se envía al servidor",
        hideExact: "Ocultar el texto exacto",
        willAskToType: (name: string) =>
            `Antes de ejecutar habrá que escribir «${name}» para confirmar.`,
        lastFailed:
            "El último intento no se aplicó: la transacción se revirtió y el servidor quedó como estaba. Revisa el motivo y vuelve a intentarlo.",
        stale: "Se aplicó, pero la relectura falló: lo que ves puede no ser lo que hay en el servidor.",
        statuses: {
            pending: "Sin ejecutar",
            applied: "Aplicado",
            rolledBack: "No se aplicó: la transacción se revirtió entera",
            failed: "Es el que falló",
            unknown: "No se sabe si quedó aplicado",
        } as Record<string, string>,
    },
    production: {
        badge: "PRODUCCIÓN",
        matchedProfile: "Este perfil de conexión está en la lista de servidores de producción.",
        matchedPattern: (pattern: string) =>
            `El nombre del servidor encaja con el patrón «${pattern}» de la lista de servidores de producción.`,
        notConfigured:
            "Ningún servidor está marcado como de producción: el ajuste sqlworks.productionServers está vacío.",
        settingKey:
            "Configúralo en sqlworks.productionServers, en los ajustes de usuario. El panel marcará esos servidores y exigirá escribir el nombre antes de cualquier cambio.",
    },
    /** Acciones de escritura que ofrecen las rejillas (M5). */
    rowActions: {
        revoke: "Revocar",
        revokeAria: (what: string) => `Revocar ${what}`,
        deny: "Denegar",
        denyAria: (what: string) => `Denegar ${what}`,
        enable: "Habilitar",
        disable: "Deshabilitar",
        toggleAria: (login: string, enable: boolean) =>
            enable ? `Habilitar el login ${login}` : `Deshabilitar el login ${login}`,
        dropUser: "Borrar",
        dropUserWarning:
            "Pedirá escribir el nombre del usuario antes de ejecutar: es una operación destructiva.",
        dropUserAria: (user: string) => `Borrar el usuario ${user}`,
        removeMember: "Quitar",
        removeMemberAria: (member: string, role: string) => `Quitar ${member} del rol ${role}`,
        /** Por qué una fila no ofrece acción. */
        systemObject: "Los objetos que crea SQL Server no se cambian desde el panel.",
        /** Deshabilitar sa o una cuenta de servicio deja la instancia sin poder conectarse. */
        protectedLogin:
            "Este login lo necesita SQL Server o la propia extensión para conectarse: el panel no lo deshabilita.",
        inheritedOnly:
            "Este permiso es heredado de un rol: se puede denegar aquí, pero para quitarlo hay que quitarlo del rol.",
        notSupported: "Este tipo de permiso se puede ver, pero todavía no se puede cambiar.",
        /** Revocar un permiso concedible exige CASCADE, y eso no se decide en una casilla. */
        grantableNeedsCascade:
            "Está concedido con opción de conceder: revocarlo exige CASCADE, que también revocaría lo que ese principal haya concedido a otros. No se hace desde el panel.",
        staged: "Ya está en la lista de cambios pendientes.",
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
