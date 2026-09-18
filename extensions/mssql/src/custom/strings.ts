/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Textos del host de extensión para lo que añade el fork.
 *
 * **Por qué son constantes planas y no `vscode.l10n.t()`:** la interfaz nueva del fork es solo en
 * español, por decisión del brief. La tubería de localización del upstream (`*.xlf`, `*.l10n.json`)
 * la genera y la traduce Microsoft en su propia infraestructura; nuestros textos no entran ahí, así
 * que envolverlos en `l10n.t()` solo añadiría ruido. Además, la regla de ESLint
 * `custom-eslint-rules/no-direct-l10n` tiene una lista blanca cerrada de dos archivos del upstream,
 * y ampliarla sería deuda de merge a cambio de nada.
 *
 * Los textos del upstream **no se traducen** y siguen su propio camino.
 *
 * Si algún día hiciera falta más de un idioma, este archivo es el único punto que hay que cambiar.
 */
export const Strings = {
    adminPanel: {
        /** Título de la pestaña del panel. */
        title: (server: string) => `Administración · ${server}`,
        /**
         * Etiqueta cuando el perfil no fija una base de datos, así que la conexión usa la
         * predeterminada del login. El panel siempre tiene que decir a qué apunta, aunque sea esto.
         */
        defaultDatabase: "(predeterminada)",
        /** Error cuando el comando se invoca sin un nodo utilizable. */
        noTargetNode:
            "Selecciona un servidor o una base de datos en el explorador de objetos para abrir el panel de administración.",
        /** Error cuando el nodo no tiene perfil de conexión. */
        noConnectionProfile:
            "El nodo seleccionado no tiene una conexión asociada. Conéctalo e inténtalo de nuevo.",
        /** Error cuando la extensión no tiene una conexión abierta para ese perfil. */
        notConnected: (server: string) =>
            `No hay una conexión abierta contra ${server}. Conéctate desde el explorador de objetos y vuelve a abrir el panel.`,
        /** Salvaguarda: el webview pidió una sección que el host no conoce. */
        unknownSection: "El panel pidió una sección que no existe.",
        /**
         * Salvaguarda de la regla 11.2: el nombre de la base entra en el texto de la consulta, así
         * que si no pasa la validación no se consulta nada. El mensaje no repite el nombre.
         */
        invalidDatabaseName:
            "El nombre de la base de datos seleccionada no es válido para SQL Server, así que no se consultó nada.",
    },
    /**
     * Terminación de sesiones. Es la primera operación del fork que **escribe** en el servidor, así
     * que todo lo que el usuario ve antes de confirmar está aquí.
     */
    killSession: {
        /** Salvaguarda: la fila ya no está en el estado del panel. */
        unknownSession:
            "Esa sesión ya no está en la lista. Actualiza la sección de sesiones e inténtalo de nuevo.",
        /** No se pudo leer si hay permiso. No se ejecuta nada en ese caso. */
        permissionUnknown: (reason: string) =>
            `No se pudo comprobar el permiso para terminar sesiones: ${reason}`,
        /** Falta el permiso. Los tres caminos posibles se nombran para que se pueda pedir. */
        noPermission: (login: string) =>
            `El login ${login} no tiene permiso para terminar sesiones. Hace falta ALTER ANY CONNECTION, o pertenecer a sysadmin o a processadmin.`,
        /** SQL Server devuelve el error 6104 en este caso; se evita antes de llegar al servidor. */
        ownSession:
            "Esa es la sesión que usa este panel. SQL Server no permite que una sesión se termine a sí misma.",
        /** La sesión desapareció entre la lectura y la confirmación. */
        alreadyGone: (sessionId: number) =>
            `La sesión ${sessionId} ya no existe: terminó por su cuenta. Se actualizó la lista.`,
        /**
         * El identificador ahora pertenece a otra conexión. Comprobado contra SQL Server: los
         * identificadores se reutilizan de inmediato, así que esto no es hipotético.
         */
        reused: (sessionId: number) =>
            `El identificador ${sessionId} ya pertenece a otra sesión: SQL Server los reutiliza en cuanto se liberan. No se terminó nada y se actualizó la lista.`,
        /** Título del diálogo de confirmación. */
        confirmTitle: (sessionId: number) => `¿Terminar la sesión ${sessionId}?`,
        /** Cuerpo del diálogo: identidad de la sesión, qué se pierde y la sentencia exacta. */
        confirmDetail: (details: string, statement: string) =>
            `${details}\n\nSe ejecutará:\n${statement}\n\nEs irreversible: la sesión pierde el trabajo que no haya confirmado. No se puede ejecutar dentro de una transacción porque SQL Server lo prohíbe, así que no hay vuelta atrás con un ROLLBACK.`,
        /** Botón que confirma. Lleva el número para que no se confirme a ciegas. */
        confirmAction: (sessionId: number) => `Terminar sesión ${sessionId}`,
        /** Línea de la identidad de la sesión dentro del diálogo. */
        sessionSummary: (login: string, host: string, program: string, database: string) =>
            `Login: ${login}\nEquipo: ${host}\nAplicación: ${program}\nBase de datos: ${database}`,
        /** Aviso extra cuando hay una transacción abierta, con el tiempo que lleva. */
        openTransactionWarning: (duration: string) =>
            `Tiene una transacción abierta desde hace ${duration}. Al terminar la sesión, SQL Server la revierte.`,
        /** Resultado correcto. */
        done: (sessionId: number) => `Sesión ${sessionId} terminada.`,
        /** El servidor rechazó el `KILL`. */
        failed: (sessionId: number, reason: string) =>
            `No se pudo terminar la sesión ${sessionId}: ${reason}`,
    },
} as const;
