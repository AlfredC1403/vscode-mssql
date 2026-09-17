/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SimpleExecuteResult } from "vscode-mssql";

import { toRows } from "../../../src/custom/admin/sql/rows";
import { mapLogins } from "../../../src/custom/admin/sql/queries/logins";
import {
    mapMembersByRole,
    mapServerRoleMembership,
    mapServerRoles,
} from "../../../src/custom/admin/sql/queries/serverRoles";
import { mapServerPermissions } from "../../../src/custom/admin/sql/queries/serverPermissions";
import { mapInstanceProperties } from "../../../src/custom/admin/sql/queries/instanceProperties";
import {
    looksLikeMissingViewServerState,
    mapActiveSessions,
} from "../../../src/custom/admin/sql/queries/sessions";

/**
 * Construye un `SimpleExecuteResult` como el que devuelve el SQL Tools Service.
 *
 * `null` representa un NULL de SQL. Las columnas se declaran aparte de las filas, igual que en el
 * protocolo real, para que los tests ejerciten el mapeo por nombre y no por posición.
 */
function result(columns: string[], rows: (string | null)[][]): SimpleExecuteResult {
    return {
        rowCount: rows.length,
        columnInfo: columns.map((columnName) => ({ columnName }) as never),
        rows: rows.map((row) =>
            row.map((value) => ({
                displayValue: value ?? "NULL",
                isNull: value === null,
            })),
        ),
    } as SimpleExecuteResult;
}

suite("Fork: mapeo de filas", () => {
    test("lee por nombre de columna, no por posición", () => {
        // Mismas columnas en otro orden: el mapeo tiene que seguir funcionando.
        const [row] = toRows(result(["b", "a"], [["dos", "uno"]]));
        expect(row.text("a")).to.equal("uno");
        expect(row.text("b")).to.equal("dos");
    });

    test("no distingue mayúsculas en el nombre de la columna", () => {
        const [row] = toRows(result(["Product_Version"], [["16.0"]]));
        expect(row.text("product_version")).to.equal("16.0");
    });

    test("convierte NULL a cadena vacía, y a undefined si se pide opcional", () => {
        const [row] = toRows(result(["x"], [[null]]));
        expect(row.text("x")).to.equal("");
        expect(row.optionalText("x")).to.equal(undefined);
    });

    test("interpreta los bit de SQL Server como booleanos", () => {
        const [row] = toRows(result(["a", "b", "c"], [["1", "0", "true"]]));
        expect(row.boolean("a")).to.equal(true);
        expect(row.boolean("b")).to.equal(false);
        expect(row.boolean("c")).to.equal(true);
    });

    test("un número no válido cae al valor de reserva en lugar de dar NaN", () => {
        const [row] = toRows(result(["n", "m"], [["12", "no-es-un-numero"]]));
        expect(row.number("n")).to.equal(12);
        expect(row.number("m", -1)).to.equal(-1);
    });

    test("falla con un mensaje que nombra la columna que falta", () => {
        const [row] = toRows(result(["a"], [["uno"]]));
        expect(() => row.text("noExiste")).to.throw(/noExiste/);
    });

    test("un resultado vacío o ausente da cero filas", () => {
        expect(toRows(undefined)).to.have.length(0);
        expect(toRows(result(["a"], []))).to.have.length(0);
    });
});

suite("Fork: mapeo de logins", () => {
    const LOGIN_COLUMNS = [
        "name",
        "sid",
        "type_desc",
        "default_database_name",
        "is_disabled",
        "create_date",
        "is_policy_checked",
        "is_expiration_checked",
    ];

    test("mapea un login SQL con su política y sus roles", () => {
        const logins = result(LOGIN_COLUMNS, [
            ["parity_user", "0x81", "SQL_LOGIN", "master", "0", "2026-09-17T17:36:25", "1", "0"],
        ]);
        const membership = new Map([["parity_user", ["dbcreator", "public"]]]);

        const [login] = mapLogins(logins, membership);

        expect(login.name).to.equal("parity_user");
        expect(login.sid).to.equal("0x81");
        expect(login.type).to.equal("SQL_LOGIN");
        expect(login.defaultDatabase).to.equal("master");
        expect(login.disabled).to.equal(false);
        expect(login.passwordPolicy).to.equal(true);
        expect(login.passwordExpiration).to.equal(false);
        expect(login.serverRoles).to.deep.equal(["dbcreator", "public"]);
    });

    test("distingue login de Windows y grupo de Windows", () => {
        const logins = result(LOGIN_COLUMNS, [
            ["DOMINIO\\ana", "0x01", "WINDOWS_LOGIN", "master", "0", "", "0", "0"],
            ["BUILTIN\\Administrators", "0x02", "WINDOWS_GROUP", "master", "0", "", "0", "0"],
        ]);

        const mapped = mapLogins(logins);

        expect(mapped.map((l) => l.type)).to.deep.equal(["WINDOWS_LOGIN", "WINDOWS_GROUP"]);
    });

    test("un login deshabilitado se marca como tal", () => {
        const logins = result(LOGIN_COLUMNS, [
            ["viejo", "0x03", "SQL_LOGIN", "master", "1", "", "1", "1"],
        ]);

        expect(mapLogins(logins)[0].disabled).to.equal(true);
    });

    test("sin mapa de roles, cada login queda sin roles en lugar de fallar", () => {
        const logins = result(LOGIN_COLUMNS, [
            ["sa", "0x01", "SQL_LOGIN", "master", "0", "", "0", "0"],
        ]);

        expect(mapLogins(logins)[0].serverRoles).to.deep.equal([]);
    });

    test("un type_desc inesperado no rompe el panel", () => {
        const logins = result(LOGIN_COLUMNS, [
            ["raro", "0x04", "ALGO_NUEVO", "master", "0", "", "0", "0"],
        ]);

        expect(mapLogins(logins)[0].type).to.equal("SQL_LOGIN");
    });
});

