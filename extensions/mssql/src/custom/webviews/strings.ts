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
        cancel: "Cancelar",
    },

    /** Diálogos de creación de principales (M6). */
    create: {
        /** El botón no dice «Crear»: nada se crea hasta aplicar el conjunto de cambios. */
        stage: "Añadir a los cambios pendientes",
        newButton: "Nuevo",
        invalidName:
            "Ese nombre no vale para SQL Server: tiene que empezar por letra o guion bajo, sin espacios al principio ni al final y sin dos guiones seguidos.",
        mustChangeNeeds:
            "Obligar a cambiar la contraseña exige también la política y la caducidad: SQL Server rechaza la combinación.",
        ownerLabel: "Propietario",
        ownerHint: "Quién puede modificar el rol. Si se deja vacío, lo será quien lo cree.",
        ownerDefault: "Quien lo cree",
        login: {
            title: "Crear un login de servidor",
            nameLabel: "Nombre del login",
            namePlaceholder: "ventas_app",
            defaultDatabaseLabel: "Base de datos por omisión",
            defaultDatabaseHint:
                "A la que entra al conectarse si no pide otra. No le da permiso sobre ella.",
            defaultDatabaseDefault: "La del servidor (master)",
            checkPolicy: "Aplicar la política de contraseñas del sistema",
            checkExpiration: "Aplicar la caducidad de la contraseña",
            mustChange: "Obligar a cambiarla en el primer inicio de sesión",
            /** Donde el usuario busca el campo de contraseña, se explica por qué no está. */
            passwordLater:
                "La contraseña no se pide aquí: se pedirá al aplicar los cambios, y no se guarda en los ajustes ni aparece en el script.",
        },
        user: {
            title: "Crear un usuario de base de datos",
            nameLabel: "Nombre del usuario",
            namePlaceholder: "ventas_app",
            loginLabel: "Login del servidor",
            loginHint:
                "El login con el que se conectará. Sin login, el usuario sirve para permisos y pertenencias pero no puede conectarse.",
            withoutLogin: "Sin login",
            schemaLabel: "Esquema por omisión",
            schemaDefault: "dbo",
        },
        serverRole: {
            title: "Crear un rol de servidor",
            nameLabel: "Nombre del rol",
            namePlaceholder: "operadores_copia",
        },
        databaseRole: {
            title: "Crear un rol de base de datos",
            nameLabel: "Nombre del rol",
            namePlaceholder: "ventas_editores",
        },
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
            /** Columna de acciones de M6, separada de la de habilitar/deshabilitar de M3. */
            manage: "Administrar",
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
        /**
         * Aviso de la regla 11.3: el script muestra un hueco donde va la contraseña, y hay que
         * decirlo. Callarlo sería mostrar un texto que no es exactamente el que se envía.
         */
        secretsInPlan: (count: number) =>
            count === 1
                ? "Donde dice «<contraseña>» irá la que escribas al aplicar. Es lo único que este texto no muestra tal cual, y no se guarda en ningún sitio."
                : `Donde dice «<contraseña>» irán las que escribas al aplicar (${count}). Es lo único que este texto no muestra tal cual, y no se guardan en ningún sitio.`,
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
        /** M6. */
        resetPassword: "Contraseña",
        resetPasswordAria: (login: string) => `Restablecer la contraseña del login ${login}`,
        /** Un login de Windows tiene la contraseña en el dominio, no en SQL Server. */
        windowsLoginPassword:
            "Este login es de Windows: su contraseña está en el dominio y no se cambia desde SQL Server.",
        dropLoginAria: (login: string) => `Borrar el login ${login}`,
        dropLoginWarning:
            "Pedirá escribir el nombre antes de ejecutar. Borrar un login NO borra los usuarios de base que lo tenían asignado: se quedan huérfanos.",
        dropRoleAria: (role: string) => `Borrar el rol ${role}`,
        dropRoleWarning:
            "Pedirá escribir el nombre antes de ejecutar. Si el rol tiene miembros, quítalos en el mismo conjunto de cambios: SQL Server no borra un rol con miembros.",
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

    /** Biblioteca de snippets (M7). */
    snippets: {
        searchPlaceholder: "Buscar por nombre, prefijo o contenido…",
        empty: "Tu biblioteca está vacía. Pulsa «+» para crear un snippet, o duplica uno de los que trae la extensión.",
        newSnippet: "Crear un snippet",
        openFile: "Abrir el archivo de la biblioteca",
        insert: "Insertar",
        insertAria: (name: string) => `Insertar «${name}» en el editor`,
        copy: "Copiar al portapapeles",
        copyAria: (name: string) => `Copiar «${name}» al portapapeles`,
        edit: "Editar",
        editAria: (name: string) => `Editar «${name}»`,
        remove: "Borrar",
        removeAria: (name: string) => `Borrar «${name}»`,
        duplicate: "Duplicar en mi biblioteca",
        duplicateAria: (name: string) => `Duplicar «${name}» en mi biblioteca`,
        /** Se dice por qué el botón de insertar está desactivado, en lugar de dejarlo gris sin más. */
        noEditorHint:
            "No hay ningún editor de SQL abierto. Abre un archivo .sql para poder insertar; copiar al portapapeles funciona igual.",
        libraryAt: (path: string) => `Tu biblioteca: ${path}`,
        groups: {
            own: "Mis snippets",
            ownWithCategory: (category: string) => `Mis snippets · ${category}`,
            shared: (library: string) => `Compartidos · ${library}`,
            builtin: "De la extensión (solo lectura)",
        },
        editor: {
            newTitle: "Nuevo snippet",
            editTitle: "Editar el snippet",
            nameLabel: "Nombre",
            namePlaceholder: "Bloqueos actuales",
            prefixLabel: "Prefijo",
            prefixHint:
                "Palabra que lo sugiere al escribir en un archivo .sql. Si se deja vacío, el snippet solo aparece en esta lista.",
            prefixPlaceholder: "bloqueos",
            prefixNoSpaces:
                "El prefijo no puede llevar espacios: el editor filtra por la palabra anterior al cursor.",
            bodyLabel: "Cuerpo",
            bodyHint:
                "Sintaxis de snippet de VS Code: $1 y $2 son los saltos del tabulador, ${1:valor} lleva un valor por omisión, y el mismo número repetido se edita a la vez.",
            bodyPlaceholder: "SELECT ${1:columnas}\nFROM ${2:tabla}\nWHERE ${3:condicion};",
            descriptionLabel: "Descripción",
            categoryLabel: "Categoría",
            categoryHint: "Para agrupar en la lista. Opcional.",
            categoryPlaceholder: "Diagnóstico",
            save: "Guardar",
        },
    },

    /** Panel de formato (M8). */
    format: {
        profileLabel: "Perfil",
        noProfileSelected: "Sin perfil",
        noProfilesYet: "Todavía no hay perfiles guardados",
        newProfilePlaceholder: "Nombre del perfil nuevo",
        saveProfile: "Guardar como perfil",
        deleteProfile: "Borrar perfil",
        /** Estado del borrador. */
        unapplied: "Sin aplicar",
        applyToUser: "Aplicar a mis ajustes",
        applyToWorkspace: "Aplicar a este proyecto",
        applyToWorkspaceHint:
            "Escribe en .vscode/settings.json. Al commitearlo, todo el equipo formatea igual.",
        revert: "Descartar cambios",
        resetToDefaults: "Volver a los valores de fábrica",
        searchPlaceholder: "Buscar una opción…",
        onlyChanged: (count: number) =>
            count === 1
                ? "Solo la que difiere de fábrica (1)"
                : `Solo las que difieren de fábrica (${count})`,
        /** Vista previa. */
        sampleLabel: "SQL de muestra",
        previewLabel: "Vista previa",
        previewing: "Vista previa (calculando…)",
        previewApplied: "Con lo aplicado ahora",
        previewCandidate: "Como quedaría (sin aplicar)",
        previewSame: "Igual: no hay cambios sin aplicar",
    },
    /** El registro al que apunta una clave ajena (§31). */
    referencedRow: {
        title: "Registro referenciado",
        /** La entrada del menú contextual de la rejilla de resultados. */
        menuItem: "Ver registro referenciado",
        /** Encabezados de las tres secciones, en el orden del razonamiento de quien mira. */
        origin: "Celda de origen",
        target: "Clave ajena",
        record: "Registro",
        /** Marca de la columna por la que se llegó hasta este registro. */
        matchMark: "\u2190 por aquí",
        loading: "Consultando\u2026",
        close: "Cerrar",
        unknownSource: (column: string) =>
            `No se pudo averiguar de qué tabla sale la columna ${column}. Suele pasar con columnas calculadas, o cuando lo ejecutado no es una consulta simple: prueba a ejecutar solo el SELECT.`,
        /** Los finales que no son «aquí está la fila». Cada uno dice qué pasó y por qué. */
        noForeignKey: (column: string) =>
            `La columna ${column} no participa en ninguna clave ajena, así que no apunta a ningún registro.`,
        compositeKey: (constraint: string) =>
            `La clave ajena ${constraint} es de varias columnas. Con el valor de una sola celda no se puede identificar la fila, así que no se consulta ninguna.`,
        nullValue: "El valor de la celda es NULL, así que no apunta a ningún registro.",
        notFound: (table: string) =>
            `No hay ningún registro en ${table} con ese valor. Puede que se haya borrado, o que la integridad no esté declarada.`,
    },
} as const;
