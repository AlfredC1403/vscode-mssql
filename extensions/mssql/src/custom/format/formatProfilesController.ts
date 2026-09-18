/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { WebviewPanelController } from "../../controllers/webviewPanelController";
import { CustomWebviewKind } from "../sharedInterfaces/customWebview";
import {
    FormatOption,
    FormatProfilesReducers,
    FormatProfilesState,
} from "../sharedInterfaces/formatProfiles";
import { defaultValues, deviationsFromDefaults, mergeProfile, readFormatSchema } from "./schema";
import {
    applyValues,
    readAppliedValues,
    readProfiles,
    writeProfiles,
    PROFILES_SETTING,
} from "./profileStore";
import { PreviewFormatter } from "./previewFormatter";
import { Strings } from "../strings";

/**
 * Panel de perfiles y opciones del formateador (M8).
 *
 * **El fork no sustituye el formateador del upstream: lo configura.** No hay proveedor de formato
 * propio, no entra ninguna librería de formateo, y el T-SQL lo sigue formateando el parser real
 * (ScriptDom) dentro del STS. Este panel es una interfaz sobre `mssql.format.options.*`, más
 * perfiles con nombre, que es lo único que VS Code no da.
 *
 * Ver FORK.md §25 para el razonamiento completo y para por qué **no** hay un perfil XML.
 */
export class FormatProfilesController extends WebviewPanelController<
    FormatProfilesState,
    FormatProfilesReducers
