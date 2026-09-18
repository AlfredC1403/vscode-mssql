/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Button,
    Popover,
    PopoverSurface,
    Spinner,
    Text,
    makeStyles,
} from "@fluentui/react-components";
import { DismissRegular } from "@fluentui/react-icons";

import { ReferencedRowResult } from "../../sharedInterfaces/referencedRow";
import { WebviewStrings as Strings } from "../strings";

/**
 * El registro al que apunta la clave ajena de una celda, en un globo sobre la rejilla (§31).
 *
 * ## Por qué un globo y no un panel
 *
 * La primera versión abría un panel de editor al lado. Funcionaba, pero no es lo que se pidió ni lo
 * que hace dbForge: allí es una ventanita flotante encima de la celda, se mira y se cierra. Un panel
 * roba espacio, se queda abierto y hay que ir a cerrarlo.
 *
 * Esto vive **dentro del webview de resultados**, que es lo que permite anclarlo a la celda: desde
 * el host no hay forma de poner nada flotando sobre un webview.
 *
 * ## Dónde se ancla
 *
 * En el punto donde se abrió el menú contextual. Se recuerda con un escucha de `contextmenu` en
 * captura sobre el documento del webview: es el único sitio donde ese dato existe, porque el evento
 * de comando de la rejilla no lleva coordenadas. Si por lo que sea no hay punto, se ancla al centro,
 * que es peor pero no deja el globo fuera de la pantalla.
 */

const useStyles = makeStyles({
    surface: {
        padding: 0,
        maxWidth: "460px",
        minWidth: "280px",
        maxHeight: "60vh",
        overflow: "auto",
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 8px 8px 12px",
        borderBottom: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        position: "sticky",
        top: 0,
        backgroundColor: "var(--vscode-editorWidget-background, var(--vscode-editor-background))",
        zIndex: 1,
    },
    headerText: {
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minWidth: 0,
    },
    title: {
        fontWeight: 600,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    subtitle: {
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    body: {
        padding: "6px 0",
    },
    row: {
        display: "grid",
        gridTemplateColumns: "minmax(90px, 40%) 1fr",
        gap: "10px",
        alignItems: "baseline",
        padding: "3px 12px",
    },
    rowMatch: {
        backgroundColor: "var(--vscode-list-inactiveSelectionBackground, transparent)",
    },
    label: {
        color: "var(--vscode-descriptionForeground)",
        fontSize: "12px",
        overflowWrap: "anywhere",
    },
    value: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "12px",
        overflowWrap: "anywhere",
    },
    null: {
        color: "var(--vscode-descriptionForeground)",
        fontStyle: "italic",
    },
    reason: {
        padding: "10px 12px 12px",
        color: "var(--vscode-descriptionForeground)",
        fontSize: "12px",
    },
    loading: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "14px 12px",
    },
});

/** Lo que el globo está mostrando ahora mismo. */
export interface ReferencedRowPopoverState {
    open: boolean;
    at: { x: number; y: number };
    /** `undefined` mientras se consulta. */
    result?: ReferencedRowResult;
}

export const closedReferencedRowPopover: ReferencedRowPopoverState = {
    open: false,
    at: { x: 0, y: 0 },
};

/**
 * Recuerda dónde se hizo el último clic derecho.
 *
 * El evento de comando de la rejilla no lleva coordenadas, y el globo tiene que salir **donde está
 * la celda**. Se escucha en fase de captura para que el dato esté guardado antes de que la rejilla
 * llame a `preventDefault` y abra su menú.
 */
export function useLastContextMenuPoint(): React.RefObject<{ x: number; y: number }> {
    const point = useRef({ x: 0, y: 0 });
    useEffect(() => {
        const remember = (event: MouseEvent) => {
            point.current = { x: event.clientX, y: event.clientY };
        };
        document.addEventListener("contextmenu", remember, true);
        return () => document.removeEventListener("contextmenu", remember, true);
    }, []);
    return point;
}

