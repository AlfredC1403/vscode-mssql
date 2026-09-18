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

import { ServerRole } from "../../admin/sql/types";
import { DataTable } from "../common/dataTable";
import { CreatePrincipalDialog } from "./createPrincipalDialog";
import { AdminPanelContext } from "./adminPanelStateProvider";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { WebviewStrings as Loc } from "../strings";

/**
 * Roles que conceden control total del servidor. El §14 del brief los quiere en color de peligro:
 * quien está en `sysadmin` puede hacer cualquier cosa, y eso tiene que salir a la vista.
 */
const DANGEROUS_ROLES = new Set(["sysadmin", "securityadmin"]);

const useStyles = makeStyles({
    name: {
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

/** Roles de servidor (§8.2 del brief), en solo lectura. */
export const ServerRolesView = () => {
    const styles = useStyles();
    const context = useContext(AdminPanelContext);
    const section = useAdminPanelSelector((state) => state?.serverRoles);
    const pending = useAdminPanelSelector((state) => state?.pendingChanges) ?? [];
    const [creating, setCreating] = useState(false);

    const columns = useMemo(
        () => [
            createTableColumn<ServerRole>({
                columnId: "name",
                compare: (a, b) => a.name.localeCompare(b.name),
                renderHeaderCell: () => Loc.serverRoles.columns.name,
                renderCell: (role) => (
                    <TableCellLayout truncate>
                        <span className={styles.name}>{role.name}</span>
                        {DANGEROUS_ROLES.has(role.name) && (
                            <Badge
                                appearance="outline"
                                color="danger"
                                title={Loc.serverRoles.dangerous}
                                style={{ marginLeft: "8px" }}>
                                !
                            </Badge>
                        )}
                    </TableCellLayout>
                ),
            }),
            createTableColumn<ServerRole>({
                columnId: "kind",
                compare: (a, b) => Number(b.fixed) - Number(a.fixed),
                renderHeaderCell: () => Loc.serverRoles.columns.kind,
                renderCell: (role) =>
                    role.fixed ? Loc.serverRoles.fixed : Loc.serverRoles.userDefined,
            }),
            createTableColumn<ServerRole>({
                columnId: "owner",
                compare: (a, b) => a.owner.localeCompare(b.owner),
                renderHeaderCell: () => Loc.serverRoles.columns.owner,
                renderCell: (role) => <span className={styles.name}>{role.owner}</span>,
            }),
            createTableColumn<ServerRole>({
                columnId: "memberCount",
                compare: (a, b) => a.members.length - b.members.length,
                renderHeaderCell: () => Loc.serverRoles.columns.memberCount,
                renderCell: (role) => <span className={styles.count}>{role.members.length}</span>,
            }),
            createTableColumn<ServerRole>({
                columnId: "members",
                renderHeaderCell: () => Loc.serverRoles.columns.members,
                renderCell: (role) => {
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
                                        change.kind === "serverRoleMembership" &&
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
                                                kind: "serverRoleMembership",
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
            createTableColumn<ServerRole>({
                columnId: "m6",
                renderHeaderCell: () => Loc.sessions.columns.actions,
                renderCell: (role) => {
                    const staged = pending.some(
                        (change) =>
                            change.kind === "dropServerRole" && change.subject === role.name,
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
                                context?.stageChange({ kind: "dropServerRole", role: role.name })
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
            <DataTable<ServerRole>
                section={section}
                columns={columns}
                getRowId={(role) => role.name}
                getSearchText={(role) => [role.name, role.owner, ...role.members].join(" ")}
                searchPlaceholder={Loc.serverRoles.searchPlaceholder}
                emptyMessage={Loc.serverRoles.empty}
                legend={Loc.serverRoles.legend}
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
                    kind: { minWidth: 100, defaultWidth: 110 },
                    owner: { minWidth: 120, defaultWidth: 150 },
                    memberCount: { minWidth: 90, defaultWidth: 90 },
                    members: { minWidth: 240, defaultWidth: 340 },
                    m6: { minWidth: 90, defaultWidth: 100 },
                }}
            />
            <CreatePrincipalDialog
                open={creating}
                kind="serverRole"
                relatedOptions={[]}
                secondaryOptions={[]}
                onCancel={() => setCreating(false)}
                onConfirm={(result) => {
                    setCreating(false);
                    context?.stageChange({
                        kind: "createServerRole",
                        role: result.name,
                        owner: result.related || undefined,
                    });
                }}
            />
        </>
    );
};
