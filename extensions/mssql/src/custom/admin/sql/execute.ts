/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { RequestType } from "vscode-languageclient";
import { SimpleExecuteResult } from "vscode-mssql";

import ConnectionManager from "../../../controllers/connectionManager";

/**
 * `query/simpleexecute` del SQL Tools Service: ejecuta una consulta sobre una conexión ya abierta
 * y devuelve el primer conjunto de resultados. Es el patrón que usa el propio upstream en
 * `src/services/schemaService.ts` y en las herramientas de Copilot (ver FORK.md §4.1).
 */
const SimpleExecuteRequest = new RequestType<
    { ownerUri: string; queryString: string },
    SimpleExecuteResult,
    void
>("query/simpleexecute");

/** Resultado tolerante: o trae datos, o trae el motivo por el que no pudo leerlos. */
export interface QueryOutcome {
    result?: SimpleExecuteResult;
    errorMessage?: string;
}

/**
 * Ejecuta las consultas de administración sobre la conexión que la extensión ya tiene abierta.
 *
 * **Solo lectura.** En M3 no hay una sola sentencia que modifique nada: todas las consultas de
 * `queries/` son `SELECT`. La ejecución de DDL llega en M5, con vista previa del script,
 * confirmación y transacción explícita (§11 del brief).
 */
export class AdminQueryRunner {
    constructor(
        private readonly connectionManager: ConnectionManager,
        private readonly connectionUri: string,
    ) {}

    /** Ejecuta la consulta y propaga el error si falla. */
    public async run(queryString: string): Promise<SimpleExecuteResult> {
        return await this.connectionManager.sendRequest(SimpleExecuteRequest, {
            ownerUri: this.connectionUri,
            queryString,
        });
    }

    /**
     * Ejecuta la consulta y, si falla, devuelve el motivo en lugar de lanzarlo.
     *
     * Para las secciones que dependen de un permiso que el login puede no tener, como
     * `VIEW SERVER STATE`: el panel muestra lo que sí pudo leer y explica lo que no, en vez de
     * quedarse en blanco entero.
     */
    public async tryRun(queryString: string): Promise<QueryOutcome> {
        try {
            return { result: await this.run(queryString) };
        } catch (error) {
            return { errorMessage: describeQueryError(error) };
        }
    }
}

/**
 * Convierte el error del STS en algo que se pueda mostrar.
 *
 * **No añade** la consulta ni ningún parámetro, pero devuelve el mensaje del controlador tal cual, y
 * de lo que ese mensaje trae no manda este archivo. Desde M6 el lote puede llevar una contraseña, así
 * que quien la conoce —`WriteGate.runPlan`— tacha el valor del mensaje antes de devolverlo
 * (`redactSecrets`). La garantía de la regla 11.3 está ahí, no aquí.
 */
export function describeQueryError(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === "string" && error) {
        return error;
    }
    const message = (error as { message?: unknown })?.message;
    return typeof message === "string" && message
        ? message
        : "El servidor rechazó la consulta y no dio un motivo.";
}
