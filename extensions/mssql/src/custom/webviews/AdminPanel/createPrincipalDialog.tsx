/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useState } from "react";
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Dropdown,
    Field,
    Input,
    MessageBar,
    MessageBarBody,
    Option,
    makeStyles,
} from "@fluentui/react-components";

import { WebviewStrings as Loc } from "../strings";

/**
 * Diálogo de creación de un principal (M6).
 *
 * **No tiene campo de contraseña, y es lo más importante de este archivo.** La contraseña no entra
 * en el estado del webview: el host la pide con una caja de VS Code justo antes de ejecutar, y
 * mientras tanto el script muestra un marcador de posición (regla 11.3 del brief). Este diálogo solo
 * recoge lo que sí puede vivir en el estado y viajar por el canal de mensajes.
 *
 * Usa el `Dialog` de Fluent, que es el mismo stack del upstream: no entra una segunda librería de
 * interfaz (prohibición §16.2).
 */
const useStyles = makeStyles({
    fields: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minWidth: "380px",
    },
    checks: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
    },
});

/** Lo que el diálogo devuelve, ya validado en lo que se puede validar en el cliente. */
export interface CreatePrincipalResult {
    name: string;
    /** Login al que se asigna un usuario, o propietario de un rol. Vacío si no aplica. */
    related: string;
    /** Esquema por omisión de un usuario, o base por omisión de un login. Vacío si no aplica. */
    secondary: string;
    checkPolicy: boolean;
    checkExpiration: boolean;
    mustChange: boolean;
}

export interface CreatePrincipalDialogProps {
    open: boolean;
    /** Qué se crea. Decide qué campos se piden. */
    kind: "login" | "user" | "serverRole" | "databaseRole";
    /** Opciones para el desplegable del campo relacionado (logins, o propietarios posibles). */
    relatedOptions: string[];
    /** Opciones para el campo secundario (esquemas, o bases de datos). */
    secondaryOptions: string[];
    onCancel: () => void;
    onConfirm: (result: CreatePrincipalResult) => void;
}

