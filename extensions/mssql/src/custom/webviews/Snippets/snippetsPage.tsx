/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useContext, useMemo, useState } from "react";
import {
    Badge,
    Button,
    Input,
    MessageBar,
    MessageBarBody,
    Text,
    Tooltip,
    makeStyles,
} from "@fluentui/react-components";
import {
    AddRegular,
    ArrowDownloadRegular,
    CopyRegular,
    DeleteRegular,
    EditRegular,
    OpenRegular,
    SearchRegular,
} from "@fluentui/react-icons";

import { Snippet } from "../../sharedInterfaces/snippets";
import { useSnippetsSelector } from "./snippetsSelector";
import { SnippetsContext } from "./snippetsStateProvider";
import { SnippetEditor } from "./snippetEditor";
import { WebviewStrings as Loc } from "../strings";

/**
 * Biblioteca de snippets en la barra lateral (M7).
 *
 * El diseño es de **una columna**: la barra lateral de VS Code puede quedarse en 200 px de ancho, y
 * cualquier cosa con columnas se rompe ahí. Cada snippet es una tarjeta apilada con sus acciones
 * dentro, en lugar de una rejilla como las del panel de administración.
 */
const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        boxSizing: "border-box",
        padding: "8px",
        gap: "8px",
    },
    toolbar: {
        display: "flex",
        gap: "4px",
        alignItems: "center",
    },
    search: {
        flexGrow: 1,
        minWidth: 0,
    },
    list: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        overflowY: "auto",
        flexGrow: 1,
    },
    card: {
        border: "1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border))",
        borderRadius: "4px",
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
    },
    cardHeader: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },
    name: {
        fontSize: "12px",
        fontWeight: 600,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        flexGrow: 1,
        minWidth: 0,
    },
    description: {
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
    },
    body: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "11px",
        whiteSpace: "pre-wrap",
        margin: 0,
        maxHeight: "6.5em",
        overflow: "hidden",
        color: "var(--vscode-descriptionForeground)",
    },
    actions: {
        display: "flex",
        gap: "2px",
        flexWrap: "wrap",
    },
    groupHeader: {
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "var(--vscode-descriptionForeground)",
        marginTop: "4px",
    },
    state: {
        padding: "12px 4px",
        fontSize: "12px",
        color: "var(--vscode-descriptionForeground)",
    },
    path: {
        fontSize: "10px",
        color: "var(--vscode-descriptionForeground)",
        wordBreak: "break-all",
    },
});

