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
        /** Al cambiar de base, los cambios montados contra la anterior dejan de valer. */
        pendingChangesDropped: (count: number, database: string) =>
            count === 1
                ? `Se descartó 1 cambio pendiente: se montó contra otra base de datos y ahora el panel apunta a ${database}.`
                : `Se descartaron ${count} cambios pendientes: se montaron contra otra base de datos y ahora el panel apunta a ${database}.`,
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
    /**
     * Textos de la puerta de escritura: lo que se ve antes de que el fork escriba en el servidor, y
     * lo que se ve después.
     */
    writeGate: {
        /** Título del diálogo de confirmación. */
        planTitle: (count: number) =>
            count === 1 ? "¿Aplicar 1 cambio?" : `¿Aplicar ${count} cambios?`,
        confirmIntro: (count: number) =>
            count === 1
                ? "Se ejecutará esta sentencia:"
                : `Se ejecutarán estas ${count} sentencias, en este orden:`,
        confirmAction: (count: number) =>
            count === 1 ? "Aplicar 1 cambio" : `Aplicar ${count} cambios`,
        /** Lo que garantiza el envoltorio transaccional, dicho con palabras. */
        transactionalNote:
            "Todo va en una sola transacción: si una sentencia falla, se revierten todas y el servidor queda como está ahora.",
        /**
         * Aviso de las sentencias que SQL Server no permite dentro de una transacción. Mismas
         * palabras que el diálogo de terminar sesión, a propósito.
         */
        irreversibleWarning:
            "Es irreversible: SQL Server no permite estas sentencias dentro de una transacción, así que no hay vuelta atrás con un ROLLBACK.",
        /** Aviso extra de la regla 11.4, cuando el servidor está marcado como de producción. */
        productionWarning: "ATENCIÓN: este servidor está marcado como de producción.\n",
        /** Caja de texto de la regla 11.5. */
        typeNameTitle: (what: string) => `Confirmar: escribe el nombre ${what}`,
        typeNamePrompt: (name: string) =>
            `Escribe «${name}» para confirmar. Es la última comprobación antes de ejecutar.`,
        typeNameMismatch: (name: string) => `Tiene que coincidir exactamente con «${name}».`,
        /** Resultados. */
        applied: (count: number) =>
            count === 1 ? "1 cambio aplicado." : `${count} cambios aplicados.`,
        rolledBack: (label: string, reason: string) =>
            `No se aplicó nada. Falló «${label}» y se revirtió la transacción entera: ${reason}`,
        inheritedTransaction:
            "No se ejecutó nada: la conexión ya tenía una transacción abierta, y el panel no confirma ni revierte una transacción que no es suya.",
        unknown: (reason: string) =>
            `No se pudo confirmar qué quedó aplicado: ${reason} Vuelve a leer la sección antes de repetir el cambio.`,
        /** La relectura posterior falló: la pantalla puede no reflejar el servidor. */
        staleAfterApply:
            "El cambio se aplicó, pero la relectura falló: lo que se ve en pantalla puede no ser lo que hay en el servidor.",
        /** Salvaguardas del plan. */
        planExpired:
            "La lista de cambios cambió desde que se generó la vista previa, así que no se ejecutó nada. Vuelve a revisarla.",
        planEmpty: "No hay ningún cambio pendiente que aplicar.",
        planInvalid: (reason: string) => `El plan no se puede ejecutar: ${reason}`,
        /** Mensajes propios por número de error del motor. */
        engineError: {
            226: "SQL Server no permite esa sentencia dentro de una transacción. Es un fallo del panel al construir el lote, no algo que puedas arreglar desde aquí.",
            574: "SQL Server no permite borrar una base de datos dentro de una transacción. Es un fallo del panel al construir el lote.",
            3930: "La transacción quedó condenada y solo se pudo revertir.",
            4621: "Ese permiso es de ámbito de servidor y solo se puede conceder desde master.",
            6115: "SQL Server no permite terminar una sesión dentro de una transacción.",
            15151: "El principal al que se refiere el cambio ya no existe, o no se puede ver con estos permisos.",
            50001: "El objeto ya no es el mismo que se leyó: se borró y se volvió a crear, o no existe.",
            50002: "La fila que se iba a cambiar ya no está como se leyó.",
            50003: "Alguien hizo ese cambio, o el contrario, mientras el panel estaba abierto.",
        } as Record<number, string>,
        /** Abrir el script en un editor. */
        scriptDocumentHeader: (server: string, database: string) =>
            `-- SQLWorks · vista previa del cambio\n-- Servidor: ${server}\n-- Base de datos: ${database}\n-- Este editor NO está conectado: es una copia para revisar, no para ejecutar.\n`,
    },
} as const;
