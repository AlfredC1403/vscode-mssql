/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useContext } from "react";
import {
    Button,
    MessageBar,
    MessageBarBody,
    Tab,
    TabList,
    Text,
    makeStyles,
} from "@fluentui/react-components";
import { ArrowClockwiseRegular } from "@fluentui/react-icons";

import { AdminPanelContext } from "./adminPanelStateProvider";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { PanelShell } from "../common/panelShell";
import { PropertyList, PropertySection } from "../common/propertyList";
import { LoginsView } from "./loginsView";
import { ServerRolesView } from "./serverRolesView";
import { ServerPermissionsView } from "./serverPermissionsView";
import { InstanceView } from "./instanceView";
import { SessionsView } from "./sessionsView";
import { WebviewStrings as Loc } from "../strings";
import {
    AdminSection,
    ConnectionTarget,
    SECTION_STATE_KEYS,
    SectionState,
} from "../../sharedInterfaces/adminPanel";

const useStyles = makeStyles({
    notice: {
        maxWidth: "620px",
    },
    tabs: {
        flexShrink: 0,
    },
    content: {
        width: "100%",
        minWidth: 0,
    },
    overview: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        alignItems: "flex-start",
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
function buildOverviewSections(target: ConnectionTarget): PropertySection[] {
    return [
        {
            title: Loc.adminPanel.sections.connection,
            rows: [
                { label: Loc.adminPanel.fields.server, value: target.server, mono: true },
                { label: Loc.adminPanel.fields.database, value: target.database, mono: true },
                { label: Loc.adminPanel.fields.authentication, value: target.authenticationType },
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

const TAB_ORDER: { section: AdminSection; label: string }[] = [
    { section: AdminSection.Overview, label: Loc.adminPanel.tabs.overview },
    { section: AdminSection.Logins, label: Loc.adminPanel.tabs.logins },
    { section: AdminSection.ServerRoles, label: Loc.adminPanel.tabs.serverRoles },
    { section: AdminSection.ServerPermissions, label: Loc.adminPanel.tabs.serverPermissions },
    { section: AdminSection.Instance, label: Loc.adminPanel.tabs.instance },
    { section: AdminSection.Sessions, label: Loc.adminPanel.tabs.sessions },
];

export const AdminPanelPage = () => {
    const styles = useStyles();
    const context = useContext(AdminPanelContext);
    const target = useAdminPanelSelector((state) => state?.target);
    const errorMessage = useAdminPanelSelector((state) => state?.errorMessage);
    const activeSection = useAdminPanelSelector((state) => state?.activeSection);
    // La línea de contexto muestra cuándo se leyó la sección visible, no cuándo se abrió el panel.
    const sectionReadAt = useAdminPanelSelector((state) => {
        if (!state || state.activeSection === AdminSection.Overview) {
            return state?.target?.readAt;
        }
        const key = SECTION_STATE_KEYS[state.activeSection];
        return (state[key] as SectionState<unknown> | undefined)?.readAt;
    });

    if (!context) {
        return undefined;
    }

    const section = activeSection ?? AdminSection.Overview;

    return (
        <PanelShell
            title={Loc.adminPanel.title}
            contextItems={[
                target?.server,
                target?.database,
                sectionReadAt ? Loc.adminPanel.readAt(formatReadAt(sectionReadAt)) : undefined,
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

            <TabList
                className={styles.tabs}
                selectedValue={section}
                onTabSelect={(_, data) => context.selectSection(data.value as AdminSection)}
                size="small"
                aria-label={Loc.adminPanel.sectionsAriaLabel}>
                {TAB_ORDER.map((tab) => (
                    <Tab key={tab.section} value={tab.section}>
                        {tab.label}
                    </Tab>
                ))}
            </TabList>

            <div className={styles.content}>
                {section === AdminSection.Overview &&
                    (target ? (
                        <div className={styles.overview}>
                            <PropertyList sections={buildOverviewSections(target)} />
                            {/* De dónde salen estos datos y por qué no hay que esperar a nada:
                                el resumen no consulta al servidor, las demás secciones sí. */}
                            <MessageBar className={styles.notice} intent="info">
                                <MessageBarBody>{Loc.adminPanel.overviewNote}</MessageBarBody>
                            </MessageBar>
                        </div>
                    ) : (
                        !errorMessage && <Text>{Loc.adminPanel.subtitleEmpty}</Text>
                    ))}
                {section === AdminSection.Logins && <LoginsView />}
                {section === AdminSection.ServerRoles && <ServerRolesView />}
                {section === AdminSection.ServerPermissions && <ServerPermissionsView />}
                {section === AdminSection.Instance && <InstanceView />}
                {section === AdminSection.Sessions && <SessionsView />}
            </div>
        </PanelShell>
    );
};