/** Normaliza para buscar: minúsculas y sin acentos, igual que la rejilla del panel. */
function normalize(value: string): string {
    return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export const SnippetsPage = () => {
    const styles = useStyles();
    const context = useContext(SnippetsContext);
    const snippets = useSnippetsSelector((state) => state?.snippets) ?? [];
    const loading = useSnippetsSelector((state) => state?.loading) ?? false;
    const warnings = useSnippetsSelector((state) => state?.sharedWarnings) ?? [];
    const ownLibraryPath = useSnippetsSelector((state) => state?.ownLibraryPath) ?? "";
    const hasSqlEditor = useSnippetsSelector((state) => state?.hasSqlEditor) ?? false;

    const [query, setQuery] = useState("");
    const [editing, setEditing] = useState<Snippet | undefined>();
    const [creating, setCreating] = useState(false);

    const filtered = useMemo(() => {
        const needle = normalize(query.trim());
        if (!needle) {
            return snippets;
        }
        return snippets.filter((snippet) =>
            normalize(
                [
                    snippet.name,
                    snippet.prefix,
                    snippet.description,
                    snippet.category,
                    snippet.body,
                ].join(" "),
            ).includes(needle),
        );
    }, [snippets, query]);

    // Se agrupan por origen, y dentro por categoría. El host ya los devuelve ordenados así, así que
    // basta con recorrer y poner una cabecera cuando cambia el grupo.
    const groups = useMemo(() => {
        const result: { header: string; items: Snippet[] }[] = [];
        for (const snippet of filtered) {
            const header = groupHeaderFor(snippet);
            const last = result[result.length - 1];
            if (last && last.header === header) {
                last.items.push(snippet);
            } else {
                result.push({ header, items: [snippet] });
            }
        }
        return result;
    }, [filtered]);

    return (
        <div className={styles.root}>
            <div className={styles.toolbar}>
                <Input
                    className={styles.search}
                    size="small"
                    value={query}
                    onChange={(_, data) => setQuery(data.value)}
                    contentBefore={<SearchRegular />}
                    placeholder={Loc.snippets.searchPlaceholder}
                    aria-label={Loc.snippets.searchPlaceholder}
                />
                <Tooltip content={Loc.snippets.newSnippet} relationship="label">
                    <Button
                        size="small"
                        appearance="primary"
                        icon={<AddRegular />}
                        onClick={() => setCreating(true)}
                        aria-label={Loc.snippets.newSnippet}
                    />
                </Tooltip>
                <Tooltip content={Loc.snippets.openFile} relationship="label">
                    <Button
                        size="small"
                        appearance="subtle"
                        icon={<OpenRegular />}
                        onClick={() => context?.openLibraryFile()}
                        aria-label={Loc.snippets.openFile}
                    />
                </Tooltip>
            </div>

            {!hasSqlEditor && (
                <MessageBar intent="info">
                    <MessageBarBody>{Loc.snippets.noEditorHint}</MessageBarBody>
                </MessageBar>
            )}

            {warnings.map((warning) => (
                <MessageBar key={warning} intent="warning">
                    <MessageBarBody>{warning}</MessageBarBody>
                </MessageBar>
            ))}

            {loading ? (
                <Text className={styles.state}>{Loc.common.loading}</Text>
            ) : filtered.length === 0 ? (
                <div className={styles.state}>
                    <Text>{query.trim() ? Loc.common.noMatches : Loc.snippets.empty}</Text>
                </div>
            ) : (
                <div className={styles.list}>
                    {groups.map((group) => (
                        <div key={group.header}>
                            <Text className={styles.groupHeader}>{group.header}</Text>
                            {group.items.map((snippet) => (
                                <div key={snippet.id} className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <Text className={styles.name} title={snippet.name}>
                                            {snippet.name}
                                        </Text>
                                        {snippet.prefix && (
                                            <Badge appearance="outline" size="small">
                                                {snippet.prefix}
                                            </Badge>
                                        )}
                                    </div>
                                    {snippet.description && (
                                        <Text className={styles.description}>
                                            {snippet.description}
                                        </Text>
                                    )}
                                    <pre className={styles.body}>{snippet.body}</pre>
                                    <div className={styles.actions}>
                                        <Button
                                            size="small"
                                            appearance="subtle"
                                            disabled={!hasSqlEditor}
                                            title={
                                                hasSqlEditor ? undefined : Loc.snippets.noEditorHint
                                            }
                                            // Nombre accesible con el del snippet: en una lista de
                                            // veinte tarjetas, veinte botones «Insertar» no dicen
                                            // nada a un lector de pantalla (§14 del brief).
                                            aria-label={Loc.snippets.insertAria(snippet.name)}
                                            onClick={() => context?.insert(snippet.id)}>
                                            {Loc.snippets.insert}
                                        </Button>
                                        <Tooltip content={Loc.snippets.copy} relationship="label">
                                            <Button
                                                size="small"
                                                appearance="subtle"
                                                icon={<CopyRegular />}
                                                onClick={() => context?.copy(snippet.id)}
                                                aria-label={Loc.snippets.copyAria(snippet.name)}
                                            />
                                        </Tooltip>
                                        {snippet.origin === "own" ? (
                                            <>
                                                <Tooltip
                                                    content={Loc.snippets.edit}
                                                    relationship="label">
                                                    <Button
                                                        size="small"
                                                        appearance="subtle"
                                                        icon={<EditRegular />}
                                                        onClick={() => setEditing(snippet)}
                                                        aria-label={Loc.snippets.editAria(
                                                            snippet.name,
                                                        )}
                                                    />
                                                </Tooltip>
                                                <Tooltip
                                                    content={Loc.snippets.remove}
                                                    relationship="label">
                                                    <Button
                                                        size="small"
                                                        appearance="subtle"
                                                        icon={<DeleteRegular />}
                                                        onClick={() => context?.remove(snippet.id)}
                                                        aria-label={Loc.snippets.removeAria(
                                                            snippet.name,
                                                        )}
                                                    />
                                                </Tooltip>
                                            </>
                                        ) : (
                                            // Los de solo lectura no se editan, pero se pueden
                                            // copiar a la biblioteca propia para partir de ellos.
                                            <Tooltip
                                                content={Loc.snippets.duplicate}
                                                relationship="label">
                                                <Button
                                                    size="small"
                                                    appearance="subtle"
                                                    icon={<ArrowDownloadRegular />}
                                                    onClick={() =>
                                                        context?.duplicateToOwn(snippet.id)
                                                    }
                                                    aria-label={Loc.snippets.duplicateAria(
                                                        snippet.name,
                                                    )}
                                                />
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {ownLibraryPath && (
                <Text className={styles.path} title={ownLibraryPath}>
                    {Loc.snippets.libraryAt(ownLibraryPath)}
                </Text>
            )}

            <SnippetEditor
                open={creating || editing !== undefined}
                snippet={editing}
                onCancel={() => {
                    setCreating(false);
                    setEditing(undefined);
                }}
                onSave={(result) => {
                    setCreating(false);
                    setEditing(undefined);
                    context?.save(result);
                }}
            />
        </div>
    );
};

/** Cabecera del grupo: el origen, y la categoría cuando la hay. */
function groupHeaderFor(snippet: Snippet): string {
    if (snippet.origin === "own") {
        return snippet.category
            ? Loc.snippets.groups.ownWithCategory(snippet.category)
            : Loc.snippets.groups.own;
    }
    if (snippet.origin === "shared") {
        return Loc.snippets.groups.shared(snippet.library);
    }
    return Loc.snippets.groups.builtin;
}
