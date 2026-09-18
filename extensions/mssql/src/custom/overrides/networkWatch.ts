/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { Strings } from "../strings";

/**
 * Vigilancia de las claves del upstream que abren una salida de red (M9, decisión (d) de §26.8).
 *
 * ## Qué problema resuelve, y cuál no
 *
 * El merge de M9 trajo Data API Builder, cuyo destino «DAB CLI» **descarga un `.nupkg` de un feed
 * NuGet sin comprobar firma ni hash y ejecuta lo que desempaqueta**. Ese camino cuelga de dos claves
 * del upstream:
 *
 * - `mssql.schemaDesigner.enableDeploymentsView`, que enciende la vista de despliegues.
 * - `mssql.dab.cliPackageFeedUrl`, que decide de qué feed se baja.
 *
 * Hoy están apagadas, pero **no por decisión nuestra**: el upstream se dejó las dos sin declarar en
 * su `contributes.configuration`, así que valen `undefined`. Eso es un descuido ajeno, y un descuido
 * se puede arreglar en cualquier momento río arriba.
 *
 * Esto **no previene nada**, y es importante decirlo: no apaga la función, no bloquea la descarga y
 * no toca el código del upstream. Lo único que hace es **convertir un encendido silencioso en un
 * encendido visible**. Se eligió así a propósito (§26.8): prevenir exigiría declarar una clave
 * `mssql.*` en nuestro `package.json`, que es deuda de merge y rompe la convención de auditoría del
 * §0, y aun así no cerraría el camino del contenedor, que es el que de verdad está abierto.
 *
 * Lo que sí cubre, y que declarar la clave no cubriría: **el propio usuario encendiéndola en sus
 * ajustes**. Un `scope` no protege de eso; un aviso sí lo hace notar.
 *
 * ## Por qué `inspect()` y no `get()`
 *
 * `get()` devuelve el valor efectivo y se traga de dónde viene. Aquí lo que importa es justamente el
 * origen: no es lo mismo que lo haya puesto la persona en sus ajustes que que venga en el
 * `.vscode/settings.json` de un repositorio clonado. `inspect()` los separa, y el aviso puede decir
 * cuál de los dos es.
 */

/** Una clave del upstream que vigilamos, y cuándo se considera encendida. */
interface WatchedSetting {
    /** Clave completa, tal y como la lee el upstream. */
    key: string;
    /** Nombre corto para el aviso. */
    label: string;
    /**
     * Cuándo cuenta como encendida.
     *
     * No es siempre `=== true`: `cliPackageFeedUrl` es una cadena, y el upstream la considera puesta
     * con `?.trim() || undefined`, así que una cadena vacía **no** cuenta. Se replica ese criterio en
     * lugar de inventar otro, para que el aviso coincida con lo que de verdad hace el upstream.
     */
    isOn: (value: unknown) => boolean;
}

/** Las dos claves de DAB. Ver el comentario de cabecera. */
export const WATCHED_SETTINGS: readonly WatchedSetting[] = [
    {
        key: "mssql.schemaDesigner.enableDeploymentsView",
        label: "la vista de despliegues de Data API Builder",
        isOn: (value) => value === true,
    },
    {
        key: "mssql.dab.cliPackageFeedUrl",
        // El upstream lee esta clave con `?.trim() || undefined` (`src/dab/dabCliTool.ts`), así que
        // una cadena vacía se comporta como no puesta.
        label: "el feed NuGet del que se descarga la CLI de Data API Builder",
        isOn: (value) => typeof value === "string" && value.trim() !== "",
    },
];

/** Los ámbitos de `inspect()` que nos interesan, del más general al más específico. */
export type SettingScope = "usuario" | "espacio de trabajo" | "carpeta";

/** Lo que `vscode.WorkspaceConfiguration.inspect()` devuelve, reducido a lo que miramos. */
export interface SettingInspection {
    globalValue?: unknown;
    workspaceValue?: unknown;
    workspaceFolderValue?: unknown;
}

/** Una clave encontrada encendida, y dónde. */
export interface EnabledSetting {
    key: string;
    label: string;
    scope: SettingScope;
}

/**
 * Decide qué claves están encendidas y en qué ámbito. Pura: sin `vscode`, para poder probarla.
 *
 * **Se busca el ámbito que gana, y solo entonces se mira si está encendido.** No es lo mismo que
 * buscar el primer ámbito encendido: si los ajustes de usuario la encienden pero el espacio de
 * trabajo la apaga a propósito, el valor efectivo es «apagada» y avisar sería un falso positivo.
 * Un aviso que a veces miente deja de leerse, así que el criterio es el mismo que aplica VS Code:
 * gana el ámbito más específico **que esté definido**.
 */
export function findEnabledSettings(
    readings: ReadonlyArray<{ setting: WatchedSetting; inspection: SettingInspection | undefined }>,
): EnabledSetting[] {
    const found: EnabledSetting[] = [];

    for (const { setting, inspection } of readings) {
        if (!inspection) {
            continue;
        }
        const candidates: Array<[SettingScope, unknown]> = [
            ["carpeta", inspection.workspaceFolderValue],
            ["espacio de trabajo", inspection.workspaceValue],
            ["usuario", inspection.globalValue],
        ];
        // El más específico de los definidos: ése es el que vale.
        const winner = candidates.find(([, value]) => value !== undefined);
        if (winner && setting.isOn(winner[1])) {
            found.push({ key: setting.key, label: setting.label, scope: winner[0] });
        }
    }

    return found;
}

/**
 * Lee las claves vigiladas de la configuración actual.
 *
 * Se aísla del resto para que `findEnabledSettings` quede pura y comprobable sin levantar VS Code.
 */
function inspectWatchedSettings(): EnabledSetting[] {
    const configuration = vscode.workspace.getConfiguration();
    return findEnabledSettings(
        WATCHED_SETTINGS.map((setting) => ({
            setting,
            inspection: configuration.inspect<unknown>(setting.key),
        })),
    );
}

/**
 * Arranca la vigilancia: comprueba al activar y en cada cambio de configuración.
 *
 * **Vigilar el cambio no es un adorno.** El caso que preocupa es abrir una carpeta cuyo
 * `.vscode/settings.json` trae la clave puesta, y eso ocurre *después* de la activación. El propio
 * upstream vigila esa clave con `onDidChangeConfiguration` para repintar su barra, así que sin esto
 * el fork se enteraría más tarde que la función que vigila.
 *
 * @returns Un `Disposable` con la suscripción. Nada de esto puede impedir que el fork arranque: si
 *   algo falla, se traga y la extensión sigue.
 */
export function watchNetworkSettings(): vscode.Disposable {
    // Lo ya avisado, para no repetir el mismo aviso en cada tecla que toque la configuración.
    const alreadyWarned = new Set<string>();

    const check = (): void => {
        try {
            for (const enabled of inspectWatchedSettings()) {
                const fingerprint = `${enabled.key}@${enabled.scope}`;
                if (alreadyWarned.has(fingerprint)) {
                    continue;
                }
                alreadyWarned.add(fingerprint);
                void vscode.window.showWarningMessage(
                    Strings.networkWatch.settingEnabled(enabled.label, enabled.key, enabled.scope),
                );
            }
        } catch {
            // Un fallo leyendo la configuración no puede tumbar la activación ni el resto del fork.
        }
    };

    check();

    return vscode.workspace.onDidChangeConfiguration((event) => {
        if (WATCHED_SETTINGS.some((setting) => event.affectsConfiguration(setting.key))) {
            check();
        }
    });
}
