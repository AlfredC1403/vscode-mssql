/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { buildPermissionStatement } from "../../../src/custom/admin/sql/ddl/permissions";
import {
    buildDatabaseRoleMembershipStatement,
    buildServerRoleMembershipStatement,
} from "../../../src/custom/admin/sql/ddl/roleMembership";
import {
    buildDropUserStatement,
    buildLoginEnableStatement,
    buildUserDefaultSchemaStatement,
} from "../../../src/custom/admin/sql/ddl/principals";
import {
    DATABASE_PERMISSION_NAMES,
    OBJECT_PERMISSION_NAMES,
    PERMISSION_COUNTS,
    SCHEMA_PERMISSION_NAMES,
    SERVER_PERMISSION_NAMES,
    assertPermission,
    isKnownPermission,
    toPermissionScope,
} from "../../../src/custom/admin/sql/ddl/permissionNames";
import {
    loginUnchanged,
    membershipState,
    serverPermissionState,
    userUnchanged,
} from "../../../src/custom/admin/sql/ddl/preconditions";
import { validateStatement } from "../../../src/custom/admin/sql/ddl/plan";

/**
 * Los generadores son el sitio donde un nombre de fuera se convierte en T-SQL, así que los tests que
 * importan son los de abuso: lo que no pasa la validación **aborta y no produce texto** (regla 11.2
 * del brief).
 */
const ABUSIVE_NAMES = [
    "Ventas]",
    "O'Brien",
    "x; DROP DATABASE ParityDb",
    "Ventas--",
    "",
    "a".repeat(129),
    " Ventas",
    "1Ventas",
];

suite("Fork: nombres de permiso, lista cerrada", () => {
    test("las cuatro listas tienen los tamaños medidos contra el servidor", () => {
        // Si una versión futura añade permisos, el test de deriva lo dice.
        expect(PERMISSION_COUNTS).to.deep.equal({
            SERVER: 51,
            DATABASE: 105,
            SCHEMA: 13,
            OBJECT: 13,
        });
    });

    test("reconoce un permiso de cada ámbito y rechaza los de otro", () => {
        expect(isKnownPermission("SERVER", "VIEW ANY DEFINITION")).to.equal(true);
        expect(isKnownPermission("DATABASE", "CONNECT")).to.equal(true);
        expect(isKnownPermission("SCHEMA", "SELECT")).to.equal(true);
        expect(isKnownPermission("OBJECT", "RECEIVE")).to.equal(true);

        // CONNECT SQL es de servidor, no de base; RECEIVE es de objeto, no de esquema.
        expect(isKnownPermission("DATABASE", "CONNECT SQL")).to.equal(false);
        expect(isKnownPermission("SCHEMA", "RECEIVE")).to.equal(false);
        expect(isKnownPermission("SERVER", "SELECT")).to.equal(false);
    });

    test("un permiso inventado aborta, y el mensaje no repite el valor", () => {
        for (const bad of [
            "SELECT ALL",
            "GRANT ALL",
            "x; DROP DATABASE y",
            "",
            "CONTROL SERVER!",
        ]) {
            expect(() => assertPermission("SERVER", bad), bad).to.throw(/no está en la lista/);
        }
        try {
            assertPermission("SERVER", "SELECT; DROP DATABASE ParityDb");
            expect.fail("debería haber lanzado");
        } catch (error) {
            expect((error as Error).message).to.not.contain("DROP");
        }
    });

    test("normaliza mayúsculas y espacios de los lados", () => {
        expect(assertPermission("SCHEMA", "  select  ")).to.equal("SELECT");
    });

    test("las clases que M4 muestra y M5 no sabe expresar se abortan explícitamente", () => {
        expect(toPermissionScope("SERVER")).to.equal("SERVER");
        expect(toPermissionScope("DATABASE")).to.equal("DATABASE");
        expect(toPermissionScope("SCHEMA")).to.equal("SCHEMA");
        expect(toPermissionScope("OBJECT_OR_COLUMN")).to.equal("OBJECT");
        // Estas dos las lee M4 pero M5 no las genera: mejor decirlo que ofrecer un botón roto.
        expect(toPermissionScope("DATABASE_PRINCIPAL")).to.equal(undefined);
        expect(toPermissionScope("TYPE")).to.equal(undefined);
        expect(toPermissionScope("OTHER")).to.equal(undefined);
    });

    test("ninguna lista tiene nombres repetidos ni caracteres raros", () => {
        for (const list of [
            SERVER_PERMISSION_NAMES,
            DATABASE_PERMISSION_NAMES,
            SCHEMA_PERMISSION_NAMES,
            OBJECT_PERMISSION_NAMES,
        ]) {
            expect(new Set(list).size).to.equal(list.length);
            for (const name of list) {
                expect(/^[A-Z][A-Z ]*$/.test(name), name).to.equal(true);
            }
        }
    });
});

