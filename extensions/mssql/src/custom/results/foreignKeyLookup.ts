/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { quoteIdentifier, quoteQualifiedName } from "../util/identifiers";

/**
 * Las dos consultas que hacen falta para «enséñame el registro al que apunta esta celda» (§31).
 *
 * ## La regla de siempre: cero interpolación de identificadores sin validar
 *
 * Los nombres de esquema, tabla y columna van en el **texto** de la sentencia —no se pueden
 * parametrizar—, así que pasan por `quoteIdentifier`/`quoteQualifiedName` de `util/identifiers.ts`,
 * que valida contra un patrón cerrado y **aborta** si no encaja. Es la regla 11.2 del brief, la
 * misma que sigue el panel de administración desde M3.
 *
 * ## El valor de la celda es otra cosa
 *
 * Un valor no es un identificador: puede ser cualquier texto, así que el patrón de
 * `identifiers.ts` no vale —rechazaría la mitad de los datos reales— y `quoteLiteral` tampoco, que
 * está escrito para nombres de objeto.
 *
 * Aquí se hacen dos cosas:
 *
 * 1. La consulta que lee la fila es **parametrizada de verdad**: se ejecuta con `sp_executesql` y el
 *    valor entra como `@valor`, no pegado al `WHERE`.
 * 2. Ese `@valor` sí viaja como literal en la llamada exterior, porque `query/simpleexecute` del STS
 *    solo acepta una cadena de consulta, sin parámetros. Se escribe como literal Unicode con las
 *    comillas simples dobladas, que es **la** forma de escapar un literal de cadena en T-SQL: no hay
 *    otro carácter de escape, así que con `QUOTED_IDENTIFIER ON` —el valor por omisión— un literal
 *    así no puede salirse de sus comillas.
 *
 * La comparación se hace contra `@valor` declarado como `nvarchar(4000)`. SQL Server convierte el
 * parámetro al tipo de la columna, no al revés, así que sigue pudiendo usar el índice: la
 * conversión cae del lado del parámetro.
 */

/** Más allá de esto no hay clave ajena que valga; es un aviso de que algo no es lo que parece. */
const MAX_VALUE_LENGTH = 4000;

/**
 * Consulta que dice de qué tabla sale cada columna de un resultado.
 *
 * **Por qué hace falta.** `columnInfo` del conjunto trae los campos `baseSchemaName`,
 * `baseTableName` y `baseColumnName`, que serían exactamente esto. Medido contra el STS
 * 6.0.20260915.1: **vienen los tres a `null`** en todas las columnas. Así que la tabla de origen se
 * le pregunta al servidor, que sí la sabe a partir del texto de la consulta.
 *
 * `sys.dm_exec_describe_first_result_set` **no ejecuta nada**: describe el primer conjunto de
 * resultados de un lote. El tercer argumento a 1 pide la información de exploración, que es la que
 * trae `source_schema`, `source_table` y `source_column`.
 *
 * @param batch El texto de la consulta, tal cual. Va como literal escapado; ver la cabecera.
 */
export function describeResultColumnsQuery(batch: string): string {
    return `
SELECT name, source_schema AS sourceSchema, source_table AS sourceTable, source_column AS sourceColumn
FROM sys.dm_exec_describe_first_result_set(${stringLiteral(batch)}, NULL, 1)
ORDER BY column_ordinal;`;
}

/** La restricción a la que pertenece una columna, y a dónde apunta. */
export interface ForeignKeyTarget {
    constraint: string;
    schema: string;
    table: string;
    column: string;
    /** Cuántas columnas tiene la restricción. Más de una y una celda no identifica la fila. */
    columnCount: number;
}

/**
 * Consulta que resuelve la clave ajena en la que participa una columna.
 *
 * Devuelve **todas** las restricciones en las que la columna participa; quien llama se queda con la
 * primera y mira `columnCount`. Una columna puede estar en más de una clave ajena, pero es raro y
 * elegir la primera es mejor que preguntar.
 *
 * @throws Si alguno de los tres nombres no pasa la validación de `identifiers.ts`.
 */
