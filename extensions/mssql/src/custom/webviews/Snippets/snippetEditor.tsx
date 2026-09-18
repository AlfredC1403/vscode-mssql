/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Field,
    Input,
    Textarea,
    makeStyles,
} from "@fluentui/react-components";

import { Snippet, SnippetsReducers } from "../../sharedInterfaces/snippets";
import { WebviewStrings as Loc } from "../strings";

/**
 * Crear o editar un snippet propio (M7).
 *
 * Es un diálogo y no un formulario en la propia barra lateral: la barra puede tener 200 px y un
 * cuerpo de T-SQL necesita ancho para poder leerse mientras se escribe. El `Dialog` de Fluent se
 * pinta sobre toda la ventana, así que ahí sí cabe.
 */
const useStyles = makeStyles({
    fields: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minWidth: "min(520px, 70vw)",
    },
    body: {
        fontFamily: "var(--vscode-editor-font-family, monospace)",
    },
});

export interface SnippetEditorProps {
    open: boolean;
    /** El snippet que se edita, o `undefined` para crear uno nuevo. */
    snippet?: Snippet;
    onCancel: () => void;
    onSave: (result: SnippetsReducers["save"]) => void;
}

export const SnippetEditor = ({ open, snippet, onCancel, onSave }: SnippetEditorProps) => {
    const styles = useStyles();
    const [name, setName] = useState("");
    const [prefix, setPrefix] = useState("");
    const [body, setBody] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");

    // Al abrirse, los campos se rellenan con el snippet que toque —o se vacían si es nuevo—. Sin
    // esto, editar un snippet después de otro mostraría los datos del anterior.
    useEffect(() => {
        if (!open) {
            return;
        }
        setName(snippet?.name ?? "");
        setPrefix(snippet?.prefix ?? "");
        setBody(snippet?.body ?? "");
        setDescription(snippet?.description ?? "");
        setCategory(snippet?.category ?? "");
    }, [open, snippet]);

    // Mismas reglas que `validateOwnSnippet` en el host, para avisar sin ir y volver. El host
    // vuelve a comprobarlo: esto es comodidad, no la barrera.
    const prefixProblem =
        prefix.trim() && /\s/.test(prefix.trim()) ? Loc.snippets.editor.prefixNoSpaces : undefined;
    const canSave = name.trim().length > 0 && body.trim().length > 0 && !prefixProblem;

    return (
        <Dialog open={open} modalType="modal" onOpenChange={(_, data) => !data.open && onCancel()}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>
                        {snippet ? Loc.snippets.editor.editTitle : Loc.snippets.editor.newTitle}
                    </DialogTitle>
                    <DialogContent>
                        <div className={styles.fields}>
                            <Field label={Loc.snippets.editor.nameLabel} required>
                                <Input
                                    value={name}
                                    onChange={(_, data) => setName(data.value)}
                                    placeholder={Loc.snippets.editor.namePlaceholder}
                                />
                            </Field>

                            <Field
                                label={Loc.snippets.editor.prefixLabel}
                                hint={Loc.snippets.editor.prefixHint}
                                validationState={prefixProblem ? "error" : "none"}
                                validationMessage={prefixProblem}>
                                <Input
                                    value={prefix}
                                    onChange={(_, data) => setPrefix(data.value)}
                                    placeholder={Loc.snippets.editor.prefixPlaceholder}
                                />
                            </Field>

                            <Field
                                label={Loc.snippets.editor.bodyLabel}
                                hint={Loc.snippets.editor.bodyHint}
                                required>
                                <Textarea
                                    className={styles.body}
                                    value={body}
                                    onChange={(_, data) => setBody(data.value)}
                                    rows={10}
                                    placeholder={Loc.snippets.editor.bodyPlaceholder}
                                />
                            </Field>

                            <Field label={Loc.snippets.editor.descriptionLabel}>
                                <Input
                                    value={description}
                                    onChange={(_, data) => setDescription(data.value)}
                                />
                            </Field>

                            <Field
                                label={Loc.snippets.editor.categoryLabel}
                                hint={Loc.snippets.editor.categoryHint}>
                                <Input
                                    value={category}
                                    onChange={(_, data) => setCategory(data.value)}
                                    placeholder={Loc.snippets.editor.categoryPlaceholder}
                                />
                            </Field>
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={onCancel}>
                            {Loc.common.cancel}
                        </Button>
                        <Button
                            appearance="primary"
                            disabled={!canSave}
                            onClick={() =>
                                onSave({
                                    id: snippet?.id ?? "",
                                    name,
                                    prefix,
                                    body,
                                    description,
                                    category,
                                })
                            }>
                            {Loc.snippets.editor.save}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
