/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { useState } from "react";
import { ToolbarButton, makeStyles } from "@fluentui/react-components";
import { CheckmarkCircleFilled, DismissCircleFilled } from "@fluentui/react-icons";

import { WebviewStrings as Strings } from "../strings";

/**
 * Confirmar y descartar los cambios pendientes del editor de datos (§32).
 *
 * ## Qué había ya, y qué faltaba
 *
 * El editor en línea **ya existe**: es el Table Explorer del upstream, que abre una sesión de
 * edición contra el STS (`edit/initialize`) y va montando los cambios celda a celda
 * (`edit/updateCell`) hasta que alguien los aplica (`edit/commit`). Se editan varias celdas, se
 * marcan en la rejilla y nada toca el servidor hasta el final.
 *
 * Lo que no había es la otra mitad del par: un botón de **descartar**. El revertido estaba —con su
 * llamada al STS y todo— pero solo se llegaba a él fila por fila, por el botón de deshacer de la
 * fila o por su menú contextual. Si habías tocado quince celdas y querías dejarlo, tocaba ir una
 * por una.
 *
 * Aquí están los dos, con los colores que se piden: verde para confirmar, rojo para descartar, y la
 * cuenta de cambios pendientes en los dos, que es lo que dice si hay algo que confirmar o descartar.
 *
 * ## Por qué descartar no pregunta
 *
 * Porque no toca el servidor. La regla del §22 —vista previa, confirmación y transacción— es para lo
 * que **escribe**, y descartar es justo lo contrario: tira lo que aún no se ha escrito. Un diálogo
 * aquí sería fricción en la acción segura. Confirmar sí escribe, y para eso está el otro botón.
 */

const useStyles = makeStyles({
    /** El verde y el rojo salen del tema, no fijados a mano: hay temas claros, oscuros y de alto contraste. */
    confirm: {
        color: "var(--vscode-testing-iconPassed, var(--vscode-charts-green, #3fb950))",
    },
    discard: {
        color: "var(--vscode-errorForeground, var(--vscode-charts-red, #f85149))",
    },
});

export interface PendingChangesButtonsProps {
    /** Cuántos cambios hay montados: celdas editadas más filas marcadas para borrar. */
    changeCount: number;
    /** Aplica los cambios. Es el `onSave` del Table Explorer, que llama a `edit/commit`. */
    onConfirm: () => Promise<void>;
    /** Revierte todo lo pendiente. Lo resuelve la rejilla, que es quien lleva la cuenta. */
    onDiscard: () => Promise<void>;
    /** Mientras carga o guarda no se puede ni confirmar ni descartar. */
    disabled: boolean;
}

/**
 * El par de botones, para la barra del Table Explorer.
 *
 * Se renderizan siempre, también con cero cambios: un botón que aparece y desaparece mueve el resto
 * de la barra de sitio, y entonces se pulsa lo que no es. Deshabilitados dicen lo mismo y no saltan.
 */
export const PendingChangesButtons: React.FC<PendingChangesButtonsProps> = ({
    changeCount,
    onConfirm,
    onDiscard,
    disabled,
}) => {
    const styles = useStyles();
    const [busy, setBusy] = useState(false);

    const nothingToDo = changeCount === 0 || disabled || busy;

    /** Las dos acciones son lo mismo salvo por lo que llaman: ocupado, intentar, soltar. */
    const run = async (action: () => Promise<void>) => {
        if (busy) {
            return;
        }
        setBusy(true);
        try {
            await action();
        } catch {
            // El controlador ya avisa del fallo; aquí solo hay que soltar el botón.
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <ToolbarButton
                aria-label={Strings.tableExplorer.confirm(changeCount)}
                title={Strings.tableExplorer.confirmTooltip}
                icon={<CheckmarkCircleFilled className={styles.confirm} />}
                onClick={() => void run(onConfirm)}
                disabled={nothingToDo}>
                {Strings.tableExplorer.confirm(changeCount)}
            </ToolbarButton>
            <ToolbarButton
                aria-label={Strings.tableExplorer.discard(changeCount)}
                title={Strings.tableExplorer.discardTooltip}
                icon={<DismissCircleFilled className={styles.discard} />}
                onClick={() => void run(onDiscard)}
                disabled={nothingToDo}>
                {Strings.tableExplorer.discard(changeCount)}
            </ToolbarButton>
        </>
    );
};
