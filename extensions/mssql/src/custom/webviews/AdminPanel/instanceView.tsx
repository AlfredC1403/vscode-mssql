/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { MessageBar, MessageBarBody, Spinner, Text, makeStyles } from "@fluentui/react-components";

import { InstanceProperties } from "../../admin/sql/types";
import { UNLIMITED_SERVER_MEMORY_MB } from "../../admin/sql/queries/instanceProperties";
import { PropertyList, PropertySection } from "../common/propertyList";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { WebviewStrings as Loc } from "../strings";

const useStyles = makeStyles({
    state: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "16px 0",
        fontSize: "12px",
        color: "var(--vscode-descriptionForeground)",
    },
    notice: {
        maxWidth: "620px",
    },
});

/** Formatea una marca de tiempo ISO en la zona del usuario. */
function formatMoment(isoTimestamp: string): string {
    if (!isoTimestamp) {
        return "";
    }
    const parsed = new Date(isoTimestamp);
    return Number.isNaN(parsed.getTime()) ? isoTimestamp : parsed.toLocaleString();
}

function memory(megabytes: number): string {
    // El valor por defecto de `max server memory` es 2147483647 MB, que significa «sin límite».
    if (megabytes <= 0 || megabytes >= UNLIMITED_SERVER_MEMORY_MB) {
        return Loc.instance.unlimitedMemory;
    }
    return Loc.instance.megabytes(megabytes);
}

function buildSections(properties: InstanceProperties): PropertySection[] {
    const F = Loc.instance.fields;
    return [
        {
            title: Loc.instance.sections.identity,
            rows: [
                { label: F.serverName, value: properties.serverName, mono: true },
                { label: F.machineName, value: properties.machineName, mono: true },
                {
                    label: F.instanceName,
                    value: properties.instanceName || Loc.instance.defaultInstance,
                    mono: !!properties.instanceName,
                },
            ],
        },
        {
            title: Loc.instance.sections.version,
            rows: [
                { label: F.productVersion, value: properties.productVersion, mono: true },
                { label: F.productLevel, value: properties.productLevel },
                { label: F.edition, value: properties.edition },
                { label: F.engineEdition, value: properties.engineEdition },
            ],
        },
        {
            title: Loc.instance.sections.security,
            rows: [
                { label: F.authenticationMode, value: properties.authenticationMode },
                { label: F.collation, value: properties.collation, mono: true },
                {
                    label: F.clustered,
                    value: properties.isClustered ? Loc.common.yes : Loc.common.no,
                },
                { label: F.hadr, value: properties.isHadrEnabled ? Loc.common.yes : Loc.common.no },
            ],
        },
        {
            title: Loc.instance.sections.paths,
            rows: [
                { label: F.dataPath, value: properties.defaultDataPath, mono: true },
                { label: F.logPath, value: properties.defaultLogPath, mono: true },
                { label: F.backupPath, value: properties.backupPath, mono: true },
                { label: F.errorLogPath, value: properties.errorLogPath, mono: true },
            ],
        },
        {
            title: Loc.instance.sections.resources,
            rows: [
                { label: F.maxMemory, value: memory(properties.maxServerMemoryMb) },
                { label: F.minMemory, value: Loc.instance.megabytes(properties.minServerMemoryMb) },
                {
                    label: F.physicalMemory,
                    value: properties.physicalMemoryMb
                        ? Loc.instance.megabytes(properties.physicalMemoryMb)
                        : undefined,
                },
                {
                    label: F.cpuCount,
                    value: properties.cpuCount
                        ? Loc.instance.cores(properties.cpuCount)
                        : undefined,
                },
                { label: F.startTime, value: formatMoment(properties.startTime) },
            ],
        },
    ];
}

/** Propiedades de la instancia (§8.4 del brief), en solo lectura. */
export const InstanceView = () => {
    const styles = useStyles();
    const section = useAdminPanelSelector((state) => state?.instance);

    if (section.status === "loading" || section.status === "idle") {
        return (
            <div className={styles.state}>
                <Spinner size="tiny" />
                <Text>{Loc.common.loading}</Text>
            </div>
        );
    }

    if (section.status === "error" || !section.data) {
        return (
            <MessageBar className={styles.notice} intent="error" role="alert">
                <MessageBarBody>{section.errorMessage ?? Loc.common.unknownError}</MessageBarBody>
            </MessageBar>
        );
    }

    const properties = section.data;
    // Los datos de ejecución llegan por una consulta aparte que exige VIEW SERVER STATE. Si no se
    // pudieron leer, se dice en lugar de mostrar ceros que parecerían datos reales.
    const runtimeMissing =
        !properties.cpuCount && !properties.physicalMemoryMb && !properties.startTime;

    return (
        <>
            {runtimeMissing && (
                <MessageBar className={styles.notice} intent="warning">
                    <MessageBarBody>{Loc.instance.runtimeUnavailable}</MessageBarBody>
                </MessageBar>
            )}
            <PropertyList sections={buildSections(properties)} />
        </>
    );
};
