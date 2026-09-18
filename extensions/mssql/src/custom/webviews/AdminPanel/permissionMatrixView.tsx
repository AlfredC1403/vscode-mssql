/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import {
    Badge,
    Dropdown,
    Option,
    OptionGroup,
    TableCellLayout,
    createTableColumn,
    makeStyles,
} from "@fluentui/react-components";

import { EffectivePermission, PermissionGrantState } from "../../admin/sql/types";
import {
    computeEffectivePermissions,
    listMatrixPrincipals,
} from "../../sharedInterfaces/permissionMatrix";
import { SectionState } from "../../sharedInterfaces/adminPanel";
import { DataTable } from "../common/dataTable";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { WebviewStrings as Loc } from "../strings";

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        minWidth: 0,
    },
    picker: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
    },
    label: {
        fontSize: "12px",
        color: "var(--vscode-descriptionForeground)",
    },
    dropdown: {
        minWidth: "240px",
    },
    mono: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "12px",
    },
    origin: {
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
    },
    direct: {
        fontSize: "11px",
        fontWeight: 600,
        color: "var(--vscode-foreground)",
    },
    state: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "16px 0",
        fontSize: "12px",
        color: "var(--vscode-descriptionForeground)",
    },
});

/** Color de la insignia del estado. `DENY` en rojo, siempre visible. */
function stateColor(state: PermissionGrantState): "success" | "danger" | "warning" | "informative" {
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

/** Objeto sobre el que cae el permiso, con la columna cuando el permiso es de columna. */
function describeSecurable(permission: EffectivePermission): string {
    const className = Loc.permissionMatrix.classes[permission.securableClass];
    if (!permission.securable) {
        return className;
    }
    const target = permission.columnName
        ? `${permission.securable} (${permission.columnName})`
        : permission.securable;
    return `${className}: ${target}`;
}

/**
 * Cómo obtiene el principal el permiso: propio, o la cadena de roles por la que llega.
 *
 * `["supervisores", "lectores"]` se lee «hereda de supervisores, que hereda de lectores», que es
 * exactamente lo que el usuario necesita para saber dónde quitar el permiso.
 */
function describeOrigin(permission: EffectivePermission): string {
    if (permission.via.length === 0) {
        return Loc.permissionMatrix.direct;
    }
    return Loc.permissionMatrix.inherited(permission.via.join(Loc.permissionMatrix.chainSeparator));
}

/** Matriz de permisos efectivos de un principal (§10 del brief), en solo lectura. */
export const PermissionMatrixView = () => {
    const styles = useStyles();
    const section = useAdminPanelSelector((state) => state?.databasePermissions);
    const database = useAdminPanelSelector((state) => state?.selectedDatabase);
    const [principal, setPrincipal] = useState<string | undefined>(undefined);

    const data = section?.data;

    const principals = useMemo(
        () => (data ? listMatrixPrincipals(data.users, data.roles) : []),
        [data],
    );

    // Al cambiar de base cambia la lista de principales: el que estaba elegido puede no existir.
    useEffect(() => {
        if (principal && !principals.some((entry) => entry.name === principal)) {
            setPrincipal(undefined);
        }
    }, [principal, principals, database]);

    const permissions = useMemo(() => {
        if (!data || !principal) {
            return [];
        }
        return computeEffectivePermissions(principal, data.permissions, data.memberships);
    }, [data, principal]);

    const columns = useMemo(
        () => [
            createTableColumn<EffectivePermission>({
                columnId: "permission",
                compare: (a, b) => a.permission.localeCompare(b.permission),
                renderHeaderCell: () => Loc.permissionMatrix.columns.permission,
                renderCell: (permission) => (
                    // Hay permisos con nombres largos («VIEW ANY COLUMN MASTER KEY DEFINITION»),
                    // así que el nombre completo va también en el tooltip.
                    <TableCellLayout truncate title={permission.permission}>
                        <span className={styles.mono}>{permission.permission}</span>
                    </TableCellLayout>
                ),
            }),
            createTableColumn<EffectivePermission>({
                columnId: "securable",
                compare: (a, b) => describeSecurable(a).localeCompare(describeSecurable(b)),
                renderHeaderCell: () => Loc.permissionMatrix.columns.securable,
                renderCell: (permission) => (
                    <TableCellLayout truncate title={describeSecurable(permission)}>
                        {describeSecurable(permission)}
                    </TableCellLayout>
                ),
            }),
            createTableColumn<EffectivePermission>({
                columnId: "state",
                compare: (a, b) => a.state.localeCompare(b.state),
                renderHeaderCell: () => Loc.permissionMatrix.columns.state,
                renderCell: (permission) => (
                    <TableCellLayout truncate>
                        <Badge appearance="outline" color={stateColor(permission.state)}>
                            {Loc.serverPermissions.states[permission.state]}
                        </Badge>
                        {permission.conflict && (
                            <Badge
                                appearance="outline"
                                color="warning"
                                title={Loc.permissionMatrix.conflictTooltip}
                                style={{ marginLeft: "6px" }}>
                                {Loc.permissionMatrix.conflict}
                            </Badge>
                        )}
                    </TableCellLayout>
                ),
            }),
            createTableColumn<EffectivePermission>({
                columnId: "origin",
                compare: (a, b) => a.via.length - b.via.length,
                renderHeaderCell: () => Loc.permissionMatrix.columns.origin,
                renderCell: (permission) => (
                    <TableCellLayout truncate title={describeOrigin(permission)}>
                        <span
                            className={permission.via.length === 0 ? styles.direct : styles.origin}>
                            {describeOrigin(permission)}
                        </span>
                    </TableCellLayout>
                ),
            }),
        ],
        [styles],
    );

    const inheritedCount = permissions.filter((permission) => permission.via.length > 0).length;

    /** Estado que se pasa a la rejilla: el de la sección, con los permisos ya calculados. */
    const gridSection: SectionState<EffectivePermission[]> = {
        status: section?.status ?? "idle",
        errorMessage: section?.errorMessage,
        readAt: section?.readAt,
        data: permissions,
    };

    return (
        <div className={styles.root}>
            <div className={styles.picker}>
                <span className={styles.label}>{Loc.permissionMatrix.principalLabel}</span>
                <Dropdown
                    className={styles.dropdown}
                    size="small"
                    value={principal ?? ""}
                    selectedOptions={principal ? [principal] : []}
                    placeholder={Loc.permissionMatrix.principalPlaceholder}
                    disabled={principals.length === 0}
                    aria-label={Loc.permissionMatrix.principalLabel}
                    onOptionSelect={(_, selection) => setPrincipal(selection.optionValue)}>
                    <OptionGroup label={Loc.permissionMatrix.userGroup}>
                        {principals
                            .filter((entry) => entry.kind === "user")
                            .map((entry) => (
                                <Option key={`user:${entry.name}`} value={entry.name}>
                                    {entry.name}
                                </Option>
                            ))}
                    </OptionGroup>
                    <OptionGroup label={Loc.permissionMatrix.roleGroup}>
                        {principals
                            .filter((entry) => entry.kind === "role")
                            .map((entry) => (
                                <Option key={`role:${entry.name}`} value={entry.name}>
                                    {entry.name}
                                </Option>
                            ))}
                    </OptionGroup>
                </Dropdown>
                {principal && permissions.length > 0 && (
                    <span className={styles.label}>
                        {Loc.permissionMatrix.counts(permissions.length, inheritedCount)}
                    </span>
                )}
            </div>

            {principal ? (
                <DataTable<EffectivePermission>
                    section={gridSection}
                    columns={columns}
                    getRowId={(permission) =>
                        [
                            permission.permission,
                            permission.securableClass,
                            permission.securable,
                            permission.columnName,
                        ].join("::")
                    }
                    getSearchText={(permission) =>
                        [
                            permission.permission,
                            describeSecurable(permission),
                            describeOrigin(permission),
                        ].join(" ")
                    }
                    emptyMessage={Loc.permissionMatrix.empty}
                    legend={Loc.permissionMatrix.legend}
                    columnSizing={{
                        permission: { minWidth: 240, defaultWidth: 340 },
                        securable: { minWidth: 200, defaultWidth: 260 },
                        state: { minWidth: 150, defaultWidth: 170 },
                        origin: { minWidth: 240, defaultWidth: 340 },
                    }}
                />
            ) : (
                <div className={styles.state}>{Loc.permissionMatrix.noPrincipal}</div>
            )}
        </div>
    );
};