suite("Fork: mapeo de roles de servidor", () => {
    const MEMBERS = result(
        ["role_name", "member_name"],
        [
            ["dbcreator", "parity_user"],
            ["sysadmin", "sa"],
            ["sysadmin", "BUILTIN\\Administrators"],
        ],
    );

    test("agrupa miembros por rol", () => {
        const byRole = mapMembersByRole(MEMBERS);

        expect(byRole.get("sysadmin")).to.deep.equal(["sa", "BUILTIN\\Administrators"]);
        expect(byRole.get("dbcreator")).to.deep.equal(["parity_user"]);
    });

    test("invierte a roles por miembro, que es lo que necesita cada login", () => {
        const byMember = mapServerRoleMembership(MEMBERS);

        expect(byMember.get("sa")).to.deep.equal(["sysadmin"]);
        expect(byMember.get("parity_user")).to.deep.equal(["dbcreator"]);
    });

    test("un rol sin miembros sale con la lista vacía, no ausente", () => {
        const roles = result(
            ["name", "is_fixed", "owner_name"],
            [
                ["sysadmin", "1", "sa"],
                ["auditores", "0", "sa"],
            ],
        );

        const mapped = mapServerRoles(roles, MEMBERS);

        expect(mapped).to.have.length(2);
        expect(mapped[0].name).to.equal("sysadmin");
        expect(mapped[0].fixed).to.equal(true);
        expect(mapped[0].members).to.deep.equal(["sa", "BUILTIN\\Administrators"]);
        expect(mapped[1].name).to.equal("auditores");
        expect(mapped[1].fixed).to.equal(false);
        expect(mapped[1].members).to.deep.equal([]);
    });
});

