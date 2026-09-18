/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { makeStyles, Text } from "@fluentui/react-components";

/**
 * Estructura común de los paneles del fork, según el §14 del brief:
 *
 * - Cabecera con el título, una línea de contexto y los botones de acción a la derecha.
 * - Cuerpo desplazable.
 * - Al pie, un cajón fijo que aparece **solo** cuando hay algo que mostrar. En M2 nunca aparece;
 *   desde M5 llevará el script generado con su insignia de cambios pendientes.
 *
 * Todos los colores salen de variables `--vscode-*` del tema activo, así que el panel sigue al
 * tema sin paleta propia. Botones de 30 px, texto base de 13 px y secundario de 11 px.
 */
const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-foreground)",
        fontFamily: "var(--vscode-font-family)",
        fontSize: "13px",
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        // Compacta: la cabecera orienta, no protagoniza.
        padding: "10px 16px",
        borderBottom: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        backgroundColor: "var(--vscode-editorWidget-background, var(--vscode-editor-background))",
        flexShrink: 0,
    },
    headerText: {
        display: "flex",
        flexDirection: "column",
        gap: "1px",
        minWidth: 0,
    },
    title: {
        fontSize: "14px",
        fontWeight: 600,
        color: "var(--vscode-foreground)",
        lineHeight: "18px",
    },
    context: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0 8px",
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
        lineHeight: "15px",
    },
    contextSeparator: {
        opacity: 0.45,
    },
    actions: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexShrink: 0,
    },
    body: {
        flexGrow: 1,
        overflowY: "auto",
        padding: "16px",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        alignItems: "flex-start",
    },
    drawer: {
        flexShrink: 0,
        borderTop: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        backgroundColor: "var(--vscode-editorWidget-background, var(--vscode-editor-background))",
        padding: "12px 16px",
    },
});

export interface PanelShellProps {
    /** Título del panel. */
    title: string;
    /**
     * Línea de contexto bajo el título: servidor, base de datos, cuántos elementos, cuándo se
     * leyó. Se renderiza separada por puntos medios; las entradas vacías se descartan.
     */
    contextItems?: (string | undefined)[];
    /** Botones de acción, alineados a la derecha de la cabecera. */
    actions?: React.ReactNode;
    /** Contenido del cajón inferior. Si no se pasa, el cajón no se renderiza. */
    drawer?: React.ReactNode;
    children: React.ReactNode;
}

export const PanelShell: React.FC<PanelShellProps> = ({
    title,
    contextItems,
    actions,
    drawer,
    children,
}) => {
    const styles = useStyles();
    const items = (contextItems ?? []).filter((item): item is string => !!item);

    return (
        <div className={styles.root}>
            <header className={styles.header}>
                <div className={styles.headerText}>
                    <Text as="h1" className={styles.title}>
                        {title}
                    </Text>
                    {items.length > 0 && (
                        <div className={styles.context}>
                            {items.map((item, index) => (
                                <React.Fragment key={item}>
                                    {index > 0 && (
                                        <span aria-hidden className={styles.contextSeparator}>
                                            ·
                                        </span>
                                    )}
                                    <span>{item}</span>
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>
                {actions && <div className={styles.actions}>{actions}</div>}
            </header>
            <div className={styles.body}>{children}</div>
            {drawer && <div className={styles.drawer}>{drawer}</div>}
        </div>
    );
};
