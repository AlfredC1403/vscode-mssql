/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { FormatOption } from "../sharedInterfaces/formatProfiles";
import { deviationsFromDefaults, readFormatSchema } from "./schema";
import { applyValues, readProfiles } from "./profileStore";
import { Strings } from "../strings";

/**
 * Cambiar de perfil de formato desde la paleta, sin abrir el panel (M8).
 *
 * Es lo que se hace a diario: el panel sirve para **construir** un perfil mirando la vista previa,
 * y esto para **usarlo**. Separarlos evita arrancar el proceso de la vista previa —123 MB, medidos—
 * solo para cambiar de estilo.
 */
export async function pickAndApplyProfile(context: vscode.ExtensionContext): Promise<void> {
    const options = readSchemaFrom(context);
    if (options.length === 0) {
        void vscode.window.showWarningMessage(Strings.format.noSchema);
        return;
    }

    const loaded = readProfiles(options);
    if (loaded.profiles.length === 0) {
        // Sin perfiles no hay nada que elegir; se ofrece abrir el panel, que es donde se crean.
        const open = await vscode.window.showInformationMessage(
            Strings.format.noProfiles,
            Strings.format.openPanelAction,
        );
        if (open === Strings.format.openPanelAction) {
            await vscode.commands.executeCommand("sqlworks.openFormatPanel");
        }
        return;
    }

    const picked = await vscode.window.showQuickPick(
        loaded.profiles.map((profile) => {
            const count = Object.keys(profile.values).length;
            return {
                label: profile.name,
                // Cuántas opciones toca, para poder distinguir un perfil mínimo de uno agresivo.
                description: Strings.format.profileDeviationCount(count),
                profile,
            };
        }),
        { title: Strings.format.pickProfileTitle, matchOnDescription: true },
    );
    if (!picked) {
        return;
    }

    const scope = await pickScope();
    if (!scope) {
        return;
    }

    // Un perfil guarda solo desviaciones; `applyValues` vuelve a calcularlas sobre el mapa completo,
    // así que se le pasan los valores por omisión con el perfil encima.
    const values: Record<string, boolean | string | number> = {};
    for (const option of options) {
        values[option.name] = picked.profile.values[option.name] ?? option.defaultValue;
    }

    const problem = await applyValues(values, options, scope);
    if (problem) {
        void vscode.window.showErrorMessage(problem);
        return;
    }

    const count = Object.keys(deviationsFromDefaults(values, options)).length;
    void vscode.window.showInformationMessage(
        `${Strings.format.profileApplied(picked.profile.name)} ${Strings.format.applied(
            count,
            scope === "workspace" ? Strings.format.scopeWorkspace : Strings.format.scopeUser,
        )}`,
    );
}

/**
 * Dónde se escribe.
 *
 * Se pregunta en lugar de suponer: el ámbito del espacio de trabajo es lo que hace que un equipo
 * comparta el estilo al commitear `.vscode/settings.json`, y el de usuario lo que hace que valga en
 * todos los proyectos. Elegir por la persona sería elegir mal la mitad de las veces.
 */
async function pickScope(): Promise<"user" | "workspace" | undefined> {
    const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
    if (!hasWorkspace) {
        // Sin carpeta abierta no hay ajustes de espacio de trabajo donde escribir.
        return "user";
    }

    const picked = await vscode.window.showQuickPick(
        [
            {
                label: Strings.format.scopeUserLabel,
                detail: Strings.format.scopeUserDetail,
                scope: "user" as const,
            },
            {
                label: Strings.format.scopeWorkspaceLabel,
                detail: Strings.format.scopeWorkspaceDetail,
                scope: "workspace" as const,
            },
        ],
        { title: Strings.format.pickScopeTitle },
    );
    return picked?.scope;
}

/** Lee el esquema del `package.json` de la extensión. */
export function readSchemaFrom(context: vscode.ExtensionContext): FormatOption[] {
    const packageJson = context.extension?.packageJSON as
        | { contributes?: { configuration?: { properties?: unknown } } }
        | undefined;
    return readFormatSchema(packageJson?.contributes?.configuration?.properties);
}
