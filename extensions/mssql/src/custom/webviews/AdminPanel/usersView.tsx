/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useContext, useMemo, useState } from "react";
import {
    Badge,
    Button,
    TableCellLayout,
    createTableColumn,
    makeStyles,
} from "@fluentui/react-components";
import { AddRegular } from "@fluentui/react-icons";

import { DatabaseUser } from "../../admin/sql/types";
import { DataTable } from "../common/dataTable";
import { CreatePrincipalDialog } from "./createPrincipalDialog";
import { AdminPanelContext } from "./adminPanelStateProvider";
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
    action: {
        minWidth: "auto",
        color: "var(--vscode-errorForeground)",
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
    const context = useContext(AdminPanelContext);
    const section = useAdminPanelSelector((state) => state?.users);
    const pending = useAdminPanelSelector((state) => state?.pendingChanges) ?? [];
    const logins = useAdminPanelSelector((state) => state?.logins?.data) ?? [];
    const schemas = useAdminPanelSelector((state) => state?.schemas?.data) ?? [];
    const [creating, setCreating] = useState(false);

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
            createTableColumn<DatabaseUser>({
                columnId: "actions",
                renderHeaderCell: () => Loc.sessions.columns.actions,
                renderCell: (user) => {
                    const staged = pending.some(
                        (change) => change.kind === "dropUser" && change.subject === user.name,
                    );

                    return (
                        <Button
                            className={styles.action}
                            size="small"
                            appearance="subtle"
                            // dbo, guest, sys e INFORMATION_SCHEMA los crea SQL Server: no se borran.
                            disabled={user.system || staged}
                            title={
                                user.system
                                    ? Loc.rowActions.systemObject
                                    : staged
                                      ? Loc.rowActions.staged
                                      : Loc.rowActions.dropUserWarning
                            }
                            aria-label={Loc.rowActions.dropUserAria(user.name)}
                            onClick={() =>
                                context?.stageChange({
                                    kind: "dropUser",
                                    user: user.name,
                                    createDate: user.createDate,
                                })
                            }>
                            {Loc.rowActions.dropUser}
                        </Button>
                    );
                },
            }),
        ],
        [styles, context, pending],
    );

    return (
        <>
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
                toolbar={
                    <Button
                        size="small"
                        appearance="primary"
                        icon={<AddRegular />}
                        onClick={() => setCreating(true)}>
                        {Loc.create.newButton}
                    </Button>
                }
                columnSizing={{
                    name: { minWidth: 180, defaultWidth: 220 },
                    type: { minWidth: 120, defaultWidth: 140 },
                    loginName: { minWidth: 150, defaultWidth: 180 },
                    defaultSchema: { minWidth: 140, defaultWidth: 160 },
                    authentication: { minWidth: 150, defaultWidth: 170 },
                    roles: { minWidth: 180, defaultWidth: 220 },
                    actions: { minWidth: 100, defaultWidth: 110 },
                }}
            />
            <CreatePrincipalDialog
                open={creating}
                kind="user"
                relatedOptions={logins.map((login) => login.name)}
                secondaryOptions={schemas.map((schema) => schema.name)}
                onCancel={() => setCreating(false)}
                onConfirm={(result) => {
                    setCreating(false);
                    context?.stageChange({
                        kind: "createUser",
                        user: result.name,
                        login: result.related || undefined,
                        defaultSchema: result.secondary || undefined,
                    });
                }}
            />
        </>
    );
};
