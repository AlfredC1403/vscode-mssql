/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { DatabaseSecurableClass, EffectivePermission } from "../admin/sql/types";

/**
 * Jerarquía de objetos protegibles: el límite que la matriz de M4 anunciaba en su leyenda (M10).
 *
 * ## Qué faltaba
 *
 * `permissionMatrix.ts` resuelve la herencia **por pertenencia a roles**, y lo hace bien. Lo que no
 * resolvía es la otra herencia, la de los objetos: un `GRANT SELECT` sobre el esquema `ventas` y un
 * `DENY SELECT` sobre la tabla `ventas.Cliente` salían como dos filas sueltas, y era el usuario
 * quien tenía que deducir que sobre esa tabla no puede leer. La leyenda lo decía en pantalla
 * (FORK.md §21.3), que es honesto, pero seguía siendo trabajo del lector.
 *
 * Esto lo calcula. Sigue sin inventarse filas: cada fila que sale ya estaba, y lo que se añade es
 * **qué efecto tiene de verdad** y **quién la anula**.
 *
 * ## Las reglas, y de dónde salen
 *
 * Los cuatro niveles son base de datos → esquema → objeto → columna. Sobre ellos:
 *
 * 1. Un `DENY` en un nivel superior anula un `GRANT` en uno inferior.
 * 2. Un `GRANT` en un nivel superior **no** rescata un `DENY` más específico: lo específico gana
 *    cuando es una denegación.
 * 3. **La excepción documentada:** un `DENY` a nivel de **objeto** no anula un `GRANT` a nivel de
 *    **columna**. Microsoft lo documenta en `GRANT` (permisos de objeto) y dice explícitamente que
 *    es una inconsistencia conservada por compatibilidad.
 *
 * **Estas tres reglas están tomadas de la documentación de Microsoft, no medidas contra un motor**,
 * y ésa es la diferencia con el resto de afirmaciones sobre el comportamiento de SQL Server que hay
 * en este repositorio, que sí están medidas. Se dice aquí para que nadie las cite como medidas. La
 * tercera es la que más conviene comprobar el día que haya un servidor delante: es la rara.
 *
 * ## Lo que deliberadamente no hace
 *
 * - **No resuelve permisos que cubren a otros.** `CONTROL` sobre una tabla implica `SELECT` sobre
 *   ella, y aquí no: dos permisos solo se comparan si se llaman igual. Resolverlo exige el grafo
 *   completo de implicaciones del motor, que es otra lista cerrada que habría que medir.
 * - **No enumera objetos sin permiso explícito.** Sigue en pie la decisión del §21.3: una rejilla de
 *   permisos × objetos es ilegible en una base con cientos de objetos, y un objeto sin permiso
 *   explícito no tiene nada que contar.
 */

/** Nivel de un objeto protegible dentro de la jerarquía, de lo más general a lo más concreto. */
export type SecurableLevel = "DATABASE" | "SCHEMA" | "OBJECT" | "COLUMN" | "OTHER";

/** Orden de los niveles. `OTHER` queda fuera de la jerarquía y no anula ni se deja anular. */
const LEVEL_ORDER: Record<SecurableLevel, number> = {
    DATABASE: 0,
    SCHEMA: 1,
    OBJECT: 2,
    COLUMN: 3,
    OTHER: -1,
};

/** Un permiso efectivo, ya situado en la jerarquía y con su efecto final. */
export interface ResolvedPermission extends EffectivePermission {
    /** Dónde cae dentro de la jerarquía. */
    level: SecurableLevel;
    /**
     * Qué pasa de verdad con este permiso sobre este objeto.
     *
     * `denied` incluye tanto el `DENY` propio como el `GRANT` anulado por un `DENY` de arriba.
     */
    effect: "allowed" | "denied";
    /** La fila de nivel superior que lo anula, cuando la hay. */
    overriddenBy?: {
        securable: string;
        level: SecurableLevel;
    };
}

/**
 * En qué nivel de la jerarquía cae un permiso. Pura.
 *
 * `DATABASE_PRINCIPAL` y `TYPE` son objetos protegibles de pleno derecho, pero **no cuelgan de un
 * esquema ni de una tabla**, así que no participan de esta jerarquía y salen como `OTHER`. Meterlos
 * debajo del esquema sería inventarse una relación que el motor no tiene.
 */
export function levelOf(
    securableClass: DatabaseSecurableClass,
    columnName: string,
): SecurableLevel {
    switch (securableClass) {
        case "DATABASE":
            return "DATABASE";
        case "SCHEMA":
            return "SCHEMA";
        case "OBJECT_OR_COLUMN":
            return columnName ? "COLUMN" : "OBJECT";
        default:
            return "OTHER";
    }
}

