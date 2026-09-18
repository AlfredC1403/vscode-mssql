/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SimpleExecuteResult } from "vscode-mssql";

import {
    buildKillStatement,
    buildSessionSnapshotStatement,
    canKillSessions,
    isSameSession,
    mapKillPermissions,
    mapSessionSnapshot,
} from "../../../src/custom/admin/sql/queries/killSession";
import { ActiveSession, KillPermissions } from "../../../src/custom/admin/sql/types";
import { formatSeconds } from "../../../src/custom/sharedInterfaces/duration";

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

const PERMISSION_COLUMNS = [
    "current_session_id",
    "login_name",
    "is_sysadmin",
    "is_processadmin",
    "has_alter_any_connection",
];

function permissions(overrides: Partial<KillPermissions> = {}): KillPermissions {
    return {
        currentSessionId: 51,
        loginName: "sa",
        isSysadmin: false,
        isProcessAdmin: false,
        hasAlterAnyConnection: false,
        ...overrides,
    };
}

function session(overrides: Partial<ActiveSession> = {}): ActiveSession {
    return {
        sessionId: 78,
        loginName: "app_user",
        hostName: "WS-14",
        programName: "SQLWorks",
        status: "sleeping",
        databaseName: "Ventas",
        loginTime: "2026-09-17T21:40:11.123",
        lastRequestStartTime: "2026-09-17T21:41:00.000",
        lastStatement: "UPDATE ventas.Cliente SET nombre = 'x'",
        isCurrentSession: false,
        cpuTimeMs: 12,
        logicalReads: 3,
        openTransactionCount: 1,
        oldestTransactionStart: "2026-09-17T21:40:30.000",
        longestOpenTransactionSeconds: 95,
        ...overrides,
    };
}

suite("Fork: sentencia KILL", () => {
    test("construye la sentencia con el identificador validado", () => {
        expect(buildKillStatement(78)).to.equal("KILL 78;");
    });

    test("aborta en lugar de escapar cuando el identificador no es un entero positivo", () => {
        // La regla 11.2 del brief: validar y abortar, nunca intentar escapar a mano.
        const invalid: unknown[] = [
            0,
            -1,
            1.5,
            NaN,
            Infinity,
            "78",
            "78; DROP DATABASE Ventas",
            "1 OR 1=1",
            null,
            undefined,
            {},
        ];
        for (const value of invalid) {
            expect(
                () => buildKillStatement(value as number),
                `debería rechazar ${String(value)}`,
            ).to.throw(/no válido/);
        }
    });

    test("la consulta de identidad lleva el identificador y también lo valida", () => {
        expect(buildSessionSnapshotStatement(78)).to.contain("s.session_id = 78");
        expect(() => buildSessionSnapshotStatement("78 OR 1=1" as unknown as number)).to.throw(
            /no válido/,
        );
    });
});

suite("Fork: permisos para terminar sesiones", () => {
    test("mapea lo que devuelve el servidor", () => {
        const mapped = mapKillPermissions(
            result(PERMISSION_COLUMNS, [["51", "sa", "1", "1", "1"]]),
        );

        expect(mapped).to.deep.equal({
            currentSessionId: 51,
            loginName: "sa",
            isSysadmin: true,
            isProcessAdmin: true,
            hasAlterAnyConnection: true,
        });
    });

    test("sin filas no se inventa un permiso", () => {
        expect(mapKillPermissions(result(PERMISSION_COLUMNS, []))).to.equal(undefined);
        expect(mapKillPermissions(undefined)).to.equal(undefined);
    });

    test("cualquiera de los tres caminos habilita KILL, y ninguno lo niega", () => {
        expect(canKillSessions(permissions({ isSysadmin: true }))).to.equal(true);
        expect(canKillSessions(permissions({ isProcessAdmin: true }))).to.equal(true);
        expect(canKillSessions(permissions({ hasAlterAnyConnection: true }))).to.equal(true);
        expect(canKillSessions(permissions())).to.equal(false);
        // Lo desconocido no habilita: es lo conservador.
        expect(canKillSessions(undefined)).to.equal(false);
    });
});

suite("Fork: identidad de la sesión antes de terminarla", () => {
    const SNAPSHOT_COLUMNS = [
        "session_id",
        "login_name",
        "host_name",
        "program_name",
        "login_time",
    ];

    test("mapea la identidad que devuelve el servidor", () => {
        const snapshot = mapSessionSnapshot(
            result(SNAPSHOT_COLUMNS, [
                ["78", "app_user", "WS-14", "SQLWorks", "2026-09-17T21:40:11.123"],
            ]),
        );

        expect(snapshot.sessionId).to.equal(78);
        expect(snapshot.loginTime).to.equal("2026-09-17T21:40:11.123");
    });

    test("una sesión que ya no existe no devuelve identidad", () => {
        expect(mapSessionSnapshot(result(SNAPSHOT_COLUMNS, []))).to.equal(undefined);
    });

    test("reconoce la misma sesión", () => {
        const snapshot = mapSessionSnapshot(
            result(SNAPSHOT_COLUMNS, [
                ["78", "app_user", "WS-14", "SQLWorks", "2026-09-17T21:40:11.123"],
            ]),
        );

        expect(isSameSession(snapshot, session())).to.equal(true);
    });

    test("detecta que el identificador se reutilizó", () => {
        // SQL Server reutiliza los identificadores en cuanto se liberan: comprobado contra el
        // servidor real. El momento de inicio de sesión es lo que delata el cambio.
        const reused = mapSessionSnapshot(
            result(SNAPSHOT_COLUMNS, [
                ["78", "app_user", "WS-14", "SQLWorks", "2026-09-17T22:05:00.000"],
            ]),
        );
        expect(isSameSession(reused, session())).to.equal(false);

        const otherLogin = mapSessionSnapshot(
            result(SNAPSHOT_COLUMNS, [
                ["78", "otro_login", "WS-14", "SQLWorks", "2026-09-17T21:40:11.123"],
            ]),
        );
        expect(isSameSession(otherLogin, session())).to.equal(false);

        const otherHost = mapSessionSnapshot(
            result(SNAPSHOT_COLUMNS, [
                ["78", "app_user", "WS-99", "SQLWorks", "2026-09-17T21:40:11.123"],
            ]),
        );
        expect(isSameSession(otherHost, session())).to.equal(false);
    });
});

suite("Fork: formato de duraciones", () => {
    test("se queda en dos unidades", () => {
        expect(formatSeconds(45)).to.equal("45 s");
        expect(formatSeconds(60)).to.equal("1 min");
        expect(formatSeconds(200)).to.equal("3 min 20 s");
        expect(formatSeconds(3600)).to.equal("1 h");
        expect(formatSeconds(7500)).to.equal("2 h 5 min");
        expect(formatSeconds(86400)).to.equal("1 d");
        expect(formatSeconds(97200)).to.equal("1 d 3 h");
    });

    test("sin transacción abierta no hay duración que mostrar", () => {
        expect(formatSeconds(0)).to.equal("");
        expect(formatSeconds(-5)).to.equal("");
        expect(formatSeconds(NaN)).to.equal("");
    });
});
