/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { Badge, TableCellLayout, createTableColumn, makeStyles } from "@fluentui/react-components";

import { ServerPermission } from "../../admin/sql/types";
import { DataTable } from "../common/dataTable";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { WebviewStrings as Loc } from "../strings";

const useStyles = makeStyles({
    mono: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "12px",
    },
});

/** Color de la insignia según el estado. `DENY` gana siempre, y se ve. */
function stateColor(
    state: ServerPermission["state"],
): "success" | "danger" | "warning" | "informative" {
    switch (state) {
        case "GRANT":
            return "success";
        case "DENY":
            return "danger";
        case "GRANT_WITH_GRANT_OPTION":
            return "warning";
        default:
            return "informative";
    }
}

/**
 * Objeto sobre el que cae el permiso, listo para mostrar.
 *
 * Sin esto, los cuatro `CONNECT` que `public` tiene sobre los puntos de conexión de fábrica salen
 * como cuatro filas idénticas.
 */
function describeSecurable(permission: ServerPermission): string {
    const className = Loc.serverPermissions.securableClasses[permission.securableClass];
    return permission.securable ? `${className}: ${permission.securable}` : className;
}

/** Permisos explícitos a nivel de servidor (§8.3 del brief), en solo lectura. */
export const ServerPermissionsView = () => {
    const styles = useStyles();
    const section = useAdminPanelSelector((state) => state?.serverPermissions);

    const columns = useMemo(
        () => [
            createTableColumn<ServerPermission>({
                columnId: "grantee",
                compare: (a, b) => a.grantee.localeCompare(b.grantee),
                renderHeaderCell: () => Loc.serverPermissions.columns.grantee,
                renderCell: (permission) => (
                    <TableCellLayout truncate>
                        <span className={styles.mono}>{permission.grantee}</span>
                    </TableCellLayout>
                ),
            }),
            createTableColumn<ServerPermission>({
                columnId: "permission",
                compare: (a, b) => a.permission.localeCompare(b.permission),
                renderHeaderCell: () => Loc.serverPermissions.columns.permission,
                renderCell: (permission) => (
                    <TableCellLayout truncate>
                        <span className={styles.mono}>{permission.permission}</span>
                    </TableCellLayout>
                ),
            }),
            createTableColumn<ServerPermission>({
                columnId: "securable",
                compare: (a, b) => describeSecurable(a).localeCompare(describeSecurable(b)),
                renderHeaderCell: () => Loc.serverPermissions.columns.securable,
                renderCell: (permission) => (
                    <TableCellLayout truncate title={describeSecurable(permission)}>
                        {describeSecurable(permission)}
                    </TableCellLayout>
                ),
            }),
            createTableColumn<ServerPermission>({
                columnId: "state",
                compare: (a, b) => a.state.localeCompare(b.state),
                renderHeaderCell: () => Loc.serverPermissions.columns.state,
                renderCell: (permission) => (
                    <Badge appearance="outline" color={stateColor(permission.state)}>
                        {Loc.serverPermissions.states[permission.state]}
                    </Badge>
                ),
            }),
        ],
        [styles],
    );

    return (
        <DataTable<ServerPermission>
            section={section}
            columns={columns}
            // El objeto entra en la clave: un mismo principal puede tener el mismo permiso sobre
            // varios objetos, y sin él habría filas con la misma clave.
            getRowId={(permission) =>
                [
                    permission.grantee,
                    permission.permission,
                    permission.securableClass,
                    permission.securable,
                    permission.state,
                ].join("::")
            }
            getSearchText={(permission) =>
                [
                    permission.grantee,
                    permission.permission,
                    describeSecurable(permission),
                    Loc.serverPermissions.states[permission.state],
                ].join(" ")
            }
            searchPlaceholder={Loc.serverPermissions.searchPlaceholder}
            emptyMessage={Loc.serverPermissions.empty}
            legend={Loc.serverPermissions.legend}
            columnSizing={{
                grantee: { minWidth: 200, defaultWidth: 260 },
                permission: { minWidth: 180, defaultWidth: 260 },
                securable: { minWidth: 200, defaultWidth: 280 },
                state: { minWidth: 140, defaultWidth: 180 },
            }}
        />
    );
};
