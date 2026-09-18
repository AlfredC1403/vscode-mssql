/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Tipos del plan de ejecución: lo que el panel va a hacer, antes de hacerlo.
 *
 * Un plan es el objeto que se muestra en la vista previa y el que se ejecuta. Se calcula **una sola
 * vez en el host**, se guarda con su `id`, y el webview solo devuelve ese `id` para ejecutar: nunca
 * manda T-SQL. Así «lo que se ejecutó es lo que se mostró» no es una promesa, es la única forma en
 * que el código puede funcionar (regla 11.1 del brief).
 *
 * Este archivo es puro: no importa `vscode` ni nada del host, y no construye T-SQL. Solo describe y
 * valida.
 */

import { isValidIdentifier } from "../../../util/identifiers";

/** Una sentencia del plan, ya construida y validada por su generador. */
export interface PlannedStatement {
    /** Texto para la persona: «Conceder SELECT sobre el esquema ventas a analista». */
    label: string;
    /**
     * La sentencia, sin punto y coma final, sin `GO` y sin `USE`.
     *
     * No puede contener una comilla simple: va dentro de un literal `N'...'` al ejecutarse, y la
     * regla 11.2 prohíbe escapar a mano. Los generadores abortan antes de producirla.
     */
    sql: string;
    /**
     * Base de datos en cuyo contexto tiene que ejecutarse, porque el lote la enruta con
     * `EXEC [base].sys.sp_executesql`. `master` para el ámbito de servidor: SQL Server rechaza los
     * `GRANT` de servidor desde otra base con el error 4621.
     *
     * **Obligatoria dentro del lote transaccional, y sin sentido en las sentencias sueltas**, que se
     * ejecutan tal cual en el contexto que tenga la conexión. `KILL` es de las segundas.
     */
    database?: string;
    /**
     * Comprobación que se ejecuta **dentro de la transacción**, justo antes de la sentencia, para
     * que el objeto siga siendo el que el usuario vio. Si falla, el lote entero se revierte.
     */
    precondition?: StatementPrecondition;
}

/** Precondición de una sentencia: una comprobación que lanza si el mundo cambió. */
export interface StatementPrecondition {
    /**
     * Condición en T-SQL que tiene que ser **cierta** para seguir. Se usa como
     * `IF NOT (<check>) THROW <errorNumber>, '<message>', 1`.
     */
    check: string;
    /** Número propio, en el rango 50001-50003, para distinguir el motivo. */
    errorNumber: number;
    /** Motivo, listo para mostrar. No incluye datos del servidor. */
    message: string;
}

/** Números propios de las precondiciones. Fuera del rango de los errores del motor. */
export const PRECONDITION_ERRORS = {
    /** El objeto ya no existe, o no es el mismo (se borró y se volvió a crear). */
    objectChanged: 50001,
    /** La fila que se iba a cambiar ya no está como estaba. */
    rowChanged: 50002,
    /** El estado de partida no coincide: alguien ya hizo el cambio, o el contrario. */
    stateChanged: 50003,
} as const;

/**
 * Un plan completo.
 *
 * `statements` va en un solo lote transaccional, todo o nada. `irreversible` es la vía suelta: las
 * sentencias que SQL Server **no permite** dentro de una transacción de usuario, medidas contra el
 * motor: `CREATE DATABASE` y `ALTER DATABASE ... SET` (error 226), `DROP DATABASE` (error **574**, un
 * número distinto) y `KILL` (error 6115). Ver FORK.md §22.
 *
 * Las dos listas **no se mezclan en un mismo plan**: si una irreversible se ejecuta y luego el lote
 * transaccional falla, el `ROLLBACK` no puede deshacerla y el usuario se queda a medias. Lo fija
 * `validatePlan`.
 */
