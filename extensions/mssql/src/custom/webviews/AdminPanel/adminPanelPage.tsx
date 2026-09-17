/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useContext } from "react";
import {
    Button,
    MessageBar,
    MessageBarBody,
    MessageBarTitle,
    Text,
    makeStyles,
} from "@fluentui/react-components";
import { ArrowClockwiseRegular } from "@fluentui/react-icons";

import { AdminPanelContext } from "./adminPanelStateProvider";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { PanelShell } from "../common/panelShell";
import { PropertyList, PropertySection } from "../common/propertyList";
import { WebviewStrings as Loc } from "../strings";
import { ConnectionTarget } from "../../sharedInterfaces/adminPanel";

const useStyles = makeStyles({
    notice: {
        maxWidth: "620px",
    },
    nextList: {
        margin: "6px 0 0 0",
        paddingLeft: "18px",
        fontSize: "12px",
        color: "var(--vscode-descriptionForeground)",
        lineHeight: "19px",
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

/**
 * Agrupa los datos del objetivo en dos bloques con sentido propio: cómo se conectó la extensión,
 * y qué hay al otro lado. Una lista plana de ocho hechos sueltos no dice nada.
 */
function buildSections(target: ConnectionTarget): PropertySection[] {
    return [
        {
            title: Loc.adminPanel.sections.connection,
            rows: [
                { label: Loc.adminPanel.fields.server, value: target.server, mono: true },
                { label: Loc.adminPanel.fields.database, value: target.database, mono: true },
                {
                    label: Loc.adminPanel.fields.authentication,
                    value: target.authenticationType,
                },
                { label: Loc.adminPanel.fields.user, value: target.userName, mono: true },
                { label: Loc.adminPanel.fields.profile, value: target.profileName },
            ],
        },
        {
            title: Loc.adminPanel.sections.instance,
            rows: [
                { label: Loc.adminPanel.fields.version, value: target.serverVersion, mono: true },
                { label: Loc.adminPanel.fields.edition, value: target.serverEdition },
                { label: Loc.adminPanel.fields.hosting, value: hostingLabel(target) },
            ],
        },
    ];
}

export const AdminPanelPage = () => {
    const styles = useStyles();
    const context = useContext(AdminPanelContext);
    const target = useAdminPanelSelector((state) => state?.target);
    const errorMessage = useAdminPanelSelector((state) => state?.errorMessage);

    if (!context) {
        return undefined;
    }

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
                <MessageBar className={styles.notice} intent="error" role="alert">
                    <MessageBarBody>{errorMessage}</MessageBarBody>
                </MessageBar>
            )}

            {target ? (
                <PropertyList sections={buildSections(target)} />
            ) : (
                !errorMessage && <Text>{Loc.adminPanel.subtitleEmpty}</Text>
            )}

            <MessageBar className={styles.notice} intent="info">
                <MessageBarBody>
                    <MessageBarTitle>{Loc.adminPanel.placeholderTitle}</MessageBarTitle>
                    {Loc.adminPanel.placeholderBody}
                    <ul className={styles.nextList}>
                        {Loc.adminPanel.placeholderNext.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </MessageBarBody>
            </MessageBar>
        </PanelShell>
    );
};
