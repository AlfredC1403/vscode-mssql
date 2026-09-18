/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { Badge, TableCellLayout, createTableColumn, makeStyles } from "@fluentui/react-components";

import { SchemaInfo } from "../../admin/sql/types";
import { DataTable } from "../common/dataTable";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { WebviewStrings as Loc } from "../strings";

const useStyles = makeStyles({
    mono: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "12px",
    },
    count: {
        fontVariantNumeric: "tabular-nums",
    },
});

/** Esquemas con su propietario (§8.3.3 del brief), en solo lectura. */
export const SchemasView = () => {
    const styles = useStyles();
    const section = useAdminPanelSelector((state) => state?.schemas);

    const columns = useMemo(
        () => [
            createTableColumn<SchemaInfo>({
                columnId: "name",
                compare: (a, b) => a.name.localeCompare(b.name),
                renderHeaderCell: () => Loc.schemas.columns.name,
                renderCell: (schema) => (
                    <TableCellLayout truncate>
                        <span className={styles.mono}>{schema.name}</span>
                        {schema.system && (
                            <Badge
                                appearance="outline"
                                color="informative"
                                style={{ marginLeft: "8px" }}>
                                {Loc.schemas.systemSchema}
                            </Badge>
                        )}
                    </TableCellLayout>
                ),
            }),
            createTableColumn<SchemaInfo>({
                columnId: "owner",
                compare: (a, b) => a.owner.localeCompare(b.owner),
                renderHeaderCell: () => Loc.schemas.columns.owner,
                renderCell: (schema) => <span className={styles.mono}>{schema.owner}</span>,
            }),
            createTableColumn<SchemaInfo>({
                columnId: "objectCount",
                compare: (a, b) => a.objectCount - b.objectCount,
                renderHeaderCell: () => Loc.schemas.columns.objectCount,
                renderCell: (schema) => (
                    <span className={styles.count}>{schema.objectCount.toLocaleString()}</span>
                ),
            }),
        ],
        [styles],
    );

    return (
        <DataTable<SchemaInfo>
            section={section}
            columns={columns}
            getRowId={(schema) => schema.name}
            getSearchText={(schema) => `${schema.name} ${schema.owner}`}
            searchPlaceholder={Loc.schemas.searchPlaceholder}
            emptyMessage={Loc.schemas.empty}
            legend={Loc.schemas.legend}
            columnSizing={{
                name: { minWidth: 240, defaultWidth: 320 },
                owner: { minWidth: 200, defaultWidth: 260 },
                objectCount: { minWidth: 120, defaultWidth: 140 },
            }}
        />
    );
};