/**
 * El esquema de un objeto, sacado de su nombre de dos partes, **solo si el esquema existe**.
 *
 * El nombre viene del catálogo como `esquema.objeto`, y partirlo por el primer punto sería una
 * suposición: un objeto puede llamarse `a.b`, y entonces el «esquema» deducido no existiría. Por eso
 * se comprueba contra la lista de esquemas de la base: si el prefijo no es un esquema conocido, se
 * devuelve `undefined` y el objeto se queda **sin padre**, que es lo correcto. Preferimos no
 * relacionar a relacionar mal: una fila sin anular es un dato incompleto, y una fila anulada por el
 * objeto equivocado es un dato falso.
 */
export function schemaOf(securable: string, knownSchemas: ReadonlySet<string>): string | undefined {
    const separator = securable.indexOf(".");
    if (separator <= 0) {
        return undefined;
    }
    const prefix = securable.slice(0, separator);
    return knownSchemas.has(prefix) ? prefix : undefined;
}

/**
 * Los objetos protegibles que contienen a éste, del más general al más cercano.
 *
 * La base de datos contiene a todo, y su `securable` es la cadena vacía, tal y como la deja la
 * consulta del §21 para la clase 0.
 */
function ancestorsOf(
    permission: EffectivePermission,
    knownSchemas: ReadonlySet<string>,
): Array<{ securable: string; level: SecurableLevel }> {
    const level = levelOf(permission.securableClass, permission.columnName);
    if (level === "OTHER" || level === "DATABASE") {
        return [];
    }

    const ancestors: Array<{ securable: string; level: SecurableLevel }> = [
        { securable: "", level: "DATABASE" },
    ];

    if (level === "SCHEMA") {
        return ancestors;
    }

    const schema = schemaOf(permission.securable, knownSchemas);
    if (schema) {
        ancestors.push({ securable: schema, level: "SCHEMA" });
    }
    if (level === "COLUMN") {
        ancestors.push({ securable: permission.securable, level: "OBJECT" });
    }
    return ancestors;
}

/**
 * Aplica la jerarquía a los permisos efectivos de un principal. Función pura.
 *
 * Cada fila de entrada sale una vez, en el mismo orden, con `level`, `effect` y —si la anula alguien
 * de arriba— `overriddenBy`.
 *
 * @param permissions Lo que devuelve `computeEffectivePermissions`, ya con la herencia por roles.
 * @param knownSchemas Los esquemas de la base, para no deducir mal el padre de un objeto.
 */
export function resolveSecurableHierarchy(
    permissions: readonly EffectivePermission[],
    knownSchemas: ReadonlySet<string>,
): ResolvedPermission[] {
    /** Las denegaciones, indexadas por permiso y por objeto, para buscarlas por ancestro. */
    const denials = new Map<string, SecurableLevel>();
    for (const permission of permissions) {
        if (permission.state !== "DENY") {
            continue;
        }
        const level = levelOf(permission.securableClass, permission.columnName);
        if (level === "OTHER") {
            continue;
        }
        denials.set(denialKey(permission.permission, permission.securable, level), level);
    }

    return permissions.map((permission) => {
        const level = levelOf(permission.securableClass, permission.columnName);
        const resolved: ResolvedPermission = {
            ...permission,
            level,
            effect: permission.state === "DENY" ? "denied" : "allowed",
        };

        if (permission.state === "DENY") {
            return resolved;
        }

        for (const ancestor of ancestorsOf(permission, knownSchemas)) {
            if (
                !denials.has(denialKey(permission.permission, ancestor.securable, ancestor.level))
            ) {
                continue;
            }
            // La excepción documentada: un DENY sobre la tabla no anula un GRANT sobre una de sus
            // columnas. Es la única pareja de niveles donde lo de arriba no gana.
            if (level === "COLUMN" && ancestor.level === "OBJECT") {
                continue;
            }
            // Si anulan varios, se enseña el más cercano: es el que alguien puede querer quitar.
            if (
                !resolved.overriddenBy ||
                LEVEL_ORDER[ancestor.level] > LEVEL_ORDER[resolved.overriddenBy.level]
            ) {
                resolved.overriddenBy = ancestor;
            }
            resolved.effect = "denied";
        }

        return resolved;
    });
}

/**
 * Clave de una denegación.
 *
 * Mismo separador NUL y mismo motivo que en `permissionMatrix.ts`: escrito como literal,
 * `eslint --fix` lo deja como byte crudo y git clasifica el archivo como binario (FORK.md §26.7).
 */
function denialKey(permission: string, securable: string, level: SecurableLevel): string {
    return [permission, level, securable].join(String.fromCharCode(0));
}
