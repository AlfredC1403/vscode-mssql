/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useContext, useMemo, useState } from "react";
import {
    Badge,
    Button,
    Checkbox,
    Dropdown,
    Input,
    MessageBar,
    MessageBarBody,
    Option,
    SpinButton,
    Text,
    Textarea,
    Tooltip,
    makeStyles,
} from "@fluentui/react-components";
import { ArrowResetRegular, SaveRegular, SearchRegular } from "@fluentui/react-icons";

import { FormatOption } from "../../sharedInterfaces/formatProfiles";
import { useFormatSelector } from "./formatSelector";
import { FormatContext } from "./formatStateProvider";
import { WebviewStrings as Loc } from "../strings";

/**
 * Panel de formato (M8).
 *
 * Tres zonas: los perfiles arriba, las opciones a la izquierda y la vista previa a la derecha.
 *
 * La vista previa es **lado a lado**: el mismo SQL formateado con lo que está aplicado y con lo que
 * hay en el panel sin aplicar. Con 56 opciones, muchas de ellas oscuras (`asKeywordOnOwnLine`,
 * `clauseBodyAlignment`), ver el efecto es la diferencia entre un panel útil y una lista de 56
 * casillas. Nada se escribe en los ajustes hasta pulsar «Aplicar».
 */
const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        boxSizing: "border-box",
        padding: "12px 16px",
        gap: "10px",
    },
    header: {
        display: "flex",
        alignItems: "flex-end",
        gap: "8px",
        flexWrap: "wrap",
    },
    grow: { flexGrow: 1 },
    columns: {
        display: "grid",
        gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1.2fr)",
        gap: "16px",
        flexGrow: 1,
        minHeight: 0,
    },
    optionsColumn: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        overflowY: "auto",
        paddingRight: "6px",
    },
    previewColumn: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minHeight: 0,
    },
    previewPair: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
        flexGrow: 1,
        minHeight: 0,
    },
    code: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "11px",
        whiteSpace: "pre",
        overflow: "auto",
        margin: 0,
        padding: "8px",
        border: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        borderRadius: "4px",
        backgroundColor: "var(--vscode-textCodeBlock-background, transparent)",
        minHeight: 0,
    },
    groupHeader: {
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "var(--vscode-descriptionForeground)",
        marginTop: "8px",
    },
    optionRow: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        paddingBottom: "4px",
    },
    optionLabel: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    optionName: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "12px",
    },
    optionDescription: {
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
    },
    columnTitle: {
        fontSize: "11px",
        fontWeight: 600,
    },
    actions: {
        display: "flex",
        gap: "6px",
        flexWrap: "wrap",
    },
});