/** Estado del globo, con la apertura y el cierre ya resueltos. */
export function useReferencedRowPopover() {
    const [state, setState] = useState<ReferencedRowPopoverState>(closedReferencedRowPopover);
    const point = useLastContextMenuPoint();

    const close = useCallback(() => setState(closedReferencedRowPopover), []);

    /** Abre el globo en modo «consultando» y lo rellena cuando el host responde. */
    const open = useCallback(
        async (run: () => Promise<ReferencedRowResult>) => {
            const at = { ...point.current };
            setState({ open: true, at });
            try {
                const result = await run();
                // Solo se pinta si el globo sigue abierto en el mismo sitio: si mientras se
                // consultaba se pidió otra celda, mandan los datos de la nueva.
                setState((current) =>
                    current.open && current.at.x === at.x && current.at.y === at.y
                        ? { ...current, result }
                        : current,
                );
            } catch (error) {
                setState((current) =>
                    current.open
                        ? {
                              ...current,
                              result: {
                                  status: "error",
                                  origin: { schema: "", table: "", column: "", value: null },
                                  fields: [],
                                  message: error instanceof Error ? error.message : String(error),
                              },
                          }
                        : current,
                );
            }
        },
        [point],
    );

    return { state, open, close };
}

export interface ReferencedRowPopoverProps {
    state: ReferencedRowPopoverState;
    onClose: () => void;
}

export const ReferencedRowPopover: React.FC<ReferencedRowPopoverProps> = ({ state, onClose }) => {
    const styles = useStyles();

    if (!state.open) {
        return undefined;
    }

    const target = state.result?.target;
    const targetTable = target ? `${target.schema}.${target.table}` : undefined;
    const originTable = state.result?.origin.table
        ? `${state.result.origin.schema}.${state.result.origin.table}.${state.result.origin.column}`
        : state.result?.origin.column;

    return (
        <Popover
            open={true}
            positioning={{
                target: {
                    getBoundingClientRect: () =>
                        new DOMRect(state.at.x, state.at.y, 0, 0) as DOMRect,
                } as never,
                position: "below",
                align: "start",
                offset: 6,
                overflowBoundary: document.body,
                flipBoundary: document.body,
            }}
            onOpenChange={(_, data) => {
                if (!data.open) {
                    onClose();
                }
            }}>
            <PopoverSurface className={styles.surface}>
                <div className={styles.header}>
                    <div className={styles.headerText}>
                        <Text className={styles.title}>
                            {targetTable ?? Strings.referencedRow.title}
                        </Text>
                        {originTable ? (
                            <Text className={styles.subtitle}>{`${originTable} → ${
                                target?.column ?? ""
                            }`}</Text>
                        ) : undefined}
                    </div>
                    <Button
                        appearance="subtle"
                        size="small"
                        icon={<DismissRegular />}
                        aria-label={Strings.referencedRow.close}
                        onClick={onClose}
                    />
                </div>

                {!state.result ? (
                    <div className={styles.loading}>
                        <Spinner size="tiny" />
                        <Text>{Strings.referencedRow.loading}</Text>
                    </div>
                ) : state.result.status === "ok" ? (
                    <div className={styles.body}>
                        {state.result.fields.map((field) => (
                            <div
                                key={field.name}
                                className={`${styles.row} ${field.isMatch ? styles.rowMatch : ""}`}>
                                <Text className={styles.label}>{field.name}</Text>
                                <Text
                                    className={`${styles.value} ${field.isNull ? styles.null : ""}`}>
                                    {field.isNull
                                        ? "NULL"
                                        : field.value === ""
                                          ? "''"
                                          : field.value}
                                </Text>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.reason}>{reasonFor(state.result)}</div>
                )}
            </PopoverSurface>
        </Popover>
    );
};

/** El texto que ocupa el sitio del registro cuando no hay registro. */
function reasonFor(result: ReferencedRowResult): string {
    const target = result.target;
    switch (result.status) {
        case "noForeignKey":
            return Strings.referencedRow.noForeignKey(result.origin.column);
        case "unknownSource":
            return result.message ?? Strings.referencedRow.unknownSource(result.origin.column);
        case "compositeKey":
            return Strings.referencedRow.compositeKey(target?.constraint ?? "");
        case "nullValue":
            return Strings.referencedRow.nullValue;
        case "notFound":
            return Strings.referencedRow.notFound(target ? `${target.schema}.${target.table}` : "");
        default:
            return result.message ?? "";
    }
}
