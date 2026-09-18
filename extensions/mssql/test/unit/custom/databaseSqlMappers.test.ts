/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SimpleExecuteResult } from "vscode-mssql";

import { DATABASES_SQL, mapDatabases } from "../../../src/custom/admin/sql/queries/databases";
import {
    buildDatabaseUsersStatement,
    buildRoleMembershipStatement,
    mapDatabaseUsers,
    mapRoleMemberships,
    mapRolesByMember,
} from "../../../src/custom/admin/sql/queries/databaseUsers";
import {
    buildDatabaseRolesStatement,
    mapDatabaseRoles,
} from "../../../src/custom/admin/sql/queries/databaseRoles";
import { buildSchemasStatement, mapSchemas } from "../../../src/custom/admin/sql/queries/schemas";
import {
    buildDatabasePermissionsStatement,
    mapDatabasePermissions,
} from "../../../src/custom/admin/sql/queries/databasePermissions";

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

suite("Fork: consultas de base de datos sin USE", () => {
    test("todas llegan al catálogo con nombre de tres partes y el nombre entrecomillado", () => {
        // Sin esto habría que hacer `USE`, y el panel comparte conexión con el editor del usuario.
        for (const statement of [
            buildDatabaseUsersStatement("ParityDb"),
            buildRoleMembershipStatement("ParityDb"),
            buildDatabaseRolesStatement("ParityDb"),
            buildSchemasStatement("ParityDb"),
            buildDatabasePermissionsStatement("ParityDb"),
        ]) {
            expect(statement).to.contain("[ParityDb].sys.");
            expect(statement.toUpperCase(), "ninguna cambia de base").to.not.contain("USE ");
        }
    });

    test("un nombre de base que no pasa la validación aborta la consulta", () => {
        for (const build of [
            buildDatabaseUsersStatement,
            buildRoleMembershipStatement,
            buildDatabaseRolesStatement,
            buildSchemasStatement,
            buildDatabasePermissionsStatement,
        ]) {
            expect(() => build("Parity]Db"), "corchete de cierre").to.throw(/no es válido/);
            expect(() => build("x; DROP DATABASE y"), "punto y coma").to.throw(/no es válido/);
            expect(() => build(""), "vacío").to.throw(/no es válido/);
        }
    });

    test("la consulta de bases de datos no interpola nada", () => {
        expect(DATABASES_SQL).to.contain("sys.databases");
        expect(DATABASES_SQL).to.not.contain("${");
    });
});

suite("Fork: mapeo de bases de datos", () => {
    const COLUMNS = ["name", "database_id", "owner", "has_access"];

    test("distingue las del sistema y las inaccesibles", () => {
        const databases = mapDatabases(
            result(COLUMNS, [
                ["ParityDb", "5", "sa", "1"],
                ["master", "1", "sa", "1"],
                ["Ajena", "7", "otro", "0"],
            ]),
        );

        expect(databases[0]).to.deep.equal({
            name: "ParityDb",
            system: false,
            accessible: true,
            owner: "sa",
        });
        expect(databases[1].system, "master es del sistema").to.equal(true);
        // Una base que existe y no se puede abrir sale en la lista, marcada.
        expect(databases[2].accessible).to.equal(false);
    });
});

suite("Fork: mapeo de usuarios de base de datos", () => {
    const COLUMNS = [
        "name",
        "type_desc",
        "default_schema",
        "authentication",
        "create_date",
        "login_name",
        "is_system",
    ];

    test("mapea el usuario con su login y sus roles", () => {
        const memberships = mapRoleMemberships(
            result(
                ["role_name", "member_name", "member_type"],
                [["ventas_lectores", "parity_user", "SQL_USER"]],
            ),
        );

        const users = mapDatabaseUsers(
            result(COLUMNS, [
                [
                    "parity_user",
                    "SQL_USER",
                    "ventas",
                    "INSTANCE",
                    "2026-09-17T17:36:25.177",
                    "parity_user",
                    "0",
                ],
            ]),
            mapRolesByMember(memberships),
        );

        expect(users[0].name).to.equal("parity_user");
        expect(users[0].type).to.equal("SQL_USER");
        expect(users[0].loginName).to.equal("parity_user");
        expect(users[0].defaultSchema).to.equal("ventas");
        expect(users[0].authentication).to.equal("INSTANCE");
        expect(users[0].system).to.equal(false);
        expect(users[0].roles).to.deep.equal(["ventas_lectores"]);
    });

    test("un usuario sin login se ve igual, sin login", () => {
        const users = mapDatabaseUsers(
            result(COLUMNS, [
                ["analista", "SQL_USER", "ventas", "NONE", "2026-09-17T23:49:53.533", "", "0"],
            ]),
            new Map(),
        );

        expect(users[0].loginName).to.equal("");
        expect(users[0].authentication).to.equal("NONE");
        expect(users[0].roles).to.deep.equal([]);
    });

    test("marca los cuatro usuarios que crea SQL Server", () => {
        const users = mapDatabaseUsers(
            result(COLUMNS, [
                ["dbo", "SQL_USER", "dbo", "INSTANCE", "", "sa", "1"],
                ["guest", "SQL_USER", "guest", "NONE", "", "", "1"],
            ]),
            new Map(),
        );

        expect(users.every((user) => user.system)).to.equal(true);
    });

    test("un tipo que el motor añada en el futuro no rompe la rejilla", () => {
        const users = mapDatabaseUsers(
            result(COLUMNS, [["raro", "TIPO_NUEVO", "", "NONE", "", "", "0"]]),
            new Map(),
        );

        expect(users[0].type).to.equal("OTHER");
    });
});

