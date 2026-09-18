/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { ExecutionPlan, renderReadableScript } from "../sql/ddl/plan";
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
