/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { Badge, TableCellLayout, createTableColumn, makeStyles } from "@fluentui/react-components";

import { DatabaseRole } from "../../admin/sql/types";
import { DataTable } from "../common/dataTable";
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
});

/** Roles de la base de datos seleccionada (§8.3.2 del brief), en solo lectura. */
export const DatabaseRolesView = () => {
    const styles = useStyles();
    const section = useAdminPanelSelector((state) => state?.databaseRoles);

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
                renderCell: (role) => (
                    <TableCellLayout truncate>
                        <span className={styles.members}>
                            {role.applicationRole
                                ? Loc.databaseRoles.applicationRoleNote
                                : role.members.length > 0
                                  ? role.members.join(", ")
                                  : Loc.common.none}
                        </span>
                    </TableCellLayout>
                ),
            }),
        ],
        [styles],
    );

    return (
        <DataTable<DatabaseRole>
            section={section}
            columns={columns}
            getRowId={(role) => role.name}
            getSearchText={(role) => [role.name, role.owner, ...role.members].join(" ")}
            searchPlaceholder={Loc.databaseRoles.searchPlaceholder}
            emptyMessage={Loc.databaseRoles.empty}
            legend={Loc.databaseRoles.legend}
            columnSizing={{
                name: { minWidth: 180, defaultWidth: 220 },
                kind: { minWidth: 120, defaultWidth: 140 },
                owner: { minWidth: 120, defaultWidth: 150 },
                memberCount: { minWidth: 90, defaultWidth: 90 },
                members: { minWidth: 240, defaultWidth: 380 },
            }}
        />
    );
};
