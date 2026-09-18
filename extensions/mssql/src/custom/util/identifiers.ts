/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Validación y entrecomillado de identificadores de SQL Server (regla 11.2 del brief).
 *
 * Los identificadores **no se pueden parametrizar**: el nombre de una base de datos, de un esquema
 * o de un usuario va en el texto de la sentencia, no en un parámetro. La regla es siempre la misma:
 *
 * 1. Se valida contra un patrón cerrado.
 * 2. Si no pasa, **se aborta**. Nunca se intenta escapar a mano lo que no encaja.
 * 3. Lo que pasa se envuelve entre corchetes, como hace `QUOTENAME`.
 *
 * Consecuencia asumida: SQL Server admite identificadores que aquí se rechazan, como
 * `[raro]]nombre]` (con un corchete de cierre dentro) o los que empiezan por un dígito. Para lo que
 * este panel administra —bases, esquemas, usuarios, roles, logins— el patrón sobra, y el precio de
 * aceptarlos sería mantener un escapador propio, que es exactamente lo que el brief prohíbe.
 */

/**
 * Patrón del brief: empieza por letra o `_`, y sigue con letras, dígitos, `_`, `@`, `$`, `#`,
 * barra invertida, espacio o guion. Hasta 128 caracteres, que es el límite de `sysname`.
 *
 * La barra invertida y el espacio están dentro porque los nombres de principales de Windows los
 * llevan (`DOMINIO\usuario`, `BUILTIN\Administrators`, `NT AUTHORITY\SYSTEM`).
 */
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_@$#\\ -]{0,127}$/;

/**
 * Regla aparte para `DOMINIO\usuario`: el patrón general aceptaría cualquier número de barras y en
 * cualquier posición, y eso no es un nombre de principal de Windows.
 *
 * Exige exactamente **una** barra con nombre a los dos lados. El dominio admite espacios porque los
 * hay de verdad (`NT AUTHORITY\SYSTEM`), y la cuenta admite además el punto (`CONTOSO\ana.perez`).
 */
const DOMAIN_PART_PATTERN = /^[A-Za-z_][A-Za-z0-9_@$# -]*$/;
const ACCOUNT_PART_PATTERN = /^[A-Za-z_][A-Za-z0-9_@$#. -]*$/;

/**
 * El doble guion abre un comentario de línea en T-SQL. El patrón del brief admite el guion suelto
 * —hay bases de datos que lo llevan—, así que el doble se descarta aparte.
 */
const LINE_COMMENT = "--";

function isValidDomainPrincipal(name: string): boolean {
    const parts = name.split("\\");
    return (
        parts.length === 2 &&
        DOMAIN_PART_PATTERN.test(parts[0]) &&
        ACCOUNT_PART_PATTERN.test(parts[1])
    );
}

/** Longitud máxima de un identificador de SQL Server (`sysname` es `nvarchar(128)`). */
export const MAX_IDENTIFIER_LENGTH = 128;

/** `true` si el nombre tiene forma de `DOMINIO\usuario`. */
export function looksLikeDomainPrincipal(name: string): boolean {
    return typeof name === "string" && name.includes("\\");
}

/**
 * `true` si el identificador es utilizable tal cual.
 *
 * Los nombres con barra se validan con la regla de `DOMINIO\usuario`, más estricta que el patrón
 * general. Función pura.
 */
export function isValidIdentifier(name: unknown): boolean {
    if (typeof name !== "string" || name.length === 0 || name.length > MAX_IDENTIFIER_LENGTH) {
        return false;
    }
    if (name.includes(LINE_COMMENT)) {
        return false;
    }
    // Un espacio al principio o al final casi siempre es un error de copiado, y produce fallos
    // difíciles de ver: `[ Ventas]` no es `[Ventas]`.
    if (name !== name.trim()) {
        return false;
    }
    return looksLikeDomainPrincipal(name)
        ? isValidDomainPrincipal(name)
        : IDENTIFIER_PATTERN.test(name);
}

/**
 * Devuelve el identificador si es válido, y lanza si no.
 *
 * El mensaje **no incluye el valor rechazado**: puede venir de datos de un servidor de producción, y
 * los mensajes de error acaban en registros (regla 11.3 del brief).
 *
 * @throws Si el identificador no pasa la validación.
 */
export function assertIdentifier(name: unknown, what = "identificador"): string {
    if (!isValidIdentifier(name)) {
        throw new Error(
            `El ${what} no es válido para SQL Server: se esperaba un nombre de hasta ${MAX_IDENTIFIER_LENGTH} caracteres que empiece por letra o «_».`,
        );
    }
    return name as string;
}

/**
 * Valida y envuelve entre corchetes, como `QUOTENAME`.
 *
 * @throws Si el identificador no pasa la validación.
 */
export function quoteIdentifier(name: unknown, what = "identificador"): string {
    return `[${assertIdentifier(name, what)}]`;
}

/**
 * Valida y envuelve como literal de cadena Unicode, doblando las comillas simples.
 *
 * Hace falta porque algunas funciones del catálogo reciben el nombre como cadena y no como
 * identificador: `DB_ID(N'Ventas')`. Se valida con las mismas reglas que un identificador, porque
 * los únicos literales que este panel construye son nombres de objeto.
 *
 * El patrón ya rechaza la comilla simple, así que doblarla no cambia nada hoy: está como segunda
 * barrera, para que esta función siga siendo correcta si algún día el patrón se amplía.
 *
 * @throws Si el valor no pasa la validación.
 */
export function quoteLiteral(value: unknown, what = "identificador"): string {
    const validated = assertIdentifier(value, what);
    return `N'${validated.replace(/'/g, "''")}'`;
}

/**
 * Nombre en dos partes, `[esquema].[objeto]`, con las dos mitades validadas.
 *
 * @throws Si alguna de las dos no pasa la validación.
 */
export function quoteQualifiedName(schema: unknown, object: unknown): string {
    return `${quoteIdentifier(schema, "esquema")}.${quoteIdentifier(object, "objeto")}`;
}
