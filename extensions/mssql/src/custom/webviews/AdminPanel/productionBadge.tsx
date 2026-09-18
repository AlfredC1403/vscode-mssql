/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { Badge, Text, makeStyles } from "@fluentui/react-components";

import { useAdminPanelSelector } from "./adminPanelSelector";
import { WebviewStrings as Loc } from "../strings";

/**
 * Marca visible de servidor de producción (regla 11.4 del brief).
 *
 * Y, cuando el ajuste está **vacío**, una línea neutra que lo dice. Que nadie haya marcado nada no
 * puede parecer lo mismo que «este servidor no es de producción»: sin ese aviso, el día que alguien
 * abra el panel contra producción sin haber configurado el ajuste, no vería ninguna diferencia.
 *
 * No se marca todo como producción por defecto, que enseñaría a ignorar la insignia, ni se adivina
 * por el nombre.
 */
const useStyles = makeStyles({
    hint: {
        fontSize: "11px",
        color: "var(--vscode-descriptionForeground)",
    },
});

export const ProductionBadge = () => {
    const styles = useStyles();
    const production = useAdminPanelSelector((state) => state?.productionState);

    if (!production) {
        return null;
    }

    if (production.production) {
        return (
            <Badge
                appearance="filled"
                color="danger"
                title={
                    production.matchedPattern
                        ? Loc.production.matchedPattern(production.matchedPattern)
                        : Loc.production.matchedProfile
                }>
                {Loc.production.badge}
            </Badge>
        );
    }

    return production.settingEmpty ? (
        <Text className={styles.hint} title={Loc.production.settingKey}>
            {Loc.production.notConfigured}
        </Text>
    ) : null;
};
