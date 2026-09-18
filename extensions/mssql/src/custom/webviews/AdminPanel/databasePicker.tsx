/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { useContext } from "react";
import { Dropdown, Option, Spinner, Text, makeStyles } from "@fluentui/react-components";

import { AdminPanelContext } from "./adminPanelStateProvider";
import { useAdminPanelSelector } from "./adminPanelSelector";
import { WebviewStrings as Loc } from "../strings";

const useStyles = makeStyles({
    root: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    dropdown: {
        minWidth: "200px",
    },
    note: {
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
    },
    error: {
        fontSize: "11px",
        color: "var(--vscode-errorForeground)",
    },
});

/**
 * Selector de la base de datos que administran las secciones de base.
 *
 * Cambiar de base **no cambia la conexión**: las consultas llegan al catálogo con nombre de tres
 * partes. El panel comparte conexión con el editor de consultas del usuario, y un `USE` le movería
 * la base activa sin avisar. El texto de ayuda lo dice, porque es lo que alguien esperaría al ver un
 * selector de bases en una herramienta de SQL.
 */
export const DatabasePicker = () => {
    const styles = useStyles();
    const context = useContext(AdminPanelContext);
    const selected = useAdminPanelSelector((state) => state?.selectedDatabase);
    const databases = useAdminPanelSelector((state) => state?.databases);

    if (databases?.status === "loading" || databases?.status === "idle") {
        return (
            <div className={styles.root}>
                <Spinner size="extra-tiny" />
                <Text className={styles.note}>{Loc.adminPanel.databaseSelector.loading}</Text>
            </div>
        );
    }

    if (databases?.status === "error") {
        // Si el selector falla, las secciones de base siguen funcionando con la base de la conexión.
        return (
            <div className={styles.root}>
                <Text className={styles.error}>{Loc.adminPanel.databaseSelector.error}</Text>
            </div>
        );
    }

    const options = databases?.data ?? [];

    return (
        <div className={styles.root}>
            <Dropdown
                className={styles.dropdown}
                size="small"
                value={selected ?? ""}
                selectedOptions={selected ? [selected] : []}
                aria-label={Loc.adminPanel.databaseSelector.label}
                title={Loc.adminPanel.databaseSelector.hint}
                onOptionSelect={(_, selection) => {
                    if (selection.optionValue) {
                        context?.selectDatabase(selection.optionValue);
                    }
                }}>
                {options.map((database) => (
                    <Option
                        key={database.name}
                        value={database.name}
                        // Una base sin acceso se muestra, pero no se puede elegir: que exista y no se
                        // pueda abrir también es información.
                        disabled={!database.accessible}
                        text={database.name}>
                        {database.accessible
                            ? database.name
                            : `${database.name} (${Loc.adminPanel.databaseSelector.noAccess})`}
                    </Option>
                ))}
            </Dropdown>
        </div>
    );
};
