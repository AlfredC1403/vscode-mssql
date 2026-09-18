/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { Badge, TableCellLayout, createTableColumn, makeStyles } from "@fluentui/react-components";

import { DatabaseUser } from "../../admin/sql/types";
import { DataTable } from "../common/dataTable";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { WebviewStrings as Loc } from "../strings";

const useStyles = makeStyles({
    mono: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "12px",
    },
    secondary: {
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    count: {
        fontVariantNumeric: "tabular-nums",
    },
});

/** Texto de autenticación, con respaldo para un valor que el motor añada en el futuro. */
function authenticationLabel(value: string): string {
    const known = Loc.users.authentication as Record<string, string>;
    return known[value.trim().toUpperCase()] ?? value;
}

/** Usuarios de la base de datos seleccionada (§8.3.1 del brief), en solo lectura. */
export const UsersView = () => {
    const styles = useStyles();
    const section = useAdminPanelSelector((state) => state?.users);

    const columns = useMemo(
        () => [
            createTableColumn<DatabaseUser>({
                columnId: "name",
                compare: (a, b) => a.name.localeCompare(b.name),
                renderHeaderCell: () => Loc.users.columns.name,
                renderCell: (user) => (
                    <TableCellLayout truncate>
                        <span className={styles.mono}>{user.name}</span>
                        {user.system && (
                            <Badge
                                appearance="outline"
                                color="informative"
                                style={{ marginLeft: "8px" }}>
                                {Loc.users.systemUser}
                            </Badge>
                        )}
                    </TableCellLayout>
                ),
            }),
            createTableColumn<DatabaseUser>({
                columnId: "type",
                compare: (a, b) => a.type.localeCompare(b.type),
                renderHeaderCell: () => Loc.users.columns.type,
                renderCell: (user) => Loc.users.types[user.type],
            }),
            createTableColumn<DatabaseUser>({
                columnId: "loginName",
                compare: (a, b) => a.loginName.localeCompare(b.loginName),
                renderHeaderCell: () => Loc.users.columns.loginName,
                renderCell: (user) =>
                    user.loginName ? (
                        <TableCellLayout truncate>
                            <span className={styles.mono}>{user.loginName}</span>
                        </TableCellLayout>
                    ) : (
                        <span className={styles.secondary}>{Loc.users.noLogin}</span>
                    ),
            }),
            createTableColumn<DatabaseUser>({
                columnId: "defaultSchema",
                compare: (a, b) => a.defaultSchema.localeCompare(b.defaultSchema),
                renderHeaderCell: () => Loc.users.columns.defaultSchema,
                renderCell: (user) => <span className={styles.mono}>{user.defaultSchema}</span>,
            }),
            createTableColumn<DatabaseUser>({
                columnId: "authentication",
                compare: (a, b) => a.authentication.localeCompare(b.authentication),
                renderHeaderCell: () => Loc.users.columns.authentication,
                renderCell: (user) => authenticationLabel(user.authentication),
            }),
            createTableColumn<DatabaseUser>({
                columnId: "roles",
                compare: (a, b) => a.roles.length - b.roles.length,
                renderHeaderCell: () => Loc.users.columns.roles,
                renderCell: (user) => (
                    <TableCellLayout truncate>
                        <span className={styles.secondary}>
                            {user.roles.length > 0 ? user.roles.join(", ") : Loc.common.none}
                        </span>
                    </TableCellLayout>
                ),
            }),
        ],
        [styles],
    );

    return (
        <DataTable<DatabaseUser>
            section={section}
            columns={columns}
            getRowId={(user) => user.name}
            getSearchText={(user) =>
                [user.name, user.loginName, user.defaultSchema, ...user.roles].join(" ")
            }
            searchPlaceholder={Loc.users.searchPlaceholder}
            emptyMessage={Loc.users.empty}
            legend={Loc.users.legend}
            columnSizing={{
                name: { minWidth: 180, defaultWidth: 220 },
                type: { minWidth: 120, defaultWidth: 140 },
                loginName: { minWidth: 150, defaultWidth: 180 },
                defaultSchema: { minWidth: 140, defaultWidth: 160 },
                authentication: { minWidth: 150, defaultWidth: 170 },
                roles: { minWidth: 200, defaultWidth: 260 },
            }}
        />
    );
};