suite("Fork: generadores de permisos", () => {
    test("GRANT y DENY de ámbito de servidor van enrutados por master", () => {
        const granted = buildPermissionStatement({
            action: "GRANT",
            permission: "VIEW ANY DEFINITION",
            securable: { scope: "SERVER" },
            target: { principal: "analista" },
            database: "ParityDb",
        });

        expect(granted.sql).to.equal("GRANT VIEW ANY DEFINITION TO [analista]");
        // Sin master, error 4621. Y sin USE, porque el panel comparte la conexión.
        expect(granted.database).to.equal("master");
        expect(granted.label).to.contain("el servidor");
        expect(validateStatement(granted, { routed: true })).to.equal(undefined);
    });

    test("ámbito de base, esquema, objeto y columna", () => {
        expect(
            buildPermissionStatement({
                action: "GRANT",
                permission: "CONNECT",
                securable: { scope: "DATABASE" },
                target: { principal: "analista" },
                database: "ParityDb",
            }).sql,
        ).to.equal("GRANT CONNECT TO [analista]");

        expect(
            buildPermissionStatement({
                action: "DENY",
                permission: "SELECT",
                securable: { scope: "SCHEMA", schema: "ventas" },
                target: { principal: "analista" },
                database: "ParityDb",
            }).sql,
        ).to.equal("DENY SELECT ON SCHEMA::[ventas] TO [analista]");

        expect(
            buildPermissionStatement({
                action: "REVOKE",
                permission: "SELECT",
                securable: { scope: "OBJECT", schema: "ventas", object: "Cliente" },
                target: { principal: "parity_user" },
                database: "ParityDb",
            }).sql,
        ).to.equal("REVOKE SELECT ON OBJECT::[ventas].[Cliente] FROM [parity_user]");

        // El DENY sembrado en el servidor de pruebas es a nivel de columna.
        const column = buildPermissionStatement({
            action: "DENY",
            permission: "SELECT",
            securable: { scope: "OBJECT", schema: "ventas", object: "Cliente", column: "Email" },
            target: { principal: "parity_user" },
            database: "ParityDb",
        });
        expect(column.sql).to.equal(
            "DENY SELECT ON OBJECT::[ventas].[Cliente]([Email]) TO [parity_user]",
        );
        expect(column.label).to.contain("la columna ventas.Cliente.Email");
    });

    test("WITH GRANT OPTION se concede", () => {
        expect(
            buildPermissionStatement({
                action: "GRANT_WITH_GRANT_OPTION",
                permission: "SELECT",
                securable: { scope: "SCHEMA", schema: "ventas" },
                target: { principal: "analista" },
                database: "ParityDb",
            }).sql,
        ).to.equal("GRANT SELECT ON SCHEMA::[ventas] TO [analista] WITH GRANT OPTION");
    });

    test("revocar un permiso concedible aborta: haría falta CASCADE", () => {
        // CASCADE revocaría también lo que ese principal haya concedido a otros. No es una casilla.
        expect(() =>
            buildPermissionStatement({
                action: "REVOKE",
                permission: "SELECT",
                securable: { scope: "SCHEMA", schema: "ventas" },
                target: { principal: "analista" },
                database: "ParityDb",
                grantable: true,
            }),
        ).to.throw(/CASCADE/);
    });

    test("un nombre abusivo aborta en cualquiera de sus posiciones", () => {
        for (const name of ABUSIVE_NAMES) {
            expect(
                () =>
                    buildPermissionStatement({
                        action: "GRANT",
                        permission: "SELECT",
                        securable: { scope: "SCHEMA", schema: "ventas" },
                        target: { principal: name },
                        database: "ParityDb",
                    }),
                `principal ${name}`,
            ).to.throw(/no es válido/);

            expect(
                () =>
                    buildPermissionStatement({
                        action: "GRANT",
                        permission: "SELECT",
                        securable: { scope: "SCHEMA", schema: name },
                        target: { principal: "analista" },
                        database: "ParityDb",
                    }),
                `esquema ${name}`,
            ).to.throw(/no es válido/);

            expect(
                () =>
                    buildPermissionStatement({
                        action: "GRANT",
                        permission: "SELECT",
                        securable: { scope: "OBJECT", schema: "ventas", object: name },
                        target: { principal: "analista" },
                        database: "ParityDb",
                    }),
                `objeto ${name}`,
            ).to.throw(/no es válido/);

            expect(
                () =>
                    buildPermissionStatement({
                        action: "GRANT",
                        permission: "SELECT",
                        securable: {
                            scope: "OBJECT",
                            schema: "ventas",
                            object: "Cliente",
                            column: name,
                        },
                        target: { principal: "analista" },
                        database: "ParityDb",
                    }),
                `columna ${name}`,
            ).to.throw(/no es válido/);

            expect(
                () =>
                    buildPermissionStatement({
                        action: "GRANT",
                        permission: "SELECT",
                        securable: { scope: "SCHEMA", schema: "ventas" },
                        target: { principal: "analista" },
                        database: name,
                    }),
                `base ${name}`,
            ).to.throw(/no es válido/);
        }
    });

    test("ninguna sentencia emitida lleva una comilla simple", () => {
        // Es lo que hace que la profundidad de entrecomillado del lote sea siempre 2 sin escapar.
        const statements = [
            buildPermissionStatement({
                action: "GRANT",
                permission: "SELECT",
                securable: {
                    scope: "OBJECT",
                    schema: "ventas",
                    object: "Cliente",
                    column: "Email",
                },
                target: { principal: "analista" },
                database: "ParityDb",
            }),
            buildServerRoleMembershipStatement({
                action: "ADD",
                role: "dbcreator",
                member: "analista",
            }),
            buildDatabaseRoleMembershipStatement({
                action: "DROP",
                role: "ventas_lectores",
                member: "analista",
                database: "ParityDb",
            }),
            buildLoginEnableStatement("parity_user", false),
            buildUserDefaultSchemaStatement("ParityDb", "analista", "dbo"),
            buildDropUserStatement("ParityDb", "analista"),
        ];

        for (const statement of statements) {
            expect(statement.sql, statement.label).to.not.contain("'");
            expect(validateStatement(statement, { routed: true })).to.equal(undefined);
        }
    });
});

