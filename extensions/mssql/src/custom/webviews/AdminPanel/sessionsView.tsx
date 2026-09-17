/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import {
    Badge,
    MessageBar,
    MessageBarBody,
    TableCellLayout,
    createTableColumn,
    makeStyles,
} from "@fluentui/react-components";

import { ActiveSession } from "../../admin/sql/types";
import { looksLikeMissingViewServerState } from "../../admin/sql/queries/sessions";
import { DataTable } from "../common/dataTable";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { WebviewStrings as Loc } from "../strings";

const useStyles = makeStyles({
    mono: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "12px",
    },
    number: {
        fontVariantNumeric: "tabular-nums",
        fontSize: "12px",
    },
    statement: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "420px",
        display: "inline-block",
    },
    notice: {
        maxWidth: "720px",
    },
});

/** Recorta la sentencia a una línea para la rejilla; el texto completo va en el tooltip. */
function oneLine(statement: string): string {
    return statement.replace(/\s+/g, " ").trim();
}

function formatMoment(isoTimestamp: string): string {
    if (!isoTimestamp) {
        return "";
    }
    const parsed = new Date(isoTimestamp);
    return Number.isNaN(parsed.getTime()) ? isoTimestamp : parsed.toLocaleTimeString();
}

/** Sesiones activas (§8.5 del brief), en solo lectura. */
export const SessionsView = () => {
    const styles = useStyles();
    const section = useAdminPanelSelector((state) => state?.sessions);

    const columns = useMemo(
        () => [
            createTableColumn<ActiveSession>({
                columnId: "sessionId",
                compare: (a, b) => a.sessionId - b.sessionId,
                renderHeaderCell: () => Loc.sessions.columns.sessionId,
                renderCell: (session) => (
                    <TableCellLayout truncate>
                        <span className={styles.number}>{session.sessionId}</span>
                        {session.isCurrentSession && (
                            <Badge
                                appearance="outline"
                                color="informative"
                                style={{ marginLeft: "8px" }}>
                                {Loc.sessions.currentSession}
                            </Badge>
                        )}
                    </TableCellLayout>
                ),
            }),
            createTableColumn<ActiveSession>({
                columnId: "loginName",
                compare: (a, b) => a.loginName.localeCompare(b.loginName),
                renderHeaderCell: () => Loc.sessions.columns.loginName,
                renderCell: (session) => <span className={styles.mono}>{session.loginName}</span>,
            }),
            createTableColumn<ActiveSession>({
                columnId: "hostName",
                compare: (a, b) => a.hostName.localeCompare(b.hostName),
                renderHeaderCell: () => Loc.sessions.columns.hostName,
                renderCell: (session) => <span className={styles.mono}>{session.hostName}</span>,
            }),
            createTableColumn<ActiveSession>({
                columnId: "programName",
                compare: (a, b) => a.programName.localeCompare(b.programName),
                renderHeaderCell: () => Loc.sessions.columns.programName,
                renderCell: (session) => (
                    <TableCellLayout truncate title={session.programName}>
                        {session.programName}
                    </TableCellLayout>
                ),
            }),
            createTableColumn<ActiveSession>({
                columnId: "databaseName",
                compare: (a, b) => a.databaseName.localeCompare(b.databaseName),
                renderHeaderCell: () => Loc.sessions.columns.databaseName,
                renderCell: (session) => (
                    <span className={styles.mono}>{session.databaseName}</span>
                ),
            }),
            createTableColumn<ActiveSession>({
                columnId: "status",
                compare: (a, b) => a.status.localeCompare(b.status),
                renderHeaderCell: () => Loc.sessions.columns.status,
                renderCell: (session) => session.status,
            }),
            createTableColumn<ActiveSession>({
                columnId: "cpu",
                compare: (a, b) => a.cpuTimeMs - b.cpuTimeMs,
                renderHeaderCell: () => Loc.sessions.columns.cpu,
                renderCell: (session) => (
                    <span className={styles.number}>{session.cpuTimeMs.toLocaleString()}</span>
                ),
            }),
            createTableColumn<ActiveSession>({
                columnId: "transactions",
                compare: (a, b) => a.openTransactionCount - b.openTransactionCount,
                renderHeaderCell: () => Loc.sessions.columns.transactions,
                renderCell: (session) => (
                    <span className={styles.number}>{session.openTransactionCount}</span>
                ),
            }),
            createTableColumn<ActiveSession>({
                columnId: "lastRequest",
                compare: (a, b) => a.lastRequestStartTime.localeCompare(b.lastRequestStartTime),
                renderHeaderCell: () => Loc.sessions.columns.lastRequest,
                renderCell: (session) => formatMoment(session.lastRequestStartTime),
            }),
            createTableColumn<ActiveSession>({
                columnId: "lastStatement",
                renderHeaderCell: () => Loc.sessions.columns.lastStatement,
                renderCell: (session) =>
                    session.lastStatement ? (
                        <span className={styles.statement} title={session.lastStatement}>
                            {oneLine(session.lastStatement)}
                        </span>
                    ) : (
                        <span className={styles.statement}>{Loc.sessions.noStatement}</span>
                    ),
            }),
        ],
        [styles],
    );

    // SQL Server no da error cuando falta VIEW SERVER STATE: simplemente oculta el resto de
    // sesiones. Verlo y no explicarlo haría pensar que el servidor está vacío.
    const sessions = section.data ?? [];
    const notice =
        section.status === "loaded" && looksLikeMissingViewServerState(sessions) ? (
            <MessageBar className={styles.notice} intent="warning">
                <MessageBarBody>{Loc.sessions.missingViewServerState}</MessageBarBody>
            </MessageBar>
        ) : undefined;

    return (
        <DataTable<ActiveSession>
            section={section}
            columns={columns}
            getRowId={(session) => String(session.sessionId)}
            getSearchText={(session) =>
                [
                    String(session.sessionId),
                    session.loginName,
                    session.hostName,
                    session.programName,
                    session.databaseName,
                    session.status,
                ].join(" ")
            }
            searchPlaceholder={Loc.sessions.searchPlaceholder}
            emptyMessage={Loc.sessions.empty}
            legend={Loc.sessions.legend}
            notice={notice}
            columnSizing={{
                // Ancho suficiente para el número y la insignia «Esta sesión» al lado, sin recortar.
                sessionId: { minWidth: 170, defaultWidth: 175 },
                loginName: { minWidth: 140, defaultWidth: 170 },
                hostName: { minWidth: 110, defaultWidth: 130 },
                programName: { minWidth: 160, defaultWidth: 220 },
                databaseName: { minWidth: 120, defaultWidth: 150 },
                status: { minWidth: 90, defaultWidth: 100 },
                cpu: { minWidth: 80, defaultWidth: 90 },
                transactions: { minWidth: 70, defaultWidth: 80 },
                lastRequest: { minWidth: 120, defaultWidth: 140 },
                lastStatement: { minWidth: 260, defaultWidth: 380 },
            }}
        />
    );
};