suite("Fork: mapeo de roles de base de datos", () => {
    const COLUMNS = ["name", "type", "principal_id", "is_fixed", "owner", "create_date"];

    test("distingue fijos, de usuario y de aplicación, con sus miembros", () => {
        const memberships = mapRoleMemberships(
            result(
                ["role_name", "member_name", "member_type"],
                [
                    ["ventas_lectores", "parity_user", "SQL_USER"],
                    ["ventas_lectores", "ventas_supervisores", "DATABASE_ROLE"],
                ],
            ),
        );

        const roles = mapDatabaseRoles(
            result(COLUMNS, [
                ["db_owner", "R", "16387", "1", "dbo", ""],
                ["public", "R", "0", "0", "dbo", ""],
                ["ventas_lectores", "R", "5", "0", "dbo", "2026-09-17T17:36:13.977"],
                ["ventas_app", "A", "6", "0", "dbo", ""],
            ]),
            memberships,
        );

        expect(roles[0].fixed).to.equal(true);
        expect(roles[0].applicationRole).to.equal(false);
        expect(roles[0].builtIn).to.equal(false);

        // `public` no está marcado como fijo en el catálogo, pero no lo creó nadie: es el
        // principal 0 de toda base de datos, y llamarlo «de usuario» sería falso.
        expect(roles[1].name).to.equal("public");
        expect(roles[1].fixed).to.equal(false);
        expect(roles[1].builtIn).to.equal(true);

        expect(roles[2].fixed).to.equal(false);
        expect(roles[2].builtIn).to.equal(false);
        // Un rol puede ser miembro de otro: es lo que da la herencia encadenada.
        expect(roles[2].members).to.deep.equal(["parity_user", "ventas_supervisores"]);

        expect(roles[3].applicationRole, "los de aplicación se marcan").to.equal(true);
        expect(roles[3].members, "y no tienen miembros").to.deep.equal([]);
    });
});

suite("Fork: mapeo de esquemas", () => {
    const COLUMNS = ["name", "schema_id", "owner", "object_count"];

    test("marca los esquemas del sistema y los de los roles fijos", () => {
        const schemas = mapSchemas(
            result(COLUMNS, [
                ["dbo", "1", "dbo", "3"],
                ["sys", "4", "sys", "108"],
                ["ventas", "5", "dbo", "8"],
                ["db_owner", "16384", "db_owner", "0"],
            ]),
        );

        expect(schemas.map((schema) => schema.system)).to.deep.equal([true, true, false, true]);
        expect(schemas[2].objectCount).to.equal(8);
        expect(schemas[2].owner).to.equal("dbo");
    });
});

suite("Fork: mapeo de permisos de base de datos", () => {
    const COLUMNS = [
        "grantee",
        "grantee_type",
        "permission_name",
        "state",
        "state_desc",
        "class_desc",
        "securable",
        "column_name",
    ];

    test("resuelve la clase, el objeto y la columna", () => {
        const permissions = mapDatabasePermissions(
            result(COLUMNS, [
                ["parity_user", "SQL_USER", "CONNECT", "G", "GRANT", "DATABASE", "", ""],
                [
                    "parity_user",
                    "SQL_USER",
                    "SELECT",
                    "D",
                    "DENY",
                    "OBJECT_OR_COLUMN",
                    "ventas.Cliente",
                    "Email",
                ],
                [
                    "ventas_lectores",
                    "DATABASE_ROLE",
                    "SELECT",
                    "G",
                    "GRANT",
                    "SCHEMA",
                    "ventas",
                    "",
                ],
                ["ana", "SQL_USER", "ALGO", "W", "GRANT_WITH_GRANT_OPTION", "CLASE_NUEVA", "x", ""],
            ]),
        );

        expect(permissions[0].securableClass).to.equal("DATABASE");
        expect(permissions[0].securable, "sobre la base no hay objeto que nombrar").to.equal("");

        // El DENY sembrado en ParityDb es a nivel de columna: así se vio contra el servidor real.
        expect(permissions[1].state).to.equal("DENY");
        expect(permissions[1].securable).to.equal("ventas.Cliente");
        expect(permissions[1].columnName).to.equal("Email");

        expect(permissions[2].securableClass).to.equal("SCHEMA");
        expect(permissions[2].securable).to.equal("ventas");

        expect(permissions[3].state).to.equal("GRANT_WITH_GRANT_OPTION");
        expect(permissions[3].securableClass, "una clase nueva no rompe nada").to.equal("OTHER");
    });

    test("la consulta filtra los objetos que no están en la base", () => {
        // `public` tiene cientos de GRANT sobre vistas del sistema, que viven en la base de
        // recursos y no en sys.objects. Sin este filtro la rejilla es ruido. Ver FORK.md §21.
        const statement = buildDatabasePermissionsStatement("ParityDb");
        expect(statement).to.contain("obj.object_id IS NOT NULL");
    });
});
