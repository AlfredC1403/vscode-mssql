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

import { DatabaseRole } from "../../admin/sql/types";
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
    members: {
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    count: {
        fontVariantNumeric: "tabular-nums",
    },
    memberChips: {
        display: "flex",
        flexWrap: "wrap",
        gap: "4px",
        alignItems: "center",
    },
    memberChip: {
        minWidth: "auto",
        fontSize: "11px",
        fontFamily: "var(--vscode-editor-font-family, monospace)",
    },
});

/** Roles de la base de datos seleccionada (§8.3.2 del brief), en solo lectura. */
export const DatabaseRolesView = () => {
    const styles = useStyles();
    const context = useContext(AdminPanelContext);
    const section = useAdminPanelSelector((state) => state?.databaseRoles);
    const pending = useAdminPanelSelector((state) => state?.pendingChanges) ?? [];
    const [creating, setCreating] = useState(false);

    const columns = useMemo(
        () => [
            createTableColumn<DatabaseRole>({
                columnId: "name",
                compare: (a, b) => a.name.localeCompare(b.name),
                renderHeaderCell: () => Loc.databaseRoles.columns.name,
                renderCell: (role) => (
                    <TableCellLayout truncate>
                        <span className={styles.mono}>{role.name}</span>
                    </TableCellLayout>
                ),
            }),
            createTableColumn<DatabaseRole>({
                columnId: "kind",
                compare: (a, b) => Number(b.fixed) - Number(a.fixed),
                renderHeaderCell: () => Loc.databaseRoles.columns.kind,
                renderCell: (role) => {
                    if (role.applicationRole) {
                        return (
                            <Badge appearance="outline" color="warning">
                                {Loc.databaseRoles.applicationRole}
                            </Badge>
                        );
                    }
                    if (role.fixed) {
                        return Loc.databaseRoles.fixed;
                    }
                    // `public` no lo creó nadie: llamarlo «de usuario» sería falso.
                    return role.builtIn ? Loc.databaseRoles.builtIn : Loc.databaseRoles.userDefined;
                },
            }),
            createTableColumn<DatabaseRole>({
                columnId: "owner",
                compare: (a, b) => a.owner.localeCompare(b.owner),
                renderHeaderCell: () => Loc.databaseRoles.columns.owner,
                renderCell: (role) => <span className={styles.mono}>{role.owner}</span>,
            }),
            createTableColumn<DatabaseRole>({
                columnId: "memberCount",
                compare: (a, b) => a.members.length - b.members.length,
                renderHeaderCell: () => Loc.databaseRoles.columns.memberCount,
                renderCell: (role) => <span className={styles.count}>{role.members.length}</span>,
            }),
            createTableColumn<DatabaseRole>({
                columnId: "members",
                renderHeaderCell: () => Loc.databaseRoles.columns.members,
                renderCell: (role) => {
                    if (role.applicationRole) {
                        return (
                            <span className={styles.members}>
                                {Loc.databaseRoles.applicationRoleNote}
                            </span>
                        );
                    }
                    if (role.members.length === 0) {
                        return <span className={styles.members}>{Loc.common.none}</span>;
                    }

                    // Un botón por miembro: quitar a alguien de un rol es una acción de fila, y sin
                    // esto habría que abrir un formulario para algo que es un clic.
                    return (
                        <div className={styles.memberChips}>
                            {role.members.map((member) => {
                                const staged = pending.some(
                                    (change) =>
                                        change.kind === "databaseRoleMembership" &&
                                        change.subject === `${member} · ${role.name}`,
                                );
                                return (
                                    <Button
                                        key={member}
                                        className={styles.memberChip}
                                        size="small"
                                        appearance="outline"
                                        disabled={staged}
                                        title={
                                            staged
                                                ? Loc.rowActions.staged
                                                : Loc.rowActions.removeMemberAria(member, role.name)
                                        }
                                        aria-label={Loc.rowActions.removeMemberAria(
                                            member,
                                            role.name,
                                        )}
                                        onClick={() =>
                                            context?.stageChange({
                                                kind: "databaseRoleMembership",
                                                action: "DROP",
                                                role: role.name,
                                                member,
                                            })
                                        }>
                                        {member} ×
                                    </Button>
                                );
                            })}
                        </div>
                    );
                },
            }),
            // --- M6: borrar un rol propio. Los predefinidos de SQL Server no se borran. ---
            createTableColumn<DatabaseRole>({
                columnId: "m6",
                renderHeaderCell: () => Loc.sessions.columns.actions,
                renderCell: (role) => {
                    const staged = pending.some(
                        (change) =>
                            change.kind === "dropDatabaseRole" && change.subject === role.name,
                    );
                    return (
                        <Button
                            size="small"
                            appearance="subtle"
                            disabled={role.fixed || staged}
                            title={
                                role.fixed
                                    ? Loc.rowActions.systemObject
                                    : staged
                                      ? Loc.rowActions.staged
                                      : Loc.rowActions.dropRoleWarning
                            }
                            aria-label={Loc.rowActions.dropRoleAria(role.name)}
                            onClick={() =>
                                context?.stageChange({ kind: "dropDatabaseRole", role: role.name })
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
            <DataTable<DatabaseRole>
                section={section}
                columns={columns}
                getRowId={(role) => role.name}
                getSearchText={(role) => [role.name, role.owner, ...role.members].join(" ")}
                searchPlaceholder={Loc.databaseRoles.searchPlaceholder}
                emptyMessage={Loc.databaseRoles.empty}
                legend={Loc.databaseRoles.legend}
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
                    kind: { minWidth: 120, defaultWidth: 140 },
                    owner: { minWidth: 120, defaultWidth: 150 },
                    memberCount: { minWidth: 90, defaultWidth: 90 },
                    members: { minWidth: 240, defaultWidth: 340 },
                    m6: { minWidth: 90, defaultWidth: 100 },
                }}
            />
            <CreatePrincipalDialog
                open={creating}
                kind="databaseRole"
                relatedOptions={[]}
                secondaryOptions={[]}
                onCancel={() => setCreating(false)}
                onConfirm={(result) => {
                    setCreating(false);
                    context?.stageChange({
                        kind: "createDatabaseRole",
                        role: result.name,
                        owner: result.related || undefined,
                    });
                }}
            />
        </>
    );
};
