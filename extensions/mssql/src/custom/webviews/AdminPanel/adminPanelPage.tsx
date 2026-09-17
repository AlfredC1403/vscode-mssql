/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useContext } from "react";
import { Button, MessageBar, Text, makeStyles } from "@fluentui/react-components";
import { ArrowClockwiseRegular } from "@fluentui/react-icons";

import { AdminPanelContext } from "./adminPanelStateProvider";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { PanelShell } from "../common/panelShell";
import { WebviewStrings as Loc } from "../strings";
import { ConnectionTarget } from "../../sharedInterfaces/adminPanel";

const useStyles = makeStyles({
    grid: {
        display: "grid",
        gridTemplateColumns: "180px minmax(0, 1fr)",
        rowGap: "0",
        columnGap: "16px",
        maxWidth: "720px",
    },
    label: {
        display: "flex",
        alignItems: "center",
        minHeight: "44px",
        fontSize: "12px",
        color: "var(--vscode-descriptionForeground)",
    },
    value: {
        display: "flex",
        alignItems: "center",
        minHeight: "44px",
        fontSize: "13px",
        color: "var(--vscode-foreground)",
        wordBreak: "break-word",
    },
    mono: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
    },
    placeholder: {
        marginTop: "24px",
        maxWidth: "720px",
        padding: "16px",
        borderRadius: "4px",
        border: "1px dashed var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        backgroundColor: "var(--vscode-editorWidget-background, transparent)",
    },
    placeholderTitle: {
        display: "block",
        fontSize: "13px",
        fontWeight: 600,
        marginBottom: "6px",
    },
    placeholderBody: {
        display: "block",
        fontSize: "12px",
        color: "var(--vscode-descriptionForeground)",
        lineHeight: "18px",
    },
    nextList: {
        margin: "12px 0 0 0",
        paddingLeft: "18px",
        fontSize: "12px",
        color: "var(--vscode-descriptionForeground)",
        lineHeight: "20px",
    },
    refreshButton: {
        minHeight: "30px",
    },
});

/** Formatea la marca de tiempo en la zona horaria del usuario, solo hora. */
function formatReadAt(isoTimestamp: string): string {
    const parsed = new Date(isoTimestamp);
    return Number.isNaN(parsed.getTime()) ? isoTimestamp : parsed.toLocaleTimeString();
}

function hostingLabel(target: ConnectionTarget): string | undefined {
    if (target.isCloud === undefined) {
        return undefined;
    }
    return target.isCloud ? Loc.adminPanel.hosting.cloud : Loc.adminPanel.hosting.onPremises;
}

export const AdminPanelPage = () => {
    const styles = useStyles();
    const context = useContext(AdminPanelContext);
    const target = useAdminPanelSelector((state) => state?.target);
    const errorMessage = useAdminPanelSelector((state) => state?.errorMessage);

    if (!context) {
        return undefined;
    }

    const rows: { label: string; value: string | undefined; mono?: boolean }[] = [
        { label: Loc.adminPanel.fields.server, value: target?.server, mono: true },
        { label: Loc.adminPanel.fields.database, value: target?.database, mono: true },
        { label: Loc.adminPanel.fields.authentication, value: target?.authenticationType },
        { label: Loc.adminPanel.fields.user, value: target?.userName },
        { label: Loc.adminPanel.fields.profile, value: target?.profileName },
        { label: Loc.adminPanel.fields.version, value: target?.serverVersion, mono: true },
        { label: Loc.adminPanel.fields.edition, value: target?.serverEdition },
        { label: Loc.adminPanel.fields.hosting, value: target && hostingLabel(target) },
    ].filter((row) => !!row.value);

    return (
        <PanelShell
            title={Loc.adminPanel.title}
            contextItems={[
                target?.server,
                target?.database,
                target ? Loc.adminPanel.readAt(formatReadAt(target.readAt)) : undefined,
            ]}
            actions={
                <Button
                    className={styles.refreshButton}
                    appearance="secondary"
                    size="small"
                    icon={<ArrowClockwiseRegular />}
                    onClick={() => context.refresh()}
                    aria-label={Loc.adminPanel.refreshAriaLabel}>
                    {Loc.adminPanel.refresh}
                </Button>
            }>
            {errorMessage && (
                <MessageBar intent="error" role="alert">
                    {errorMessage}
                </MessageBar>
            )}

            {target ? (
                <dl className={styles.grid}>
                    {rows.map((row) => (
                        <div key={row.label} style={{ display: "contents" }}>
                            <dt className={styles.label}>{row.label}</dt>
                            <dd
                                className={`${styles.value} ${row.mono ? styles.mono : ""}`}
                                style={{ margin: 0 }}>
                                {row.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            ) : (
                !errorMessage && <Text>{Loc.adminPanel.subtitleEmpty}</Text>
            )}

            <section className={styles.placeholder}>
                <Text as="h2" className={styles.placeholderTitle}>
                    {Loc.adminPanel.placeholderTitle}
                </Text>
                <Text className={styles.placeholderBody}>{Loc.adminPanel.placeholderBody}</Text>
                <ul className={styles.nextList}>
                    {Loc.adminPanel.placeholderNext.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </section>
        </PanelShell>
    );
};
