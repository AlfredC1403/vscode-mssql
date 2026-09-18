/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { SimpleExecuteResult } from "vscode-mssql";
import { InstanceProperties } from "../types";
import { toRows } from "../rows";

/**
 * Propiedades de la instancia (§8.4 del brief). El brief no traía esta consulta.
 *
 * Va en **dos** consultas a propósito:
 *
 * 1. `INSTANCE_PROPERTIES_SQL` usa `SERVERPROPERTY` y `sys.configurations`, legibles por cualquier
 *    login.
 * 2. `INSTANCE_RUNTIME_SQL` usa `sys.dm_os_sys_info`, que exige `VIEW SERVER STATE`.
 *
 * Separadas, un login sin ese permiso sigue viendo versión, edición, collation, modo de
 * autenticación y rutas; solo pierde memoria física, CPU y fecha de arranque. Si fueran una sola
 * consulta se perdería todo.
 *
 * `SERVERPROPERTY` devuelve NULL para una propiedad que no existe en esa versión del motor, así
 * que pedir `InstanceDefaultBackupPath` o `ErrorLogFileName` no rompe en versiones antiguas.
 */
export const INSTANCE_PROPERTIES_SQL = `
SELECT CONVERT(nvarchar(256), SERVERPROPERTY('ServerName'))                  AS server_name,
       CONVERT(nvarchar(256), SERVERPROPERTY('MachineName'))                 AS machine_name,
       ISNULL(CONVERT(nvarchar(256), SERVERPROPERTY('InstanceName')), N'')   AS instance_name,
       CONVERT(nvarchar(128), SERVERPROPERTY('ProductVersion'))              AS product_version,
       CONVERT(nvarchar(128), SERVERPROPERTY('ProductLevel'))                AS product_level,
       CONVERT(nvarchar(128), SERVERPROPERTY('Edition'))                     AS edition,
       CONVERT(int, SERVERPROPERTY('EngineEdition'))                         AS engine_edition,
       CONVERT(nvarchar(128), SERVERPROPERTY('Collation'))                   AS collation_name,
       CONVERT(int, SERVERPROPERTY('IsIntegratedSecurityOnly'))              AS integrated_security_only,
       ISNULL(CONVERT(int, SERVERPROPERTY('IsClustered')), 0)                AS is_clustered,
       ISNULL(CONVERT(int, SERVERPROPERTY('IsHadrEnabled')), 0)              AS is_hadr_enabled,
       ISNULL(CONVERT(nvarchar(512), SERVERPROPERTY('InstanceDefaultDataPath')), N'')   AS default_data_path,
       ISNULL(CONVERT(nvarchar(512), SERVERPROPERTY('InstanceDefaultLogPath')), N'')    AS default_log_path,
       ISNULL(CONVERT(nvarchar(512), SERVERPROPERTY('InstanceDefaultBackupPath')), N'') AS backup_path,
       ISNULL(CONVERT(nvarchar(512), SERVERPROPERTY('ErrorLogFileName')), N'')          AS error_log_path,
       ISNULL((SELECT CONVERT(bigint, c.value_in_use) FROM sys.configurations AS c
               WHERE c.name = N'max server memory (MB)'), 0)                 AS max_server_memory_mb,
       ISNULL((SELECT CONVERT(bigint, c.value_in_use) FROM sys.configurations AS c
               WHERE c.name = N'min server memory (MB)'), 0)                 AS min_server_memory_mb;
`;

/** Datos de ejecución de la instancia. Exige `VIEW SERVER STATE`. */
export const INSTANCE_RUNTIME_SQL = `
SELECT si.cpu_count,
       CONVERT(bigint, si.physical_memory_kb / 1024)                  AS physical_memory_mb,
       CONVERT(varchar(33), si.sqlserver_start_time, 126)             AS start_time
FROM sys.dm_os_sys_info AS si;
`;

/**
 * Nombres legibles de `EngineEdition`.
 * https://learn.microsoft.com/sql/t-sql/functions/serverproperty-transact-sql
 */
const ENGINE_EDITIONS: Record<number, string> = {
    1: "Personal o Desktop Engine",
    2: "Standard",
    3: "Enterprise",
    4: "Express",
    5: "Azure SQL Database",
    6: "Azure Synapse Analytics",
    8: "Azure SQL Managed Instance",
    9: "Azure SQL Edge",
    11: "Azure Synapse serverless SQL pool",
};

/**
 * Mapea las dos consultas a `InstanceProperties`. Función pura.
 *
 * @param propertiesResult Resultado de `INSTANCE_PROPERTIES_SQL`.
 * @param runtimeResult Resultado de `INSTANCE_RUNTIME_SQL`, o `undefined` si el login no tiene
 *   `VIEW SERVER STATE`. En ese caso los campos de ejecución quedan a cero o vacíos.
 */
export function mapInstanceProperties(
    propertiesResult: SimpleExecuteResult | undefined,
    runtimeResult?: SimpleExecuteResult | undefined,
): InstanceProperties | undefined {
    const [properties] = toRows(propertiesResult);
    if (!properties) {
        return undefined;
    }

    const [runtime] = toRows(runtimeResult);
    const engineEdition = properties.number("engine_edition");

    return {
        serverName: properties.text("server_name"),
        machineName: properties.text("machine_name"),
        instanceName: properties.text("instance_name"),
        productVersion: properties.text("product_version"),
        productLevel: properties.text("product_level"),
        edition: properties.text("edition"),
        engineEdition: ENGINE_EDITIONS[engineEdition] ?? `Desconocida (${engineEdition})`,
        collation: properties.text("collation_name"),
        // IsIntegratedSecurityOnly: 1 = solo Windows, 0 = modo mixto.
        authenticationMode: properties.boolean("integrated_security_only")
            ? "Solo autenticación de Windows"
            : "Windows y SQL Server (modo mixto)",
        isClustered: properties.boolean("is_clustered"),
        isHadrEnabled: properties.boolean("is_hadr_enabled"),
        defaultDataPath: properties.text("default_data_path"),
        defaultLogPath: properties.text("default_log_path"),
        backupPath: properties.text("backup_path"),
        errorLogPath: properties.text("error_log_path"),
        maxServerMemoryMb: properties.number("max_server_memory_mb"),
        minServerMemoryMb: properties.number("min_server_memory_mb"),
        physicalMemoryMb: runtime?.number("physical_memory_mb") ?? 0,
        cpuCount: runtime?.number("cpu_count") ?? 0,
        startTime: runtime?.text("start_time") ?? "",
    };
}

/**
 * `max server memory` por defecto es 2147483647 MB, que significa «sin límite». Mostrar ese
 * número entero no dice nada.
 */
export const UNLIMITED_SERVER_MEMORY_MB = 2147483647;
