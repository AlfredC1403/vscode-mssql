/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useContext, useState } from "react";
import {
    Badge,
    Button,
    MessageBar,
    MessageBarBody,
    Text,
    makeStyles,
} from "@fluentui/react-components";
import { DeleteRegular, DismissRegular, PlayRegular } from "@fluentui/react-icons";

import { AdminPanelContext } from "./adminPanelStateProvider";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { WebviewStrings as Loc } from "../strings";

/**
 * Cajón de cambios pendientes: lo que el usuario ha montado y todavía no ha ejecutado.
 *
 * Está anclado al pie y se ve desde cualquier sección, porque un cambio se monta en una sección y se
 * aplica junto con los de otras. Y lo que muestra antes de ejecutar son **los dos textos**: el script
 * legible y, plegado, el texto exacto que se envía al servidor. Mostrar solo una versión bonita de lo
 * que se ejecuta no es cumplir la regla 11.1 del brief.
 */
const useStyles = makeStyles({
    root: {
        position: "sticky",
        bottom: 0,
        width: "100%",
        boxSizing: "border-box",
        borderTop: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        backgroundColor: "var(--vscode-editorWidget-background, var(--vscode-editor-background))",
        padding: "10px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxHeight: "50vh",
        overflowY: "auto",
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
    },
    title: {
        fontSize: "12px",
        fontWeight: 600,
    },
    actions: {
        marginLeft: "auto",
        display: "flex",
        gap: "6px",
    },
    row: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr) 110px minmax(0, 2fr) 28px",
        gap: "8px",
        alignItems: "center",
        minHeight: "32px",
        borderTop: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        fontSize: "12px",
    },
    subject: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    sql: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    script: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "11px",
        whiteSpace: "pre-wrap",
        margin: 0,
        padding: "8px",
        border: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        borderRadius: "4px",
        backgroundColor: "var(--vscode-textCodeBlock-background, transparent)",
        maxHeight: "30vh",
        overflowY: "auto",
    },
    exactToggle: {
        alignSelf: "flex-start",
    },
});

/** Cajón de cambios pendientes. No se pinta si no hay ninguno. */
export const PendingChangesDrawer = () => {
    const styles = useStyles();
    const context = useContext(AdminPanelContext);
    const changes = useAdminPanelSelector((state) => state?.pendingChanges) ?? [];
    const preview = useAdminPanelSelector((state) => state?.preview);
    const lastResult = useAdminPanelSelector((state) => state?.lastResult);
    const production = useAdminPanelSelector((state) => state?.productionState);
    const [showExact, setShowExact] = useState(false);

    if (changes.length === 0) {
        // Si el último intento se revirtió, el aviso sigue visible aunque no queden cambios.
        return lastResult && lastResult.outcome !== "applied" ? (
            <div className={styles.root}>
                <MessageBar intent="error">
                    <MessageBarBody>{Loc.pendingChanges.lastFailed}</MessageBarBody>
                </MessageBar>
            </div>
        ) : null;
    }

    const statusOf = (id: string) =>
        lastResult?.statuses.find((entry) => entry.id === id)?.status ?? "pending";

    return (
        <div className={styles.root}>
            <div className={styles.header}>
                <Text className={styles.title}>{Loc.pendingChanges.title(changes.length)}</Text>
                {production?.production && (
                    <Badge appearance="filled" color="danger">
                        {Loc.production.badge}
                    </Badge>
                )}
                <div className={styles.actions}>
                    {!preview ? (
                        <Button
                            size="small"
                            appearance="primary"
                            icon={<PlayRegular />}
                            onClick={() => context?.buildPreview()}>
                            {Loc.pendingChanges.review}
                        </Button>
                    ) : (
                        <Button
                            size="small"
                            appearance="primary"
                            icon={<PlayRegular />}
                            onClick={() => context?.applyChanges(preview.previewId)}>
                            {Loc.pendingChanges.apply(preview.statementCount)}
                        </Button>
                    )}
                    <Button size="small" onClick={() => context?.copyScriptToEditor()}>
                        {Loc.pendingChanges.openInEditor}
                    </Button>
                    <Button
                        size="small"
                        appearance="subtle"
                        icon={<DeleteRegular />}
                        onClick={() => context?.clearChanges()}>
                        {Loc.pendingChanges.discardAll}
                    </Button>
                </div>
            </div>

            {changes.map((change) => (
                <div key={change.id} className={styles.row}>
                    <span className={styles.subject} title={change.subject}>
                        {change.subject}
                    </span>
                    <span>{change.transition}</span>
                    <span>{change.scope}</span>
                    <span className={styles.sql} title={change.sql}>
                        {change.sql}
                    </span>
                    {statusOf(change.id) === "pending" ? (
                        <Button
                            size="small"
                            appearance="subtle"
                            icon={<DismissRegular />}
                            title={Loc.pendingChanges.discardOne}
                            aria-label={Loc.pendingChanges.discardOneAria(change.subject)}
                            onClick={() => context?.unstageChange(change.id)}
                        />
                    ) : (
                        <Badge
                            appearance="outline"
                            color={statusOf(change.id) === "failed" ? "danger" : "warning"}
                            title={Loc.pendingChanges.statuses[statusOf(change.id)]}>
                            !
                        </Badge>
                    )}
                </div>
            ))}

            {preview && (
                <>
                    <pre className={styles.script}>{preview.readableScript}</pre>
                    <Button
                        className={styles.exactToggle}
                        size="small"
                        appearance="subtle"
                        onClick={() => setShowExact(!showExact)}>
                        {showExact ? Loc.pendingChanges.hideExact : Loc.pendingChanges.showExact}
                    </Button>
                    {showExact && <pre className={styles.script}>{preview.exactBatch}</pre>}
                    {preview.typeToConfirm && (
                        <MessageBar intent="warning">
                            <MessageBarBody>
                                {Loc.pendingChanges.willAskToType(preview.typeToConfirm)}
                            </MessageBarBody>
                        </MessageBar>
                    )}
                </>
            )}

            {lastResult && lastResult.outcome !== "applied" && (
                <MessageBar intent="error">
                    <MessageBarBody>{Loc.pendingChanges.lastFailed}</MessageBarBody>
                </MessageBar>
            )}
            {lastResult?.staleAfterApply && (
                <MessageBar intent="warning">
                    <MessageBarBody>{Loc.pendingChanges.stale}</MessageBarBody>
                </MessageBar>
            )}
        </div>
    );
};
