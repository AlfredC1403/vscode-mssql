/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Todas las vistas del fork comparten un único bundle de esbuild (`sqlworks`), y el router de
 * `src/custom/webviews/index.tsx` elige cuál renderizar a partir del estado que le manda el host.
 *
 * Esto es lo que mantiene el coste en `scripts/bundle-webviews.js` en **una línea para siempre**,
 * en lugar de una por panel. Ver FORK.md §16.
 */
export enum CustomWebviewKind {
    /** Panel de administración: servidor, bases de datos y usuarios. */
    AdminPanel = "adminPanel",
    /** Biblioteca de snippets, en la barra lateral. Es una vista, no un panel del editor. */
    Snippets = "snippets",
    /** Perfiles y opciones del formateador, con vista previa. */
    FormatProfiles = "formatProfiles",
}

/** Campo que todo estado de una vista del fork tiene que llevar, para que el router decida. */
export interface CustomWebviewStateBase {
    /** Qué vista debe renderizar el router. */
    view: CustomWebviewKind;
}
