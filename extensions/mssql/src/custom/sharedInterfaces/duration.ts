/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Formato de duraciones, compartido host ↔ webview.
 *
 * Vive aquí, y no en `util/`, porque lo usan los dos lados: la rejilla de sesiones pinta la
 * antigüedad de la transacción y el diálogo de confirmación del host repite ese mismo dato. Esta
 * carpeta ya está en los dos `tsconfig`, así que compartirla no cuesta ninguna línea del upstream.
 * El propio upstream pone funciones puras en su `src/sharedInterfaces` por la misma razón
 * (`queryResultCellCodec.ts`, `selectionSummary.ts`).
 */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

/**
 * Convierte segundos en algo legible: `45 s`, `3 min 20 s`, `2 h 5 min`, `1 d 3 h`.
 *
 * Se queda en dos unidades a propósito: en una rejilla lo que importa es el orden de magnitud, no
 * el segundo exacto. Un valor no positivo devuelve cadena vacía, que es lo que el panel pinta como
 * «sin transacción abierta». Función pura.
 */
export function formatSeconds(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
        return "";
    }
    const seconds = Math.floor(totalSeconds);

    if (seconds < SECONDS_PER_MINUTE) {
        return `${seconds} s`;
    }
    if (seconds < SECONDS_PER_HOUR) {
        const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
        const rest = seconds % SECONDS_PER_MINUTE;
        return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
    }
    if (seconds < SECONDS_PER_DAY) {
        const hours = Math.floor(seconds / SECONDS_PER_HOUR);
        const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
        return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
    }
    const days = Math.floor(seconds / SECONDS_PER_DAY);
    const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
    return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
}