> {
    /** Esquema leído del `package.json`, no una lista escrita a mano. */
    private readonly options: FormatOption[];
    private readonly preview: PreviewFormatter;
    private sample = Strings.format.defaultSample;
    /** Para no lanzar una vista previa por cada pulsación de tecla. */
    private previewTimer?: NodeJS.Timeout;

    constructor(context: vscode.ExtensionContext) {
        const options = readFormatSchema(
            (
                context.extension?.packageJSON as
                    | { contributes?: { configuration?: { properties?: unknown } } }
                    | undefined
            )?.contributes?.configuration?.properties,
        );
        const applied = readAppliedValues(options);

        super(
            context,
            "sqlworks",
            // Identificador de la vista, no el título: el título va en las opciones de abajo.
            "SqlWorksFormat",
            {
                view: CustomWebviewKind.FormatProfiles,
                options,
                profiles: [],
                selectedProfile: "",
                draft: { ...applied },
                applied,
                dirty: false,
                preview: {
                    source: Strings.format.defaultSample,
                    current: "",
                    candidate: "",
                    errorMessage: "",
                },
                previewing: false,
                message: "",
            },
            { title: Strings.format.panelTitle, viewColumn: vscode.ViewColumn.Active },
        );

        this.options = options;
        this.preview = new PreviewFormatter(context.extensionUri);
        // El proceso de la vista previa muere con el panel: son 123 MB, medidos, y no tiene sentido
        // mantenerlos si nadie está mirando.
        this.registerDisposable(this.preview);

        // Si alguien cambia los ajustes del formateador o los perfiles por fuera —a mano, o al
        // sincronizar—, el panel se entera en lugar de mostrar algo viejo.
        this.registerDisposable(
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (
                    event.affectsConfiguration("mssql.format") ||
                    event.affectsConfiguration(PROFILES_SETTING)
                ) {
                    this.reloadFromSettings();
                }
            }),
        );

        this.registerReducers();
        this.reloadFromSettings();
        this.schedulePreview();
    }

    private registerReducers(): void {
        this.registerReducer("setOption", (state, payload) => {
            const draft = { ...state.draft, [payload.name]: payload.value };
            this.schedulePreview();
            return {
                ...state,
                draft,
                dirty: isDirty(draft, state.applied),
                // Cambiar una opción a mano deja de ser «el perfil X»: es el perfil X modificado.
                selectedProfile: "",
                message: "",
            };
        });

        this.registerReducer("selectProfile", (state, payload) => {
            const profile = state.profiles.find((entry) => entry.name === payload.name);
            if (!profile) {
                return state;
            }
            // Un perfil guarda solo desviaciones, así que se mezcla sobre los valores por omisión:
            // lo que el perfil no diga vuelve a lo que declara el upstream, no a lo que hubiera
            // antes en el panel. Si no, aplicar dos perfiles seguidos daría un híbrido.
            const merged = mergeProfile(profile.values, this.options);
            this.schedulePreview();
            return {
                ...state,
                draft: merged.values,
                selectedProfile: profile.name,
                dirty: isDirty(merged.values, state.applied),
                message:
                    merged.ignored.length > 0
                        ? Strings.format.profileIgnoredOptions(
                              profile.name,
                              merged.ignored.join(", "),
                          )
                        : "",
            };
        });

        this.registerReducer("apply", (state, payload) => {
            void this.apply(state, payload.scope);
            return state;
        });

        this.registerReducer("saveProfile", (state, payload) => {
            void this.saveProfile(state, payload.name);
            return state;
        });

        this.registerReducer("deleteProfile", (state, payload) => {
            void this.deleteProfile(state, payload.name);
            return state;
        });

        this.registerReducer("revert", (state) => {
            this.schedulePreview();
            return {
                ...state,
                draft: { ...state.applied },
                selectedProfile: "",
                dirty: false,
                message: "",
            };
        });

        this.registerReducer("resetToDefaults", (state) => {
            const values = defaultValues(this.options);
            this.schedulePreview();
            return {
                ...state,
                draft: values,
                selectedProfile: "",
                dirty: isDirty(values, state.applied),
                message: "",
            };
        });

        this.registerReducer("setSample", (state, payload) => {
            this.sample = payload.sql;
            this.schedulePreview();
            return { ...state, preview: { ...state.preview, source: payload.sql } };
        });

        this.registerReducer("refreshPreview", (state) => {
            this.schedulePreview(0);
            return state;
        });
    }

    /** Relee del `settings.json` lo aplicado y los perfiles. */
    private reloadFromSettings(): void {
        if (this.isDisposed) {
            return;
        }
        const applied = readAppliedValues(this.options);
        const loaded = readProfiles(this.options);
        this.state = {
            ...this.state,
            applied,
            profiles: loaded.profiles,
            dirty: isDirty(this.state.draft, applied),
            message: loaded.warnings.join(" "),
        };
    }

    /**
     * Calcula la vista previa, con un pequeño retardo.
     *
     * Sin el retardo, escribir en el cuadro del SQL de muestra lanzaría una petición por tecla.
     */
    private schedulePreview(delayMs = 350): void {
        clearTimeout(this.previewTimer);
        this.previewTimer = setTimeout(() => void this.runPreview(), delayMs);
    }

    private async runPreview(): Promise<void> {
        if (this.isDisposed) {
            return;
        }
        this.state = { ...this.state, previewing: true };

        const sample = this.sample;
        // Las dos mitades: cómo queda con lo aplicado y cómo quedaría con el borrador. Se piden a
        // **nuestro** STS, así que los ajustes del usuario no se tocan (ver `previewFormatter.ts`).
        const current = await this.preview.format(sample, this.state.applied);
        const candidate = await this.preview.format(sample, this.state.draft);

        if (this.isDisposed) {
            return;
        }
        this.state = {
            ...this.state,
            previewing: false,
            preview: {
                source: sample,
                current: current.text ?? "",
                candidate: candidate.text ?? "",
                errorMessage: current.errorMessage ?? candidate.errorMessage ?? "",
            },
        };
    }

    private async apply(state: FormatProfilesState, scope: "user" | "workspace"): Promise<void> {
        const problem = await applyValues(state.draft, this.options, scope);
        if (this.isDisposed) {
            return;
        }
        if (problem) {
            void vscode.window.showErrorMessage(problem);
            return;
        }

        const count = Object.keys(deviationsFromDefaults(state.draft, this.options)).length;
        const applied = readAppliedValues(this.options);
        this.state = {
            ...this.state,
            applied,
            dirty: isDirty(state.draft, applied),
            message: Strings.format.applied(
                count,
                scope === "workspace" ? Strings.format.scopeWorkspace : Strings.format.scopeUser,
            ),
        };
        this.schedulePreview(0);
    }

    private async saveProfile(state: FormatProfilesState, name: string): Promise<void> {
        const trimmed = name.trim();
        if (!trimmed) {
            void vscode.window.showWarningMessage(Strings.format.profileNameRequired);
            return;
        }

        // Solo las desviaciones: un perfil se lee de un vistazo y una opción nueva del upstream no
        // queda congelada con su valor de hoy. Ver `schema.ts`.
        const values = deviationsFromDefaults(state.draft, this.options);
        const others = state.profiles.filter((profile) => profile.name !== trimmed);
        const problem = await writeProfiles([...others, { name: trimmed, values }]);
        if (this.isDisposed) {
            return;
        }
        if (problem) {
            void vscode.window.showErrorMessage(problem);
            return;
        }
        this.reloadFromSettings();
        this.state = {
            ...this.state,
            selectedProfile: trimmed,
            message: Strings.format.profileSaved(trimmed),
        };
    }

    private async deleteProfile(state: FormatProfilesState, name: string): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            Strings.format.confirmDeleteProfile(name),
            { modal: true },
            Strings.format.deleteAction,
        );
        if (confirm !== Strings.format.deleteAction || this.isDisposed) {
            return;
        }

        const problem = await writeProfiles(
            state.profiles.filter((profile) => profile.name !== name),
        );
        if (this.isDisposed) {
            return;
        }
        if (problem) {
            void vscode.window.showErrorMessage(problem);
            return;
        }
        this.reloadFromSettings();
        this.state = {
            ...this.state,
            selectedProfile: this.state.selectedProfile === name ? "" : this.state.selectedProfile,
            message: Strings.format.profileDeleted(name),
        };
    }
}

/** `true` si el borrador difiere de lo aplicado. Función pura. */
export function isDirty(
    draft: Record<string, boolean | string | number>,
    applied: Record<string, boolean | string | number>,
): boolean {
    const names = new Set([...Object.keys(draft), ...Object.keys(applied)]);
    for (const name of names) {
        if (draft[name] !== applied[name]) {
            return true;
        }
    }
    return false;
}