suite("Fork: mapeo de permisos de servidor", () => {
    const PERMISSION_COLUMNS = [
        "grantee",
        "grantee_type",
        "permission_name",
        "state_desc",
        "state",
        "class_desc",
        "securable",
    ];

    test("traduce los códigos de estado del motor", () => {
        const permissions = result(PERMISSION_COLUMNS, [
            ["sa", "SQL_LOGIN", "CONNECT SQL", "GRANT", "G", "SERVER", ""],
            ["invitado", "SQL_LOGIN", "CONNECT SQL", "DENY", "D", "SERVER", ""],
            [
                "auditor",
                "SQL_LOGIN",
                "VIEW ANY DEFINITION",
                "GRANT_WITH_GRANT_OPTION",
                "W",
                "SERVER",
                "",
            ],
            ["otro", "SQL_LOGIN", "ALTER ANY LOGIN", "REVOKE", "R", "SERVER", ""],
        ]);

        const mapped = mapServerPermissions(permissions);

        expect(mapped.map((p) => p.state)).to.deep.equal([
            "GRANT",
            "DENY",
            "GRANT_WITH_GRANT_OPTION",
            "REVOKE",
        ]);
        // El texto del motor se conserva sin traducir, para no perder información.
        expect(mapped[2].stateDescription).to.equal("GRANT_WITH_GRANT_OPTION");
    });

    test("un código desconocido se trata como revocado, que es lo conservador", () => {
        const permissions = result(PERMISSION_COLUMNS, [
            ["x", "SQL_LOGIN", "ALGO", "?", "Z", "SERVER", ""],
        ]);

        expect(mapServerPermissions(permissions)[0].state).to.equal("REVOKE");
    });

    test("distingue el objeto sobre el que cae cada permiso", () => {
        // El caso real: `public` tiene CONNECT sobre los cuatro puntos de conexión de fábrica.
        const permissions = result(PERMISSION_COLUMNS, [
            ["public", "SERVER_ROLE", "CONNECT", "GRANT", "G", "ENDPOINT", "TSQL Default TCP"],
            ["public", "SERVER_ROLE", "CONNECT", "GRANT", "G", "ENDPOINT", "TSQL Named Pipes"],
            ["ana", "SQL_LOGIN", "IMPERSONATE", "GRANT", "G", "SERVER_PRINCIPAL", "sa"],
            ["ana", "SQL_LOGIN", "CONNECT SQL", "GRANT", "G", "SERVER", ""],
            ["ana", "SQL_LOGIN", "ALGO", "GRANT", "G", "CLASE_NUEVA", "objeto"],
        ]);

        const mapped = mapServerPermissions(permissions);

        expect(mapped[0].securableClass).to.equal("ENDPOINT");
        expect(mapped[0].securable).to.equal("TSQL Default TCP");
        expect(mapped[1].securable).to.equal("TSQL Named Pipes");
        expect(mapped[2].securableClass).to.equal("SERVER_PRINCIPAL");
        expect(mapped[2].securable).to.equal("sa");
        // Sobre la instancia entera no hay objeto que nombrar.
        expect(mapped[3].securableClass).to.equal("SERVER");
        expect(mapped[3].securable).to.equal("");
        // Una clase que el motor añada en el futuro no rompe el panel.
        expect(mapped[4].securableClass).to.equal("OTHER");
    });

    test("conserva el orden en que llegan las filas", () => {
        const permissions = result(PERMISSION_COLUMNS, [
            ["ana", "SQL_LOGIN", "CONNECT SQL", "GRANT", "G", "SERVER", ""],
            ["ana", "SQL_LOGIN", "VIEW ANY DATABASE", "GRANT", "G", "SERVER", ""],
            ["beto", "SQL_LOGIN", "CONNECT SQL", "DENY", "D", "SERVER", ""],
        ]);

        const mapped = mapServerPermissions(permissions);

        expect(mapped.map((p) => `${p.grantee}:${p.permission}`)).to.deep.equal([
            "ana:CONNECT SQL",
            "ana:VIEW ANY DATABASE",
            "beto:CONNECT SQL",
        ]);
    });
});

suite("Fork: mapeo de propiedades de la instancia", () => {
    const PROPERTY_COLUMNS = [
        "server_name",
        "machine_name",
        "instance_name",
        "product_version",
        "product_level",
        "edition",
        "engine_edition",
        "collation_name",
        "integrated_security_only",
        "is_clustered",
        "is_hadr_enabled",
        "default_data_path",
        "default_log_path",
        "backup_path",
        "error_log_path",
        "max_server_memory_mb",
        "min_server_memory_mb",
    ];

    const PROPERTIES = result(PROPERTY_COLUMNS, [
        [
            "SQLDEV01",
            "SQLDEV01",
            "",
            "16.0.4295.3",
            "RTM",
            "Developer Edition (64-bit)",
            "3",
            "SQL_Latin1_General_CP1_CI_AS",
            "0",
            "0",
            "0",
            "/var/opt/mssql/data/",
            "/var/opt/mssql/data/",
            "/var/opt/mssql/data",
            "/var/opt/mssql/log/errorlog",
            "2147483647",
            "16",
        ],
    ]);

    test("mapea versión, edición, collation y rutas", () => {
        const properties = mapInstanceProperties(PROPERTIES);

        expect(properties.serverName).to.equal("SQLDEV01");
        expect(properties.productVersion).to.equal("16.0.4295.3");
        expect(properties.edition).to.equal("Developer Edition (64-bit)");
        expect(properties.engineEdition).to.equal("Enterprise");
        expect(properties.collation).to.equal("SQL_Latin1_General_CP1_CI_AS");
        expect(properties.defaultDataPath).to.equal("/var/opt/mssql/data/");
        expect(properties.errorLogPath).to.equal("/var/opt/mssql/log/errorlog");
    });

    test("traduce IsIntegratedSecurityOnly al modo de autenticación", () => {
        const mixed = mapInstanceProperties(PROPERTIES);
        expect(mixed.authenticationMode).to.contain("modo mixto");

        const windowsOnlyRow = [...PROPERTIES.rows[0]];
        windowsOnlyRow[PROPERTY_COLUMNS.indexOf("integrated_security_only")] = {
            displayValue: "1",
            isNull: false,
        } as never;
        const windowsOnly = mapInstanceProperties({
            ...PROPERTIES,
            rows: [windowsOnlyRow],
        } as SimpleExecuteResult);

        expect(windowsOnly.authenticationMode).to.contain("Windows");
        expect(windowsOnly.authenticationMode).to.not.contain("mixto");
    });

    test("sin la consulta de ejecución, los campos que dependen de ella quedan vacíos", () => {
        // Es el caso de un login sin VIEW SERVER STATE: la vista lo detecta y lo explica.
        const properties = mapInstanceProperties(PROPERTIES, undefined);

        expect(properties.cpuCount).to.equal(0);
        expect(properties.physicalMemoryMb).to.equal(0);
        expect(properties.startTime).to.equal("");
        // Lo que no depende del permiso sigue estando.
        expect(properties.collation).to.equal("SQL_Latin1_General_CP1_CI_AS");
    });

    test("incorpora los datos de ejecución cuando sí se pudieron leer", () => {
        const runtime = result(
            ["cpu_count", "physical_memory_mb", "start_time"],
            [["4", "12876", "2026-09-17T21:52:44.853"]],
        );

        const properties = mapInstanceProperties(PROPERTIES, runtime);

        expect(properties.cpuCount).to.equal(4);
        expect(properties.physicalMemoryMb).to.equal(12876);
        expect(properties.startTime).to.equal("2026-09-17T21:52:44.853");
    });

    test("una edición de motor desconocida se muestra con su número", () => {
        const row = [...PROPERTIES.rows[0]];
        row[PROPERTY_COLUMNS.indexOf("engine_edition")] = {
            displayValue: "99",
            isNull: false,
        } as never;

        const properties = mapInstanceProperties({
            ...PROPERTIES,
            rows: [row],
        } as SimpleExecuteResult);

        expect(properties.engineEdition).to.contain("99");
    });

    test("un resultado sin filas devuelve undefined en lugar de un objeto a medias", () => {
        expect(mapInstanceProperties(result(PROPERTY_COLUMNS, []))).to.equal(undefined);
        expect(mapInstanceProperties(undefined)).to.equal(undefined);
    });
});

