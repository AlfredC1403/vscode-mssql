/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { Badge, TableCellLayout, createTableColumn, makeStyles } from "@fluentui/react-components";

import { ServerRole } from "../../admin/sql/types";
import { DataTable } from "../common/dataTable";
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
});

/** Roles de servidor (§8.2 del brief), en solo lectura. */
export const ServerRolesView = () => {
    const styles = useStyles();
    const section = useAdminPanelSelector((state) => state?.serverRoles);

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
                renderCell: (role) => (
                    <TableCellLayout truncate>
                        <span className={styles.members}>
                            {role.members.length > 0 ? role.members.join(", ") : Loc.common.none}
                        </span>
                    </TableCellLayout>
                ),
            }),
        ],
        [styles],
    );

    return (
        <DataTable<ServerRole>
            section={section}
            columns={columns}
            getRowId={(role) => role.name}
            getSearchText={(role) => [role.name, role.owner, ...role.members].join(" ")}
            searchPlaceholder={Loc.serverRoles.searchPlaceholder}
            emptyMessage={Loc.serverRoles.empty}
            legend={Loc.serverRoles.legend}
            columnSizing={{
                name: { minWidth: 180, defaultWidth: 220 },
                kind: { minWidth: 100, defaultWidth: 110 },
                owner: { minWidth: 120, defaultWidth: 150 },
                memberCount: { minWidth: 90, defaultWidth: 90 },
                members: { minWidth: 240, defaultWidth: 380 },
            }}
        />
    );
};