suite("Fork: generadores de pertenencia a roles", () => {
    test("rol de servidor, añadir y quitar", () => {
        expect(
            buildServerRoleMembershipStatement({
                action: "ADD",
                role: "dbcreator",
                member: "analista",
            }).sql,
        ).to.equal("ALTER SERVER ROLE [dbcreator] ADD MEMBER [analista]");

        const dropped = buildServerRoleMembershipStatement({
            action: "DROP",
            role: "dbcreator",
            member: "analista",
        });
        expect(dropped.sql).to.equal("ALTER SERVER ROLE [dbcreator] DROP MEMBER [analista]");
        expect(dropped.database, "ámbito de servidor").to.equal("master");
    });

    test("rol de base, en su base", () => {
        const added = buildDatabaseRoleMembershipStatement({
            action: "ADD",
            role: "ventas_lectores",
            member: "analista",
            database: "ParityDb",
        });

        expect(added.sql).to.equal("ALTER ROLE [ventas_lectores] ADD MEMBER [analista]");
        expect(added.database).to.equal("ParityDb");
    });

    test("un nombre abusivo aborta", () => {
        for (const name of ABUSIVE_NAMES) {
            expect(() =>
                buildServerRoleMembershipStatement({ action: "ADD", role: name, member: "x" }),
            ).to.throw(/no es válido/);
            expect(() =>
                buildServerRoleMembershipStatement({
                    action: "ADD",
                    role: "dbcreator",
                    member: name,
                }),
            ).to.throw(/no es válido/);
            expect(() =>
                buildDatabaseRoleMembershipStatement({
                    action: "ADD",
                    role: "ventas_lectores",
                    member: "analista",
                    database: name,
                }),
            ).to.throw(/no es válido/);
        }
    });
});

