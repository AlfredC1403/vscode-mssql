/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Contrato del panel de formato (M8). Cruza el puente host ↔ webview: **no importa `vscode`**.
 */

import { CustomWebviewKind, CustomWebviewStateBase } from "./customWebview";

/** Tipo de control que necesita una opción, deducido de su declaración en `package.json`. */
export type FormatOptionKind = "boolean" | "enum" | "integer";

/**
 * Una opción del formateador del upstream, tal como la declara `package.json`.
 *
 * **No hay una lista escrita a mano en el fork.** Esto se lee del `package.json` en tiempo de
 * ejecución, así que cuando el upstream añada una opción —añadió 56 de golpe hace unos días—
 * aparece en el panel sola, con su tipo, sus valores y su descripción. Ver FORK.md §25.
 */
export interface FormatOption {
    /** Clave completa: `mssql.format.options.keywordCasing`. */
    key: string;
    /** Última parte, que es la que se guarda en un perfil: `keywordCasing`. */
    name: string;
    kind: FormatOptionKind;
    /** Descripción del upstream, en inglés. No se traduce: es texto suyo. */
    description: string;
    /** Valor por omisión que declara el upstream. */
    defaultValue: boolean | string | number;
    /** Valores posibles, solo para `enum`. */
    choices: string[];
    /** Grupo para la interfaz, deducido del nombre. */
    group: string;
}

/** Un perfil: un conjunto de valores con nombre. Solo guarda lo que se desvía del upstream. */
export interface FormatProfile {
    name: string;
    /** Valores por nombre corto de opción. Lo que no esté aquí se queda como está. */
    values: Record<string, boolean | string | number>;
}

/** Lo que muestra la vista previa: el mismo SQL con dos configuraciones. */
export interface FormatPreview {
    /** SQL de muestra sin formatear. */
    source: string;
    /** Formateado con lo que hay aplicado ahora mismo. */
    current: string;
    /** Formateado con lo que hay en el panel sin aplicar. */
    candidate: string;
    /** Motivo si la vista previa no se pudo calcular. Vacío si salió bien. */
    errorMessage: string;
}

/** Estado del panel. */
export interface FormatProfilesState extends CustomWebviewStateBase {
    view: CustomWebviewKind.FormatProfiles;
    /** Esquema leído del `package.json`. */
    options: FormatOption[];
    /** Perfiles guardados en el ajuste propio. */
    profiles: FormatProfile[];
    /** Nombre del perfil seleccionado en el panel. Vacío si se está editando sin perfil. */
    selectedProfile: string;
    /** Valores que el panel tiene ahora, aplicados o no. */
    draft: Record<string, boolean | string | number>;
    /** Valores que de verdad están aplicados en los ajustes del upstream. */
    applied: Record<string, boolean | string | number>;
    /** `true` si `draft` difiere de `applied`. */
    dirty: boolean;
    preview: FormatPreview;
    /** `true` mientras se calcula la vista previa. */
    previewing: boolean;
    /** Aviso o resultado de la última acción, ya listo para mostrar. */
    message: string;
}

/** Lo que el panel puede pedir al host. */
export interface FormatProfilesReducers {
    /** Cambia un valor del borrador. */
    setOption: { name: string; value: boolean | string | number };
    /** Carga un perfil en el borrador. */
    selectProfile: { name: string };
    /** Escribe el borrador en los ajustes del upstream. */
    apply: { scope: "user" | "workspace" };
    /** Guarda el borrador como perfil con ese nombre. */
    saveProfile: { name: string };
    /** Borra un perfil. */
    deleteProfile: { name: string };
    /** Devuelve el borrador a lo que está aplicado. */
    revert: Record<string, never>;
    /** Devuelve el borrador a los valores por omisión del upstream. */
    resetToDefaults: Record<string, never>;
    /** Cambia el SQL de muestra de la vista previa. */
    setSample: { sql: string };
    /** Vuelve a calcular la vista previa. */
    refreshPreview: Record<string, never>;
}
