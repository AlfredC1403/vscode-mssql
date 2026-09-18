/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Cambios pendientes: lo que el usuario ha montado y todavía no ha ejecutado.
 *
 * Va en `sharedInterfaces/` porque lo usan el host y el webview, y esa carpeta ya está en los dos
 * `tsconfig`: **cero líneas del upstream**.
 *
 * **Aquí no hay ningún campo de contraseña, y hay un test que lo afirma.** M5 no tiene operaciones
 * con contraseña, y si algún día las tiene, el secreto no puede pasar por el estado del webview: el
 * estado se serializa al webview y se puede volcar en un registro.
 */

/** Qué clase de cambio es, para agrupar y para el texto de la interfaz. */
export type PendingChangeKind =
    | "serverPermission"
    | "databasePermission"
    | "serverRoleMembership"
    | "databaseRoleMembership"
    | "loginEnabled"
    | "userDefaultSchema"
    | "dropUser";

/**
 * Un cambio montado por el usuario.
 *
 * `id` lo pone el host y es estable mientras el cambio está en la lista, para poder quitarlo.
 * `description` y `sql` son **texto ya construido por el generador**: el webview no construye T-SQL.
 */
export interface PendingChange {
    id: string;
    kind: PendingChangeKind;
    /** Objeto sobre el que cae: el principal, el rol, el usuario. */
    subject: string;
    /** De qué a qué, en una línea: «Concedido → Sin conceder». */
    transition: string;
    /** Ámbito: el nombre de la base, o «Servidor». */
    scope: string;
    /** La sentencia exacta, tal como irá al lote. Sin punto y coma. */
    sql: string;
    /** `true` si es destructivo, lo que obliga a escribir el nombre (regla 11.5). */
    destructive: boolean;
}

/** Estado de un cambio después de ejecutar. */
export type PendingChangeStatus =
    /** Montado, sin ejecutar. */
    | "pending"
    /** El lote confirmó: aplicado. */
    | "applied"
    /** El lote se revirtió: no quedó aplicado, aunque su sentencia no fuera la que falló. */
    | "rolledBack"
    /** Es el que falló. */
    | "failed"
    /** No se sabe: el servidor no devolvió un informe legible. */
    | "unknown";

/**
 * Los **hechos** del plan que se publican al webview para la vista previa.
 *
 * No lleva el objeto del plan: el webview solo necesita el texto y el nonce. Para ejecutar devuelve
 * `previewId`, y **nunca T-SQL**: así lo que se ejecuta es, por construcción, lo que se mostró
 * (regla 11.1 del brief).
 */
export interface PreviewFacts {
    /** Nonce del plan guardado en el host. Cambiar la lista lo invalida. */
    previewId: string;
    /** Script legible, con comentarios. */
    readableScript: string;
    /** El texto exacto que se envía al servidor, incluido el envoltorio transaccional. */
    exactBatch: string;
    statementCount: number;
    /** Nombre que habrá que escribir para confirmar, vacío si no hace falta. */
    typeToConfirm: string;
    production: boolean;
}

/** Lo que el panel muestra después de ejecutar. */
export interface ChangeSetResult {
    /** Resultado global, ya traducido a algo que se puede pintar. */
    outcome: "applied" | "rolledBack" | "inheritedTransaction" | "unknown";
    /** Etiqueta del paso que falló, vacía si no falló ninguno. */
    failedLabel: string;
    /** Número de error del motor, 0 si no hubo. */
    errorNumber: number;
    /** Mensaje ya saneado. */
    errorMessage: string;
    /** Estado por cambio, en el mismo orden que la lista. */
    statuses: { id: string; status: PendingChangeStatus }[];
    /** `true` si la relectura posterior falló: la pantalla puede estar vieja y hay que decirlo. */
    staleAfterApply: boolean;
}

/** Estado de la marca de producción, publicado para la cabecera. */
export interface ProductionState {
    production: boolean;
    /** Patrón que encajó, para el tooltip. Vacío si la razón es el identificador del perfil. */
    matchedPattern: string;
    /** `true` si el ajuste está vacío: la ausencia de marca tiene que ser visible, no silenciosa. */
    settingEmpty: boolean;
}