suite("Fork: generadores sobre principales", () => {
    test("habilitar y deshabilitar un login", () => {
        expect(buildLoginEnableStatement("parity_user", false).sql).to.equal(
            "ALTER LOGIN [parity_user] DISABLE",
        );
        expect(buildLoginEnableStatement("parity_user", true).sql).to.equal(
            "ALTER LOGIN [parity_user] ENABLE",
        );
        expect(buildLoginEnableStatement("parity_user", true).database).to.equal("master");
    });

    test("esquema por omisión y borrado de usuario", () => {
        expect(buildUserDefaultSchemaStatement("ParityDb", "analista", "dbo").sql).to.equal(
            "ALTER USER [analista] WITH DEFAULT_SCHEMA = [dbo]",
        );

        const dropped = buildDropUserStatement("ParityDb", "analista");
        expect(dropped.sql).to.equal("DROP USER [analista]");
        expect(dropped.label).to.contain("Borrar el usuario analista");
    });

    test("ningún generador emite una cláusula PASSWORD", () => {
        // M5 no lleva contraseñas: eso es M6, con su propio diseño para la regla 11.3.
        const texts = [
            buildLoginEnableStatement("parity_user", false).sql,
            buildUserDefaultSchemaStatement("ParityDb", "analista", "dbo").sql,
            buildDropUserStatement("ParityDb", "analista").sql,
        ];
        for (const sql of texts) {
            expect(sql.toUpperCase()).to.not.contain("PASSWORD");
        }
    });

    test("un nombre abusivo aborta", () => {
        for (const name of ABUSIVE_NAMES) {
            expect(() => buildLoginEnableStatement(name, true)).to.throw(/no es válido/);
            expect(() => buildDropUserStatement("ParityDb", name)).to.throw(/no es válido/);
            expect(() => buildUserDefaultSchemaStatement("ParityDb", "analista", name)).to.throw(
                /no es válido/,
            );
            expect(() => buildUserDefaultSchemaStatement(name, "analista", "dbo")).to.throw(
                /no es válido/,
            );
        }
    });
});

suite("Fork: precondiciones", () => {
    test("la identidad de un usuario se compara por create_date, que es la única que cambia", () => {
        // Medido: al borrar y recrear un usuario, principal_id y sid SE CONSERVAN.
        const precondition = userUnchanged("analista", "2026-09-17T23:49:53.533");

        expect(precondition.check).to.contain("sys.database_principals");
        expect(precondition.check).to.contain("N'analista'");
        expect(precondition.check).to.contain("CONVERT(varchar(33), create_date, 126)");
        expect(precondition.check).to.contain("N'2026-09-17T23:49:53.533'");
        expect(precondition.errorNumber).to.equal(50001);
    });

    test("la de un login usa el catálogo de servidor", () => {
        expect(loginUnchanged("parity_user", "2026-09-17T17:36:25.177").check).to.contain(
            "sys.server_principals",
        );
    });

    test("una fecha que no tiene el formato del catálogo aborta", () => {
        for (const bad of ["ayer", "2026-09-17", "2026-09-17 23:49:53", "'; DROP", ""]) {
            expect(() => userUnchanged("analista", bad), bad).to.throw(/formato esperado/);
        }
    });

    test("el estado esperado de una pertenencia se expresa en los dos sentidos", () => {
        const present = membershipState("ventas_lectores", "analista", "database", "present");
        const absent = membershipState("dbcreator", "analista", "server", "absent");

        expect(present.check).to.contain("sys.database_role_members");
        expect(present.check.startsWith("EXISTS")).to.equal(true);
        expect(absent.check).to.contain("sys.server_role_members");
        expect(absent.check.startsWith("NOT EXISTS")).to.equal(true);
        expect(absent.errorNumber).to.equal(50003);
    });

    test("el estado esperado de un permiso de servidor, incluida la ausencia de fila", () => {
        const granted = serverPermissionState("analista", "VIEW ANY DEFINITION", "G");
        const none = serverPermissionState("analista", "VIEW ANY DEFINITION", "NONE");

        expect(granted.check).to.contain("perm.state = N'G'");
        expect(granted.check).to.contain("perm.class = 100");
        expect(none.check.startsWith("NOT EXISTS")).to.equal(true);
        expect(none.check).to.not.contain("perm.state");
        expect(granted.errorNumber).to.equal(50002);
    });

    test("un nombre abusivo en una precondición aborta", () => {
        for (const name of ABUSIVE_NAMES) {
            expect(() => userUnchanged(name, "2026-09-17T23:49:53.533")).to.throw(/no es válido/);
            expect(() => membershipState(name, "analista", "server", "present")).to.throw(
                /no es válido/,
            );
            expect(() => serverPermissionState("analista", name, "G")).to.throw(/no es válido/);
        }
    });

    test("ninguna precondición emitida deja una comilla sin cerrar", () => {
        const checks = [
            userUnchanged("analista", "2026-09-17T23:49:53.533").check,
            loginUnchanged("parity_user", "2026-09-17T17:36:25.177").check,
            membershipState("ventas_lectores", "analista", "database", "present").check,
            serverPermissionState("analista", "VIEW ANY DEFINITION", "G").check,
        ];
        for (const check of checks) {
            // Número par de comillas: cada literal abre y cierra.
            expect((check.match(/'/g) ?? []).length % 2, check).to.equal(0);
        }
    });
});
