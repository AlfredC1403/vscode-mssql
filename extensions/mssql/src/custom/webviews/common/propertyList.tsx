/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { makeStyles, mergeClasses, Text } from "@fluentui/react-components";

/**
 * Bloque de propiedades en tarjeta, al estilo de la hoja de propiedades de SSMS o dbForge.
 *
 * Es el componente que van a reutilizar todos los paneles de administración para mostrar
 * atributos de un objeto, así que conviene que la densidad y los bordes estén decididos aquí y
 * no en cada panel.
 *
 * **Densidad: filas de 32 px, no de 44.** El §14 del brief fija 44 px, pero esa medida es para
 * *filas de datos* —listas y la matriz de permisos, donde la fila es un elemento que se
 * selecciona y tiene acciones—. En un bloque de propiedades, 44 px separa tanto la etiqueta de su
 * valor que cuesta seguir la línea, que es justo el problema que tenía la primera versión de este
 * panel. Aquí manda la legibilidad: filas de 32 px con separadores de 1 px.
 */
const useStyles = makeStyles({
    card: {
        border: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        borderRadius: "4px",
        backgroundColor: "var(--vscode-editorWidget-background, var(--vscode-editor-background))",
        overflow: "hidden",
    },
    sectionHeader: {
        display: "flex",
        alignItems: "center",
        minHeight: "30px",
        padding: "0 12px",
        backgroundColor: "var(--vscode-sideBarSectionHeader-background, transparent)",
        borderBottom: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--vscode-descriptionForeground)",
    },
    sectionHeaderSubsequent: {
        borderTop: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
    },
    row: {
        display: "grid",
        gridTemplateColumns: "150px minmax(0, 1fr)",
        alignItems: "center",
        columnGap: "12px",
        minHeight: "32px",
        padding: "0 12px",
        // Separador entre filas, muy bajo contraste: guía la vista sin hacer ruido.
        borderTop: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        ":first-of-type": {
            borderTop: "none",
        },
    },
    label: {
        fontSize: "12px",
        color: "var(--vscode-descriptionForeground)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    value: {
        fontSize: "13px",
        color: "var(--vscode-foreground)",
        overflowWrap: "anywhere",
        margin: 0,
    },
    mono: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "12px",
    },
});

/** Una propiedad. `mono` para identificadores, versiones y cualquier valor técnico. */
export interface PropertyRow {
    label: string;
    value: string | undefined;
    mono?: boolean;
}

/** Un grupo de propiedades con su título. */
export interface PropertySection {
    title: string;
    rows: PropertyRow[];
}

export interface PropertyListProps {
    sections: PropertySection[];
    /** Ancho máximo de la tarjeta. Por defecto se adapta a un ancho cómodo de lectura. */
    maxWidth?: string;
}

/**
 * Renderiza los grupos que tengan al menos una fila con valor. Los valores vacíos se descartan,
 * y un grupo que se queda sin filas no se dibuja.
 */
export const PropertyList: React.FC<PropertyListProps> = ({ sections, maxWidth = "620px" }) => {
    const styles = useStyles();

    const visible = sections
        .map((section) => ({ ...section, rows: section.rows.filter((row) => !!row.value) }))
        .filter((section) => section.rows.length > 0);

    if (visible.length === 0) {
        return undefined;
    }

    return (
        <div className={styles.card} style={{ maxWidth }}>
            {visible.map((section, sectionIndex) => (
                <React.Fragment key={section.title}>
                    <div
                        className={mergeClasses(
                            styles.sectionHeader,
                            sectionIndex > 0 && styles.sectionHeaderSubsequent,
                        )}>
                        {section.title}
                    </div>
                    <dl style={{ margin: 0 }}>
                        {section.rows.map((row) => (
                            <div key={row.label} className={styles.row}>
                                <dt className={styles.label} title={row.label}>
                                    {row.label}
                                </dt>
                                <dd className={mergeClasses(styles.value, row.mono && styles.mono)}>
                                    <Text>{row.value}</Text>
                                </dd>
                            </div>
                        ))}
                    </dl>
                </React.Fragment>
            ))}
        </div>
    );
};