suite("Fork: mapeo de sesiones activas", () => {
    const SESSION_COLUMNS = [
        "session_id",
        "login_name",
        "host_name",
        "program_name",
        "status",
        "database_name",
        "login_time",
        "last_request_start_time",
        "last_statement",
        "is_current_session",
        "cpu_time",
        "logical_reads",
        "open_transaction_count",
    ];

    test("mapea la sesión y recorta el texto de la sentencia", () => {
        const sessions = result(SESSION_COLUMNS, [
            [
                "53",
                "sa",
                "vm",
                "SQLWorks",
                "running",
                "ParityDb",
                "2026-09-17T21:52:49",
                "2026-09-17T21:52:49",
                "\n   SELECT 1\n",
                "1",
                "79",
                "2941",
                "0",
            ],
        ]);

        const [session] = mapActiveSessions(sessions);

        expect(session.sessionId).to.equal(53);
        expect(session.loginName).to.equal("sa");
        expect(session.databaseName).to.equal("ParityDb");
        expect(session.isCurrentSession).to.equal(true);
        expect(session.cpuTimeMs).to.equal(79);
        expect(session.logicalReads).to.equal(2941);
        // El texto del lote viene con saltos de línea y sangría delante.
        expect(session.lastStatement).to.equal("SELECT 1");
    });

    test("detecta que solo se ve la sesión propia, el síntoma de no tener VIEW SERVER STATE", () => {
        const onlyMine = result(SESSION_COLUMNS, [
            ["53", "ana", "vm", "SQLWorks", "running", "ParityDb", "", "", "", "1", "0", "0", "0"],
        ]);

        expect(looksLikeMissingViewServerState(mapActiveSessions(onlyMine))).to.equal(true);
    });

    test("con más de una sesión, no se avisa de nada", () => {
        const several = result(SESSION_COLUMNS, [
            ["53", "ana", "vm", "SQLWorks", "running", "ParityDb", "", "", "", "1", "0", "0", "0"],
            ["51", "beto", "pc", "SSMS", "sleeping", "master", "", "", "", "0", "0", "0", "0"],
        ]);

        expect(looksLikeMissingViewServerState(mapActiveSessions(several))).to.equal(false);
    });

    test("una sola sesión que no es la propia tampoco dispara el aviso", () => {
        const other = result(SESSION_COLUMNS, [
            ["51", "beto", "pc", "SSMS", "sleeping", "master", "", "", "", "0", "0", "0", "0"],
        ]);

        expect(looksLikeMissingViewServerState(mapActiveSessions(other))).to.equal(false);
    });
});
