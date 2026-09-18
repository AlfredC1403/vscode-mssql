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

import { Login } from "../../admin/sql/types";
import { DataTable } from "../common/dataTable";
import { CreatePrincipalDialog } from "./createPrincipalDialog";
import { AdminPanelContext } from "./adminPanelStateProvider";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { WebviewStrings as Loc } from "../strings";

const useStyles = makeStyles({
    name: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "12px",
    },
    secondary: {
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
    },
    roles: {
        fontSize: "11px",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    action: {
        minWidth: "auto",
    },
    rowActions: {
        display: "flex",
        gap: "4px",
    },
});

/**
 * Logins que SQL Server necesita para funcionar. Deshabilitar `sa` o una cuenta de servicio deja la
 * instancia o la propia extensión sin poder conectarse, así que el panel no ofrece el botón.
 */
const PROTECTED_LOGINS = new Set(["sa", "NT AUTHORITY\\SYSTEM", "NT SERVICE\\SQLSERVERAGENT"]);

function isProtected(login: string): boolean {
    return (
        PROTECTED_LOGINS.has(login) || login.startsWith("NT SERVICE\\") || login.startsWith("##")
    );
}

/** Logins del servidor (§8.1 del brief). Desde M6 también se crean y se borran. */
export const LoginsView = () => {
    const styles = useStyles();
    const context = useContext(AdminPanelContext);
    const section = useAdminPanelSelector((state) => state?.logins);
    const pending = useAdminPanelSelector((state) => state?.pendingChanges) ?? [];
    const databases = useAdminPanelSelector((state) => state?.databases?.data) ?? [];
    const [creating, setCreating] = useState(false);

    const columns = useMemo(
        () => [
            createTableColumn<Login>({
                columnId: "name",
                compare: (a, b) => a.name.localeCompare(b.name),
                renderHeaderCell: () => Loc.logins.columns.name,
                renderCell: (login) => (
                    <TableCellLayout truncate>
                        <span className={styles.name}>{login.name}</span>
                    </TableCellLayout>
                ),
            }),
            createTableColumn<Login>({
                columnId: "type",
                compare: (a, b) => a.type.localeCompare(b.type),
                renderHeaderCell: () => Loc.logins.columns.type,
                renderCell: (login) => Loc.logins.kinds[login.type],
            }),
            createTableColumn<Login>({
                columnId: "status",
                compare: (a, b) => Number(a.disabled) - Number(b.disabled),
                renderHeaderCell: () => Loc.logins.columns.status,
                renderCell: (login) => (
                    <Badge appearance="outline" color={login.disabled ? "danger" : "success"}>
                        {login.disabled ? Loc.logins.disabled : Loc.logins.enabled}
                    </Badge>
                ),
            }),
            createTableColumn<Login>({
                columnId: "defaultDatabase",
                compare: (a, b) => a.defaultDatabase.localeCompare(b.defaultDatabase),
                renderHeaderCell: () => Loc.logins.columns.defaultDatabase,
                renderCell: (login) => <span className={styles.name}>{login.defaultDatabase}</span>,
            }),
            createTableColumn<Login>({
                columnId: "policy",
                renderHeaderCell: () => Loc.logins.columns.policy,
                renderCell: (login) => {
                    // CHECK_POLICY y CHECK_EXPIRATION solo existen en logins SQL; en los de
                    // Windows las gobierna el dominio y mostrar «No» sería engañoso.
                    if (login.type !== "SQL_LOGIN") {
                        return (
                            <span className={styles.secondary}>
                                {Loc.logins.policyNotApplicable}
                            </span>
                        );
                    }
                    const flags = [
                        login.passwordPolicy ? Loc.logins.policyChecked : undefined,
                        login.passwordExpiration ? Loc.logins.expirationChecked : undefined,
                    ].filter(Boolean);
                    return flags.length > 0 ? (
                        flags.join(" · ")
                    ) : (
                        <span className={styles.secondary}>{Loc.common.none}</span>
                    );
                },
            }),
            createTableColumn<Login>({
                columnId: "roles",
                compare: (a, b) => a.serverRoles.length - b.serverRoles.length,
                renderHeaderCell: () => Loc.logins.columns.roles,
                renderCell: (login) => (
                    <TableCellLayout truncate>
                        <span className={styles.roles}>
                            {login.serverRoles.length > 0
                                ? login.serverRoles.join(", ")
                                : Loc.common.none}
                        </span>
                    </TableCellLayout>
                ),
            }),
            createTableColumn<Login>({
                columnId: "actions",
                renderHeaderCell: () => Loc.sessions.columns.actions,
                renderCell: (login) => {
                    const staged = pending.some(
                        (change) => change.kind === "loginEnabled" && change.subject === login.name,
                    );
                    const protectedLogin = isProtected(login.name);

                    return (
                        <Button
                            className={styles.action}
                            size="small"
                            appearance="subtle"
                            disabled={protectedLogin || staged}
                            title={
                                protectedLogin
                                    ? Loc.rowActions.protectedLogin
                                    : staged
                                      ? Loc.rowActions.staged
                                      : undefined
                            }
                            aria-label={Loc.rowActions.toggleAria(login.name, login.disabled)}
                            onClick={() =>
                                context?.stageChange({
                                    kind: "loginEnabled",
                                    login: login.name,
                                    enabled: login.disabled,
                                    createDate: login.createDate,
                                })
                            }>
                            {login.disabled ? Loc.rowActions.enable : Loc.rowActions.disable}
                        </Button>
                    );
                },
            }),
            // --- M6: restablecer la contraseña y borrar ---
            createTableColumn<Login>({
                columnId: "m6",
                renderHeaderCell: () => Loc.logins.columns.manage,
                renderCell: (login) => {
                    const protectedLogin = isProtected(login.name);
                    const resetStaged = pending.some(
                        (change) =>
                            change.kind === "resetPassword" && change.subject === login.name,
                    );
                    const dropStaged = pending.some(
                        (change) => change.kind === "dropLogin" && change.subject === login.name,
                    );
                    // Restablecer la contraseña solo tiene sentido en un login de SQL Server: uno de
                    // Windows la tiene en el dominio, no aquí.
                    const canReset = login.type === "SQL_LOGIN";

                    return (
                        <div className={styles.rowActions}>
                            <Button
                                className={styles.action}
                                size="small"
                                appearance="subtle"
                                disabled={!canReset || resetStaged}
                                title={
                                    !canReset
                                        ? Loc.rowActions.windowsLoginPassword
                                        : resetStaged
                                          ? Loc.rowActions.staged
                                          : undefined
                                }
                                aria-label={Loc.rowActions.resetPasswordAria(login.name)}
                                onClick={() =>
                                    context?.stageChange({
                                        kind: "resetPassword",
                                        login: login.name,
                                        mustChange: false,
                                        unlock: false,
                                    })
                                }>
                                {Loc.rowActions.resetPassword}
                            </Button>
                            <Button
                                className={styles.action}
                                size="small"
                                appearance="subtle"
                                disabled={protectedLogin || dropStaged}
                                title={
                                    protectedLogin
                                        ? Loc.rowActions.protectedLogin
                                        : dropStaged
                                          ? Loc.rowActions.staged
                                          : Loc.rowActions.dropLoginWarning
                                }
                                aria-label={Loc.rowActions.dropLoginAria(login.name)}
                                onClick={() =>
                                    context?.stageChange({
                                        kind: "dropLogin",
                                        login: login.name,
                                        createDate: login.createDate,
                                    })
                                }>
                                {Loc.rowActions.dropUser}
                            </Button>
                        </div>
                    );
                },
            }),
        ],
        [styles, context, pending],
    );

    return (
        <>
            <DataTable<Login>
                section={section}
                columns={columns}
                getRowId={(login) => login.sid || login.name}
                getSearchText={(login) =>
                    [
                        login.name,
                        Loc.logins.kinds[login.type],
                        login.defaultDatabase,
                        ...login.serverRoles,
                    ].join(" ")
                }
                searchPlaceholder={Loc.logins.searchPlaceholder}
                emptyMessage={Loc.logins.empty}
                legend={Loc.logins.legend}
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
                    // Los nombres de login de Windows son largos y son lo que más se lee.
                    name: { minWidth: 240, defaultWidth: 300 },
                    type: { minWidth: 120, defaultWidth: 140 },
                    status: { minWidth: 100, defaultWidth: 120 },
                    defaultDatabase: { minWidth: 120, defaultWidth: 150 },
                    policy: { minWidth: 110, defaultWidth: 130 },
                    roles: { minWidth: 160, defaultWidth: 220 },
                    actions: { minWidth: 120, defaultWidth: 130 },
                    m6: { minWidth: 170, defaultWidth: 190 },
                }}
            />
            <CreatePrincipalDialog
                open={creating}
                kind="login"
                relatedOptions={[]}
                secondaryOptions={databases.map((database) => database.name)}
                onCancel={() => setCreating(false)}
                onConfirm={(result) => {
                    setCreating(false);
                    context?.stageChange({
                        kind: "createLogin",
                        login: result.name,
                        checkPolicy: result.checkPolicy,
                        checkExpiration: result.checkExpiration,
                        mustChange: result.mustChange,
                        defaultDatabase: result.secondary || undefined,
                    });
                }}
            />
        </>
    );
};