function normalize(value: string): string {
    return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export const FormatPage = () => {
    const styles = useStyles();
    const context = useContext(FormatContext);

    const options = useFormatSelector((state) => state?.options) ?? [];
    const profiles = useFormatSelector((state) => state?.profiles) ?? [];
    const selectedProfile = useFormatSelector((state) => state?.selectedProfile) ?? "";
    const draft = useFormatSelector((state) => state?.draft) ?? {};
    const applied = useFormatSelector((state) => state?.applied) ?? {};
    const dirty = useFormatSelector((state) => state?.dirty) ?? false;
    const preview = useFormatSelector((state) => state?.preview);
    const previewing = useFormatSelector((state) => state?.previewing) ?? false;
    const message = useFormatSelector((state) => state?.message) ?? "";

    const [query, setQuery] = useState("");
    const [profileName, setProfileName] = useState("");
    const [onlyChanged, setOnlyChanged] = useState(false);

    const groups = useMemo(() => {
        const needle = normalize(query.trim());
        const visible = options.filter((option) => {
            if (onlyChanged && draft[option.name] === option.defaultValue) {
                return false;
            }
            if (!needle) {
                return true;
            }
            return normalize(`${option.name} ${option.description}`).includes(needle);
        });

        const result: { header: string; items: FormatOption[] }[] = [];
        for (const option of visible) {
            const last = result[result.length - 1];
            if (last && last.header === option.group) {
                last.items.push(option);
            } else {
                result.push({ header: option.group, items: [option] });
            }
        }
        return result;
    }, [options, query, onlyChanged, draft]);

    const changedCount = options.filter(
        (option) => draft[option.name] !== option.defaultValue,
    ).length;

    return (
        <div className={styles.root}>
            <div className={styles.header}>
                <div>
                    <Text className={styles.columnTitle}>{Loc.format.profileLabel}</Text>
                    <Dropdown
                        value={selectedProfile}
                        selectedOptions={selectedProfile ? [selectedProfile] : []}
                        placeholder={Loc.format.noProfileSelected}
                        aria-label={Loc.format.profileLabel}
                        onOptionSelect={(_, data) =>
                            data.optionValue && context?.selectProfile(data.optionValue)
                        }>
                        {profiles.length === 0 ? (
                            <Option value="" disabled>
                                {Loc.format.noProfilesYet}
                            </Option>
                        ) : (
                            profiles.map((profile) => (
                                <Option key={profile.name} value={profile.name}>
                                    {profile.name}
                                </Option>
                            ))
                        )}
                    </Dropdown>
                </div>

                <Input
                    value={profileName}
                    onChange={(_, data) => setProfileName(data.value)}
                    placeholder={Loc.format.newProfilePlaceholder}
                    aria-label={Loc.format.newProfilePlaceholder}
                />
                <Button
                    icon={<SaveRegular />}
                    disabled={!profileName.trim()}
                    onClick={() => {
                        context?.saveProfile(profileName);
                        setProfileName("");
                    }}>
                    {Loc.format.saveProfile}
                </Button>
                {selectedProfile && (
                    <Button
                        appearance="subtle"
                        onClick={() => context?.deleteProfile(selectedProfile)}>
                        {Loc.format.deleteProfile}
                    </Button>
                )}

                <div className={styles.grow} />

                <div className={styles.actions}>
                    {dirty && <Badge color="warning">{Loc.format.unapplied}</Badge>}
                    <Button
                        appearance="primary"
                        disabled={!dirty}
                        onClick={() => context?.apply("user")}>
                        {Loc.format.applyToUser}
                    </Button>
                    <Tooltip content={Loc.format.applyToWorkspaceHint} relationship="label">
                        <Button disabled={!dirty} onClick={() => context?.apply("workspace")}>
                            {Loc.format.applyToWorkspace}
                        </Button>
                    </Tooltip>
                    <Button
                        appearance="subtle"
                        icon={<ArrowResetRegular />}
                        disabled={!dirty}
                        onClick={() => context?.revert()}>
                        {Loc.format.revert}
                    </Button>
                    <Button appearance="subtle" onClick={() => context?.resetToDefaults()}>
                        {Loc.format.resetToDefaults}
                    </Button>
                </div>
            </div>

            {message && (
                <MessageBar intent="info">
                    <MessageBarBody>{message}</MessageBarBody>
                </MessageBar>
            )}

            <div className={styles.columns}>
                <div className={styles.optionsColumn}>
                    <div className={styles.header}>
                        <Input
                            className={styles.grow}
                            size="small"
                            value={query}
                            onChange={(_, data) => setQuery(data.value)}
                            contentBefore={<SearchRegular />}
                            placeholder={Loc.format.searchPlaceholder}
                            aria-label={Loc.format.searchPlaceholder}
                        />
                        <Checkbox
                            checked={onlyChanged}
                            onChange={(_, data) => setOnlyChanged(!!data.checked)}
                            label={Loc.format.onlyChanged(changedCount)}
                        />
                    </div>

                    {groups.length === 0 ? (
                        <Text className={styles.optionDescription}>{Loc.common.noMatches}</Text>
                    ) : (
                        groups.map((group) => (
                            <div key={group.header}>
                                <Text className={styles.groupHeader}>{group.header}</Text>
                                {group.items.map((option) => (
                                    <OptionControl
                                        key={option.key}
                                        option={option}
                                        value={draft[option.name]}
                                        appliedValue={applied[option.name]}
                                        onChange={(value) => context?.setOption(option.name, value)}
                                        styles={styles}
                                    />
                                ))}
                            </div>
                        ))
                    )}
                </div>

                <div className={styles.previewColumn}>
                    <Text className={styles.columnTitle}>{Loc.format.sampleLabel}</Text>
                    <Textarea
                        value={preview?.source ?? ""}
                        onChange={(_, data) => context?.setSample(data.value)}
                        rows={5}
                        style={{ fontFamily: "var(--vscode-editor-font-family, monospace)" }}
                        aria-label={Loc.format.sampleLabel}
                    />

                    {preview?.errorMessage ? (
                        <MessageBar intent="warning">
                            <MessageBarBody>{preview.errorMessage}</MessageBarBody>
                        </MessageBar>
                    ) : undefined}

                    <div className={styles.header}>
                        <Text className={styles.columnTitle}>
                            {previewing ? Loc.format.previewing : Loc.format.previewLabel}
                        </Text>
                    </div>
                    <div className={styles.previewPair}>
                        <div className={styles.previewColumn}>
                            <Text className={styles.optionDescription}>
                                {Loc.format.previewApplied}
                            </Text>
                            <pre className={styles.code}>{preview?.current ?? ""}</pre>
                        </div>
                        <div className={styles.previewColumn}>
                            <Text className={styles.optionDescription}>
                                {dirty ? Loc.format.previewCandidate : Loc.format.previewSame}
                            </Text>
                            <pre className={styles.code}>{preview?.candidate ?? ""}</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * El control de una opción, elegido por su tipo declarado en el `package.json`.
 *
 * No hay un mapa de opción → control escrito a mano: el tipo viene del esquema, así que una opción
 * nueva del upstream se pinta sola.
 */
const OptionControl = ({
    option,
    value,
    appliedValue,
    onChange,
    styles,
}: {
    option: FormatOption;
    value: boolean | string | number | undefined;
    appliedValue: boolean | string | number | undefined;
    onChange: (value: boolean | string | number) => void;
    styles: Record<string, string>;
}) => {
    const current = value ?? option.defaultValue;
    // Se marca lo que difiere de lo aplicado: así se ve de un vistazo qué va a cambiar al aplicar.
    const pending = appliedValue !== undefined && current !== appliedValue;

    return (
        <div className={styles.optionRow}>
            {option.kind === "boolean" ? (
                <div className={styles.optionLabel}>
                    <Checkbox
                        checked={current === true}
                        onChange={(_, data) => onChange(!!data.checked)}
                        label={<span className={styles.optionName}>{option.name}</span>}
                    />
                    {pending && <Badge size="small" color="warning" />}
                </div>
            ) : (
                <div className={styles.optionLabel}>
                    <span className={styles.optionName}>{option.name}</span>
                    {pending && <Badge size="small" color="warning" />}
                    {option.kind === "enum" ? (
                        <Dropdown
                            size="small"
                            value={String(current)}
                            selectedOptions={[String(current)]}
                            aria-label={option.name}
                            onOptionSelect={(_, data) =>
                                data.optionValue && onChange(data.optionValue)
                            }>
                            {option.choices.map((choice) => (
                                <Option key={choice} value={choice}>
                                    {choice}
                                </Option>
                            ))}
                        </Dropdown>
                    ) : (
                        <SpinButton
                            size="small"
                            value={Number(current)}
                            min={0}
                            aria-label={option.name}
                            onChange={(_, data) => {
                                const next = data.value ?? Number(data.displayValue);
                                if (Number.isInteger(next)) {
                                    onChange(next);
                                }
                            }}
                        />
                    )}
                </div>
            )}
            {option.description && (
                <Text className={styles.optionDescription}>{option.description}</Text>
            )}
        </div>
    );
};