export const CreatePrincipalDialog = ({
    open,
    kind,
    relatedOptions,
    secondaryOptions,
    onCancel,
    onConfirm,
}: CreatePrincipalDialogProps) => {
    const styles = useStyles();
    const [name, setName] = useState("");
    const [related, setRelated] = useState("");
    const [secondary, setSecondary] = useState("");
    const [checkPolicy, setCheckPolicy] = useState(true);
    const [checkExpiration, setCheckExpiration] = useState(true);
    const [mustChange, setMustChange] = useState(false);

    const texts = Loc.create[kind];

    const reset = () => {
        setName("");
        setRelated("");
        setSecondary("");
        setCheckPolicy(true);
        setCheckExpiration(true);
        setMustChange(false);
    };

    const cancel = () => {
        reset();
        onCancel();
    };

    // Se valida lo mismo que `identifiers.ts` en el host, para poder avisar sin ir y volver. El host
    // vuelve a validar de todas formas: esto es comodidad, no la barrera.
    const trimmed = name.trim();
    const nameProblem =
        trimmed.length === 0
            ? undefined
            : !/^[A-Za-z_][A-Za-z0-9_@$#\\ -]{0,127}$/.test(trimmed) ||
                trimmed.includes("--") ||
                trimmed !== name
              ? Loc.create.invalidName
              : undefined;

    // `MUST_CHANGE` exige las otras dos: medido, SQL Server devuelve el error 15099 si falta la
    // caducidad. Se refleja aquí en lugar de dejar que el servidor rechace el lote.
    const policyProblem =
        mustChange && (!checkExpiration || !checkPolicy) ? Loc.create.mustChangeNeeds : undefined;

    const canConfirm = trimmed.length > 0 && !nameProblem && !policyProblem;

    return (
        <Dialog open={open} modalType="modal" onOpenChange={(_, data) => !data.open && cancel()}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>{texts.title}</DialogTitle>
                    <DialogContent>
                        <div className={styles.fields}>
                            <Field
                                label={texts.nameLabel}
                                required
                                validationState={nameProblem ? "error" : "none"}
                                validationMessage={nameProblem}>
                                <Input
                                    value={name}
                                    onChange={(_, data) => setName(data.value)}
                                    placeholder={texts.namePlaceholder}
                                />
                            </Field>

                            {kind === "user" && (
                                <Field
                                    label={Loc.create.user.loginLabel}
                                    hint={Loc.create.user.loginHint}>
                                    <Dropdown
                                        value={related}
                                        selectedOptions={related ? [related] : []}
                                        placeholder={Loc.create.user.withoutLogin}
                                        onOptionSelect={(_, data) =>
                                            setRelated(data.optionValue ?? "")
                                        }>
                                        <Option value="">{Loc.create.user.withoutLogin}</Option>
                                        {relatedOptions.map((option) => (
                                            <Option key={option} value={option}>
                                                {option}
                                            </Option>
                                        ))}
                                    </Dropdown>
                                </Field>
                            )}

                            {(kind === "serverRole" || kind === "databaseRole") && (
                                <Field label={Loc.create.ownerLabel} hint={Loc.create.ownerHint}>
                                    <Dropdown
                                        value={related}
                                        selectedOptions={related ? [related] : []}
                                        placeholder={Loc.create.ownerDefault}
                                        onOptionSelect={(_, data) =>
                                            setRelated(data.optionValue ?? "")
                                        }>
                                        <Option value="">{Loc.create.ownerDefault}</Option>
                                        {relatedOptions.map((option) => (
                                            <Option key={option} value={option}>
                                                {option}
                                            </Option>
                                        ))}
                                    </Dropdown>
                                </Field>
                            )}

                            {kind === "user" && (
                                <Field label={Loc.create.user.schemaLabel}>
                                    <Dropdown
                                        value={secondary}
                                        selectedOptions={secondary ? [secondary] : []}
                                        placeholder={Loc.create.user.schemaDefault}
                                        onOptionSelect={(_, data) =>
                                            setSecondary(data.optionValue ?? "")
                                        }>
                                        <Option value="">{Loc.create.user.schemaDefault}</Option>
                                        {secondaryOptions.map((option) => (
                                            <Option key={option} value={option}>
                                                {option}
                                            </Option>
                                        ))}
                                    </Dropdown>
                                </Field>
                            )}

                            {kind === "login" && (
                                <>
                                    <Field
                                        label={Loc.create.login.defaultDatabaseLabel}
                                        hint={Loc.create.login.defaultDatabaseHint}>
                                        <Dropdown
                                            value={secondary}
                                            selectedOptions={secondary ? [secondary] : []}
                                            placeholder={Loc.create.login.defaultDatabaseDefault}
                                            onOptionSelect={(_, data) =>
                                                setSecondary(data.optionValue ?? "")
                                            }>
                                            <Option value="">
                                                {Loc.create.login.defaultDatabaseDefault}
                                            </Option>
                                            {secondaryOptions.map((option) => (
                                                <Option key={option} value={option}>
                                                    {option}
                                                </Option>
                                            ))}
                                        </Dropdown>
                                    </Field>

                                    <div className={styles.checks}>
                                        <Checkbox
                                            checked={checkPolicy}
                                            onChange={(_, data) => setCheckPolicy(!!data.checked)}
                                            label={Loc.create.login.checkPolicy}
                                        />
                                        <Checkbox
                                            checked={checkExpiration}
                                            onChange={(_, data) =>
                                                setCheckExpiration(!!data.checked)
                                            }
                                            label={Loc.create.login.checkExpiration}
                                        />
                                        <Checkbox
                                            checked={mustChange}
                                            onChange={(_, data) => setMustChange(!!data.checked)}
                                            label={Loc.create.login.mustChange}
                                        />
                                    </div>
                                    {policyProblem && (
                                        <MessageBar intent="warning">
                                            <MessageBarBody>{policyProblem}</MessageBarBody>
                                        </MessageBar>
                                    )}
                                </>
                            )}

                            {/* La regla 11.3, dicha donde el usuario espera el campo que no está. */}
                            {kind === "login" && (
                                <MessageBar intent="info">
                                    <MessageBarBody>
                                        {Loc.create.login.passwordLater}
                                    </MessageBarBody>
                                </MessageBar>
                            )}
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={cancel}>
                            {Loc.common.cancel}
                        </Button>
                        <Button
                            appearance="primary"
                            disabled={!canConfirm}
                            onClick={() => {
                                onConfirm({
                                    name: trimmed,
                                    related,
                                    secondary,
                                    checkPolicy,
                                    checkExpiration,
                                    mustChange,
                                });
                                reset();
                            }}>
                            {Loc.create.stage}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