export interface ExecutionPlan {
    /**
     * Nonce del plan. El webview lo devuelve para ejecutar, y **no manda T-SQL**. Cualquier cambio
     * en la lista de pendientes genera un plan nuevo con otro `id`, así que un plan viejo no se
     * puede ejecutar.
     */
    id: string;
    /** Título de la operación, para el diálogo de confirmación. */
    title: string;
    /** Sentencias que van dentro de la transacción explícita. */
    statements: PlannedStatement[];
    /** Sentencias que el motor no permite dentro de una transacción. Irreversibles. */
    irreversible: PlannedStatement[];
    /**
     * Nombre que el usuario tiene que **escribir** para confirmar (regla 11.5). Se pone en las
     * operaciones destructivas y cuando el objetivo está marcado como de producción.
     */
    typeToConfirm?: string;
    /** `true` si el servidor está marcado como de producción (regla 11.4). */
    production: boolean;
}

/** Lo que pasó al ejecutar un plan. */
export type PlanOutcomeKind =
    /** Todas las sentencias se aplicaron y la transacción confirmó. */
    | "applied"
    /** Algo falló y la transacción se revirtió: el servidor quedó como estaba. */
    | "rolledBack"
    /** La conexión ya tenía una transacción abierta: no se hizo nada. */
    | "inheritedTransaction"
    /** El servidor respondió algo que no se pudo interpretar. No se sabe qué quedó hecho. */
    | "unknown";

/** Resultado de ejecutar un plan, ya interpretado. */
export interface PlanOutcome {
    kind: PlanOutcomeKind;
    /** Número de paso que falló, 1-based. 0 si no falló ninguno. */
    failedStep: number;
    /** Etiqueta del paso que falló, vacía si no falló ninguno. */
    failedLabel: string;
    /** Número de error del motor, 0 si no hubo. */
    errorNumber: number;
    /** Mensaje del motor, ya saneado. */
    errorMessage: string;
    /** `@@TRANCOUNT` al final del lote. Distinto de 0 sería un fallo nuestro. */
    remainingTransactions: number;
}

/**
 * Comprueba que el plan es ejecutable. Devuelve el motivo si no lo es, o `undefined` si está bien.
 *
 * No lanza: el resultado se muestra, no se registra. Función pura.
 */
export function validatePlan(plan: ExecutionPlan): string | undefined {
    if (plan.statements.length === 0 && plan.irreversible.length === 0) {
        return "El plan no tiene ninguna sentencia.";
    }
    if (plan.statements.length > 0 && plan.irreversible.length > 0) {
        // Si la irreversible va primero y luego falla el lote, el ROLLBACK no la alcanza; si va
        // después, el COMMIT ya ocurrió. En los dos casos el usuario se queda a medias.
        return "Un mismo plan no puede mezclar sentencias reversibles con sentencias que SQL Server no permite dentro de una transacción.";
    }
    for (const statement of plan.statements) {
        const problem = validateStatement(statement, { routed: true });
        if (problem) {
            return problem;
        }
    }
    for (const statement of plan.irreversible) {
        const problem = validateStatement(statement, { routed: false });
        if (problem) {
            return problem;
        }
    }
    return undefined;
}

/**
 * Comprueba una sentencia suelta. Devuelve el motivo si no vale.
 *
 * Lo que se mira aquí es lo que hace segura la plantilla del ejecutor, no la sintaxis del T-SQL:
 * profundidad de entrecomillado, y que nadie haya colado un `GO` o un `USE`.
 */
