/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { ExecutionPlan, renderReadableScript } from "../sql/ddl/plan";
import { SecretRequirement, validateSecret } from "../sql/ddl/secrets";
import { Strings } from "../../strings";

/**
 * Las dos puertas de interfaz que hay antes de escribir en el servidor.
 *
 * 1. `confirmPlan`: diálogo modal con **el script completo** y, si el servidor está marcado como de
 *    producción, el aviso extra (reglas 11.1 y 11.4 del brief).
 * 2. `confirmByTypingName`: escribir el nombre del objeto, para lo destructivo y para producción
 *    (regla 11.5).
 *
 * Las dos devuelven `false` si el usuario no confirma, y ninguna ejecuta nada.
 */

/** Muestra el plan y pide confirmación. `false` si el usuario cierra o cancela. */
export async function confirmPlan(plan: ExecutionPlan): Promise<boolean> {
    const script = renderReadableScript(plan);
    const action = Strings.writeGate.confirmAction(plan.statements.length);

    const detail = [
        plan.production ? Strings.writeGate.productionWarning : "",
        Strings.writeGate.confirmIntro(plan.statements.length),
        "",
        script,
        "",
        plan.irreversible.length > 0
            ? Strings.writeGate.irreversibleWarning
            : Strings.writeGate.transactionalNote,
    ]
        .filter(Boolean)
        .join("\n");

    const chosen = await vscode.window.showWarningMessage(
        plan.title,
        { modal: true, detail },
        action,
    );
    return chosen === action;
}

/**
 * Pide las contraseñas que necesita el plan, en el mismo orden que las ranuras del lote.
 *
 * Es el único punto del fork donde existe una contraseña, y existe **solo durante esta llamada**:
 * no entra en el estado del webview, ni en el objeto del plan, ni en `settings.json`, ni en el
 * almacén de credenciales (regla 11.3 del brief). Quien reciba el array lo usa para construir el
 * lote y lo suelta.
 *
 * Devuelve `undefined` si la persona cancela cualquiera de las cajas: entonces no se ejecuta nada.
 *
 * La caja pide la contraseña **dos veces** y compara. Sin eso, una errata en una contraseña que no
 * se ve crearía un login al que nadie puede entrar, y habría que restablecerla para descubrirlo.
 */
export async function promptForSecrets(
    requirements: readonly SecretRequirement[],
): Promise<string[] | undefined> {
    const collected: string[] = [];

    for (const [index, requirement] of requirements.entries()) {
        const position = requirements.length > 1 ? ` (${index + 1} de ${requirements.length})` : "";

        const first = await vscode.window.showInputBox({
            title: `${requirement.prompt}${position}`,
            prompt: Strings.writeGate.secretPrompt,
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => validateSecret(value),
        });
        if (first === undefined) {
            return undefined;
        }

        const second = await vscode.window.showInputBox({
            title: `Repite la contraseña${position}`,
            prompt: Strings.writeGate.secretRepeatPrompt(requirement.subject),
            password: true,
            ignoreFocusOut: true,
            // Se compara aquí, dentro de la caja, para poder avisar sin perder lo escrito.
            validateInput: (value) =>
                value === first ? undefined : Strings.writeGate.secretMismatch,
        });
        if (second === undefined || second !== first) {
            return undefined;
        }

        collected.push(first);
    }

    return collected;
}

/**
 * Pide escribir el nombre del objeto, exacto y con las mayúsculas que tenga.
 *
 * `ignoreFocusOut` porque perder el foco no puede cerrar la única barrera que queda antes de una
 * operación destructiva.
 */
export async function confirmByTypingName(name: string, what: string): Promise<boolean> {
    const typed = await vscode.window.showInputBox({
        title: Strings.writeGate.typeNameTitle(what),
        prompt: Strings.writeGate.typeNamePrompt(name),
        placeHolder: name,
        ignoreFocusOut: true,
        validateInput: (value) =>
            value === name ? undefined : Strings.writeGate.typeNameMismatch(name),
    });

    // Comparación exacta y sensible a mayúsculas: SQL Server distingue según la collation, y aquí
    // conviene ser estricto y no adivinar.
    return typed === name;
}
