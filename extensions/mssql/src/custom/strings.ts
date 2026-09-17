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
    },
} as const;