export function validateStatement(
    statement: PlannedStatement,
    options: { routed?: boolean } = {},
): string | undefined {
    if (!statement.sql.trim()) {
        return "Una sentencia del plan está vacía.";
    }
    // Dentro del lote, el nombre de la base entra en el texto, así que se valida aquí y no solo al
    // construirlo: el ejecutor **devuelve** los problemas, nunca lanza.
    if (options.routed !== false && !isValidIdentifier(statement.database)) {
        return "El nombre de la base de datos de una sentencia del plan no es válido para SQL Server.";
    }
    // La sentencia viaja dentro de un literal N'...'. La profundidad de entrecomillado es siempre 2,
    // y la fija la plantilla del ejecutor. Para que eso baste, ningún generador puede emitir una
    // comilla simple: la regla 11.2 manda abortar, no escapar.
    if (statement.sql.includes("'")) {
        return "Una sentencia del plan lleva una comilla simple, y el ejecutor no escapa a mano.";
    }
    // La precondición es distinta: va en el lote **sin anidar**, no dentro de `N'...'`, así que sus
    // literales son legítimos y los construye `quoteLiteral`, que valida el nombre antes. Lo que se
    // comprueba aquí es que estén cerrados y que nadie haya colado una sentencia dentro.
    if (statement.precondition) {
        const check = statement.precondition.check;
        if ((check.match(/'/g) ?? []).length % 2 !== 0) {
            return "Una precondición del plan tiene una comilla sin cerrar.";
        }
        if (check.includes(";")) {
            return "Una precondición del plan lleva un punto y coma.";
        }
        if (/\bGO\b/i.test(check)) {
            return "Una precondición del plan lleva GO.";
        }
    }
    if (/;\s*$/.test(statement.sql)) {
        return "Una sentencia del plan acaba en punto y coma: las pone el ejecutor.";
    }
    if (/\bGO\b/i.test(statement.sql)) {
        // `query/simpleexecute` ejecuta lo que hay tras un GO pero **se come los errores** de los
        // lotes siguientes, así que un GO dentro del lote convertiría un fallo en un éxito.
        return "Una sentencia del plan lleva GO, y el lote tiene que ser uno solo.";
    }
    if (/^\s*USE\b/i.test(statement.sql)) {
        // El panel comparte la conexión con el editor del usuario (FORK.md §21.1).
        return "Una sentencia del plan hace USE, y el panel no cambia la base de la conexión.";
    }
    return undefined;
}

/**
 * Script legible: lo que se muestra en la vista previa y lo que se puede abrir en un editor.
 *
 * No es el texto que se envía —ese lo construye el ejecutor y también se muestra—, pero **contiene
 * exactamente las mismas sentencias**, y hay un test que lo afirma comparando los dos conjuntos.
 * Función pura.
 */
export function renderReadableScript(plan: ExecutionPlan): string {
    const lines: string[] = [];

    if (plan.statements.length > 0) {
        lines.push("-- Se ejecuta como un solo lote, dentro de una transacción explícita.");
        lines.push("-- Si una sentencia falla, se revierten todas.");
        lines.push("SET XACT_ABORT ON;");
        lines.push("BEGIN TRANSACTION;");
        lines.push("");
        plan.statements.forEach((statement, index) => {
            lines.push(`-- ${index + 1}. ${statement.label}`);
            if (statement.precondition) {
                lines.push(`--    Antes se comprueba: ${statement.precondition.message}`);
            }
            lines.push(`USE ${bracket(statement.database ?? "")};`);
            lines.push(`${statement.sql};`);
            lines.push("");
        });
        lines.push("COMMIT TRANSACTION;");
    }

    if (plan.irreversible.length > 0) {
        lines.push("-- SQL Server no permite estas sentencias dentro de una transacción:");
        lines.push("-- se ejecutan aparte y NO se pueden revertir.");
        plan.irreversible.forEach((statement, index) => {
            lines.push(`-- ${index + 1}. ${statement.label} (irreversible)`);
            lines.push(`${statement.sql};`);
        });
    }

    return lines.join("\n");
}

/**
 * Entrecomillado para el script **legible**.
 *
 * El nombre viene ya validado por `identifiers.ts` en el generador; aquí solo se pinta. El
 * `USE [base]` de este texto es explicativo: el lote real enruta con
 * `EXEC [base].sys.sp_executesql`, porque el panel no cambia la base de la conexión.
 */
function bracket(name: string): string {
    return `[${name}]`;
}

/** Sentencias DDL de un plan, normalizadas, para comparar dos representaciones del mismo plan. */
export function planStatementTexts(plan: ExecutionPlan): string[] {
    return [...plan.statements, ...plan.irreversible].map((statement) =>
        statement.sql.replace(/\s+/g, " ").trim(),
    );
}