export function foreignKeyForColumnQuery(schema: string, table: string, column: string): string {
    // Se validan aquí aunque vayan como literal: un nombre que no pasa el patrón no puede venir de
    // un conjunto de resultados legítimo, y abortar es más barato que averiguar qué pasó luego.
    const schemaLiteral = stringLiteral(assertName(schema, "esquema"));
    const tableLiteral = stringLiteral(assertName(table, "tabla"));
    const columnLiteral = stringLiteral(assertName(column, "columna"));

    return `
SELECT
    fk.name                                          AS constraintName,
    SCHEMA_NAME(referenced.schema_id)                AS refSchema,
    referenced.name                                  AS refTable,
    refColumn.name                                   AS refColumn,
    (SELECT COUNT(*) FROM sys.foreign_key_columns c
      WHERE c.constraint_object_id = fk.object_id)   AS columnCount
FROM sys.foreign_key_columns AS fkc
JOIN sys.foreign_keys AS fk
    ON fk.object_id = fkc.constraint_object_id
JOIN sys.tables AS parent
    ON parent.object_id = fkc.parent_object_id
JOIN sys.columns AS parentColumn
    ON parentColumn.object_id = fkc.parent_object_id
   AND parentColumn.column_id = fkc.parent_column_id
JOIN sys.tables AS referenced
    ON referenced.object_id = fkc.referenced_object_id
JOIN sys.columns AS refColumn
    ON refColumn.object_id = fkc.referenced_object_id
   AND refColumn.column_id = fkc.referenced_column_id
WHERE SCHEMA_NAME(parent.schema_id) = ${schemaLiteral}
  AND parent.name = ${tableLiteral}
  AND parentColumn.name = ${columnLiteral}
ORDER BY fk.name;`;
}

/**
 * Consulta que lee la fila referenciada, con el valor como parámetro.
 *
 * `TOP (2)`, no `TOP (1)`: si la columna referenciada no fuera única, quien llama tiene que poder
 * notar que hay más de una fila en lugar de enseñar la primera como si fuera la única.
 *
 * @throws Si los nombres no validan, o si el valor pasa de `MAX_VALUE_LENGTH`.
 */
export function referencedRowQuery(target: ForeignKeyTarget, value: string): string {
    const qualified = quoteQualifiedName(target.schema, target.table);
    const column = quoteIdentifier(target.column, "columna");

    if (value.length > MAX_VALUE_LENGTH) {
        throw new Error(
            `El valor de la celda tiene ${value.length} caracteres y el máximo es ${MAX_VALUE_LENGTH}.`,
        );
    }

    // La sentencia interior lleva `@valor` de verdad. El literal de fuera es el único sitio donde
    // aparece el valor, y va escapado. Ver la cabecera del archivo.
    const inner = `SELECT TOP (2) * FROM ${qualified} WHERE ${column} = @valor`;
    return `EXEC sp_executesql ${stringLiteral(inner)}, N'@valor nvarchar(4000)', @valor = ${stringLiteral(value)};`;
}

/**
 * Literal de cadena Unicode con las comillas simples dobladas.
 *
 * No se reutiliza `quoteLiteral` de `util/identifiers.ts` a propósito: aquélla valida contra el
 * patrón de identificadores, que es lo correcto para un nombre de objeto y lo incorrecto para un
 * dato.
 */
export function stringLiteral(value: string): string {
    return `N'${value.replace(/'/g, "''")}'`;
}

/** Valida un nombre con las reglas del fork, para abortar antes de construir nada. */
function assertName(name: string, what: string): string {
    // `quoteIdentifier` lanza si no encaja; el resultado entre corchetes no se usa aquí, solo el
    // efecto de la validación.
    quoteIdentifier(name, what);
    return name;
}
