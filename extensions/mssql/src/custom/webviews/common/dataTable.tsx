/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { useMemo, useState } from "react";
import {
    DataGrid,
    DataGridBody,
    DataGridCell,
    DataGridHeader,
    DataGridHeaderCell,
    DataGridRow,
    Input,
    TableColumnSizingOptions,
    MessageBar,
    MessageBarBody,
    Spinner,
    TableColumnDefinition,
    Text,
    makeStyles,
} from "@fluentui/react-components";
import { SearchRegular } from "@fluentui/react-icons";

import { SectionState } from "../../sharedInterfaces/adminPanel";
import { WebviewStrings as Loc } from "../strings";

/**
 * Rejilla de solo lectura para las listas de administración, sobre el `DataGrid` de Fluent, que
 * es el componente que el upstream usa para tablas que no son resultados de consulta
 * (`TableDesigner`, `RestoreDatabase`, `SchemaCompare`).
 *
 * No se usa `FluentSlickGrid`: ese está pensado para la rejilla de resultados, con virtualización
 * y redimensionado de columnas, y trae un peso que estas listas no necesitan.
 *
 * Aquí sí van **filas de 44 px**, como fija el §14 del brief: son filas de datos, seleccionables y
 * con acciones a partir de M5. El bloque de propiedades usa 32 px por otras razones, explicadas en
 * `propertyList.tsx`.
 */
const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "100%",
        minWidth: 0,
    },
    filterBar: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
    },
    search: {
        minWidth: "260px",
        maxWidth: "360px",
    },
    count: {
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
    },
    legend: {
        marginLeft: "auto",
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
    },
    /**
     * La tarjeta pone el borde, y el desplazamiento va **dentro**, en un elemento sin borde.
     *
     * No es cosmética: `DataGrid` reparte los anchos de columna según el ancho de caja de su
     * contenedor, que incluye el borde. Si el borde estuviera en el mismo elemento que hace scroll,
     * la tabla saldría 2 px más ancha que el hueco y la rejilla mostraría una barra de
     * desplazamiento horizontal aunque todo quepa.
     */
    gridCard: {
        border: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        borderRadius: "4px",
        overflow: "hidden",
        backgroundColor: "var(--vscode-editorWidget-background, var(--vscode-editor-background))",
    },
    gridScroll: {
        overflowX: "auto",
    },
    grid: {
        minWidth: "100%",
    },
    headerCell: {
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        color: "var(--vscode-descriptionForeground)",
    },
    row: {
        minHeight: "44px",
    },
    state: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "16px 0",
        fontSize: "12px",
        color: "var(--vscode-descriptionForeground)",
    },
    notice: {
        maxWidth: "720px",
    },
});

export interface DataTableProps<T> {
    /** Estado de la sección: decide si se pinta la rejilla, el cargando o el error. */
    section: SectionState<T[]>;
    columns: TableColumnDefinition<T>[];
    /** Clave estable de cada fila, para que React no reordene mal. */
    getRowId: (item: T) => string;
    /**
     * Texto sobre el que filtra el buscador. Si no se pasa, no se muestra el buscador.
     * Se compara en minúsculas y sin acentos.
     */
    getSearchText?: (item: T) => string;
    /** Placeholder del buscador. */
    searchPlaceholder?: string;
    /** Leyenda alineada a la derecha de la barra de filtros (§14 del brief). */
    legend?: React.ReactNode;
    /**
     * Acciones de la sección, junto al recuento: el botón de crear, por ejemplo.
     *
     * Va aparte de `legend` a propósito: una leyenda es texto explicativo y un botón no lo es, así
     * que meterlo ahí haría que un lector de pantalla lo anunciara como parte de la explicación.
     */
    toolbar?: React.ReactNode;
    /** Aviso encima de la rejilla, para explicar una lectura parcial. */
    notice?: React.ReactNode;
    /** Texto cuando la sección cargó pero no hay filas. */
    emptyMessage?: string;
    /**
     * Anchos por columna. Sin esto, `DataGrid` reparte el ancho a partes iguales y las columnas
     * con identificadores largos (`NT AUTHORITY\NETWORK SERVICE`) se recortan mientras las de
     * valores cortos sobran espacio.
     */
    columnSizing?: TableColumnSizingOptions;
}

/** Normaliza para buscar: minúsculas y sin diacríticos, así «Administración» encuentra «administracion». */
function normalize(value: string): string {
    return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function DataTable<T>({
    section,
    columns,
    getRowId,
    getSearchText,
    searchPlaceholder,
    legend,
    toolbar,
    notice,
    emptyMessage,
    columnSizing,
}: DataTableProps<T>) {
    const styles = useStyles();
    const [query, setQuery] = useState("");

    const items = section.data ?? [];
    const filtered = useMemo(() => {
        if (!getSearchText || !query.trim()) {
            return items;
        }
        const needle = normalize(query.trim());
        return items.filter((item) => normalize(getSearchText(item)).includes(needle));
    }, [items, query, getSearchText]);

    if (section.status === "loading" || section.status === "idle") {
        return (
            <div className={styles.state}>
                <Spinner size="tiny" />
                <Text>{Loc.common.loading}</Text>
            </div>
        );
    }

    if (section.status === "error") {
        return (
            <MessageBar className={styles.notice} intent="error" role="alert">
                <MessageBarBody>{section.errorMessage ?? Loc.common.unknownError}</MessageBarBody>
            </MessageBar>
        );
    }

    return (
        <div className={styles.root}>
            {notice}
            <div className={styles.filterBar}>
                {getSearchText && (
                    <Input
                        className={styles.search}
                        size="small"
                        value={query}
                        onChange={(_, data) => setQuery(data.value)}
                        contentBefore={<SearchRegular />}
                        placeholder={searchPlaceholder ?? Loc.common.searchPlaceholder}
                        aria-label={searchPlaceholder ?? Loc.common.searchPlaceholder}
                    />
                )}
                <span className={styles.count}>
                    {query.trim()
                        ? Loc.common.countFiltered(filtered.length, items.length)
                        : Loc.common.count(items.length)}
                </span>
                {toolbar}
                {legend && <span className={styles.legend}>{legend}</span>}
            </div>

            {filtered.length === 0 ? (
                <div className={styles.state}>
                    <Text>
                        {query.trim() ? Loc.common.noMatches : (emptyMessage ?? Loc.common.empty)}
                    </Text>
                </div>
            ) : (
                <div className={styles.gridCard}>
                    <div className={styles.gridScroll}>
                        <DataGrid
                            className={styles.grid}
                            items={filtered}
                            columns={columns}
                            getRowId={getRowId}
                            sortable
                            resizableColumns
                            columnSizingOptions={columnSizing}
                            size="small">
                            <DataGridHeader>
                                <DataGridRow>
                                    {({ renderHeaderCell }) => (
                                        <DataGridHeaderCell className={styles.headerCell}>
                                            {renderHeaderCell()}
                                        </DataGridHeaderCell>
                                    )}
                                </DataGridRow>
                            </DataGridHeader>
                            <DataGridBody<T>>
                                {({ item, rowId }) => (
                                    <DataGridRow<T> key={rowId} className={styles.row}>
                                        {({ renderCell }) => (
                                            <DataGridCell>{renderCell(item)}</DataGridCell>
                                        )}
                                    </DataGridRow>
                                )}
                            </DataGridBody>
                        </DataGrid>
                    </div>
                </div>
            )}
        </div>
    );
}
