/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import {
    buildCreateContainedUserStatement,
    buildCreateDatabaseRoleStatement,
    buildCreateLoginStatement,
    buildCreateServerRoleStatement,
    buildCreateUserStatement,
    buildDropLoginStatement,
    buildDropRoleStatement,
    buildResetPasswordStatement,
} from "../../../src/custom/admin/sql/ddl/createPrincipals";
import { validateStatement } from "../../../src/custom/admin/sql/ddl/plan";
import { databaseIsContained } from "../../../src/custom/admin/sql/ddl/preconditions";
import { SECRET_MARKER } from "../../../src/custom/admin/sql/ddl/secrets";

/**
 * Generadores de creación de M6. Todo lo que se afirma aquí sobre el motor está medido contra
 * SQL Server 2022 y anotado en FORK.md §23.1.
 */
const POLICY_OFF = { checkPolicy: false, checkExpiration: false, mustChange: false };
const POLICY_ON = { checkPolicy: true, checkExpiration: true, mustChange: false };

/** Toda sentencia del lote tiene que pasar la validación del plan. */
function assertValid(statement: ReturnType<typeof buildCreateServerRoleStatement>) {
    expect(validateStatement(statement, { routed: true }), statement.sql).to.equal(undefined);
}

suite("Fork: CREATE LOGIN", () => {
    test("pone las dos opciones de política explícitas, nunca implícitas", () => {
        const statement = buildCreateLoginStatement({ name: "ventas_app", policy: POLICY_ON });
        expect(statement.sql).to.equal(
            "CREATE LOGIN [ventas_app] WITH PASSWORD = @@SECRETO@@, CHECK_POLICY = ON, CHECK_EXPIRATION = ON",
        );
        assertValid(statement);
    });

    test("MUST_CHANGE va pegado a PASSWORD, antes de la coma", () => {
        // Medido: la sintaxis es `PASSWORD = '...' MUST_CHANGE, CHECK_POLICY = ON, ...`. Con
        // MUST_CHANGE en la lista de opciones el motor da error de sintaxis.
        const statement = buildCreateLoginStatement({
            name: "app",
            policy: { checkPolicy: true, checkExpiration: true, mustChange: true },
        });
        expect(statement.sql).to.contain(`PASSWORD = ${SECRET_MARKER} MUST_CHANGE, CHECK_POLICY`);
        assertValid(statement);
    });

    test("aborta las combinaciones que el motor rechaza con el 15099", () => {
        expect(() =>
            buildCreateLoginStatement({
                name: "app",
                policy: { checkPolicy: true, checkExpiration: false, mustChange: true },
            }),
        ).to.throw();
        expect(() =>
            buildCreateLoginStatement({
                name: "app",
                policy: { checkPolicy: false, checkExpiration: true, mustChange: true },
            }),
        ).to.throw();
    });

    test("la base por omisión se entrecomilla, y si no se pide no aparece", () => {
        const withDatabase = buildCreateLoginStatement({
            name: "app",
            policy: POLICY_OFF,
            defaultDatabase: "Mi Base",
        });
        expect(withDatabase.sql).to.contain("DEFAULT_DATABASE = [Mi Base]");

        const without = buildCreateLoginStatement({ name: "app", policy: POLICY_OFF });
        expect(without.sql).to.not.contain("DEFAULT_DATABASE");
    });

    test("va por master, que es lo que exige el ámbito de servidor", () => {
        expect(buildCreateLoginStatement({ name: "app", policy: POLICY_OFF }).database).to.equal(
            "master",
        );
    });

    test("aborta si el nombre no pasa la validación del 11.2", () => {
        expect(() =>
            buildCreateLoginStatement({ name: "mal'nombre", policy: POLICY_OFF }),
        ).to.throw();
        expect(() =>
            buildCreateLoginStatement({ name: "con--guiones", policy: POLICY_OFF }),
        ).to.throw();
        expect(() => buildCreateLoginStatement({ name: "", policy: POLICY_OFF })).to.throw();
    });
});

suite("Fork: restablecer la contraseña", () => {
    test("es un ALTER LOGIN con ranura, y va por master", () => {
        const statement = buildResetPasswordStatement("ventas_app");
        expect(statement.sql).to.equal(`ALTER LOGIN [ventas_app] WITH PASSWORD = ${SECRET_MARKER}`);
        expect(statement.database).to.equal("master");
        assertValid(statement);
    });

    test("MUST_CHANGE y UNLOCK van pegados, sin coma", () => {
        expect(buildResetPasswordStatement("a", { mustChange: true }).sql).to.contain(
            `${SECRET_MARKER} MUST_CHANGE`,
        );
        expect(buildResetPasswordStatement("a", { unlock: true }).sql).to.contain(
            `${SECRET_MARKER} UNLOCK`,
        );
    });

    test("aborta si se piden las dos a la vez", () => {
        expect(() =>
            buildResetPasswordStatement("a", { mustChange: true, unlock: true }),
        ).to.throw();
    });
});

suite("Fork: CREATE USER", () => {
    test("para un login del servidor", () => {
        const statement = buildCreateUserStatement({
            name: "ventas_app",
            database: "ParityDb",
            source: { kind: "login", login: "ventas_app" },
        });
        expect(statement.sql).to.equal("CREATE USER [ventas_app] FOR LOGIN [ventas_app]");
        expect(statement.database).to.equal("ParityDb");
        assertValid(statement);
    });

    test("sin login, con esquema por omisión", () => {
        const statement = buildCreateUserStatement({
            name: "analista",
            database: "ParityDb",
            source: { kind: "withoutLogin" },
            defaultSchema: "ventas",
        });
        expect(statement.sql).to.equal(
            "CREATE USER [analista] WITHOUT LOGIN WITH DEFAULT_SCHEMA = [ventas]",
        );
        assertValid(statement);
    });

    test("no lleva ranura de contraseña: un usuario de base no tiene la suya", () => {
        const statement = buildCreateUserStatement({
            name: "a",
            database: "b",
            source: { kind: "withoutLogin" },
        });
        expect(statement.secret).to.equal(undefined);
        expect(statement.sql).to.not.contain(SECRET_MARKER);
    });

    test("aborta si la base o el esquema no pasan la validación", () => {
        expect(() =>
            buildCreateUserStatement({
                name: "a",
                database: "mal'base",
                source: { kind: "withoutLogin" },
            }),
        ).to.throw();
        expect(() =>
            buildCreateUserStatement({
                name: "a",
                database: "b",
                source: { kind: "withoutLogin" },
                defaultSchema: "mal'esquema",
            }),
        ).to.throw();
    });
});

suite("Fork: CREATE USER contenido", () => {
    test("la contraseña y el esquema van en la misma lista WITH, separados por coma", () => {
        // Es la diferencia de sintaxis que obliga a tener un generador aparte: en el `CREATE USER
        // ... FOR LOGIN` el `WITH DEFAULT_SCHEMA` es su propia cláusula, y aquí no.
        const statement = buildCreateContainedUserStatement({
            name: "ventas_app",
            database: "Ventas",
            defaultSchema: "ventas",
        });

        expect(statement.sql).to.equal(
            "CREATE USER [ventas_app] WITH PASSWORD = @@SECRETO@@, DEFAULT_SCHEMA = [ventas]",
        );
        expect(statement.database).to.equal("Ventas");
        assertValid(statement);
    });

    test("sin esquema, solo la contraseña", () => {
        const statement = buildCreateContainedUserStatement({
            name: "ventas_app",
            database: "Ventas",
        });

        expect(statement.sql).to.equal("CREATE USER [ventas_app] WITH PASSWORD = @@SECRETO@@");
        assertValid(statement);
    });

    test("declara la ranura de contraseña, que es lo que lo distingue del otro CREATE USER", () => {
        const contained = buildCreateContainedUserStatement({
            name: "ventas_app",
            database: "Ventas",
        });
        const normal = buildCreateUserStatement({
            name: "ventas_app",
            database: "Ventas",
            source: { kind: "withoutLogin" },
        });

        expect(contained.secret).to.not.equal(undefined);
        expect(contained.sql.split(SECRET_MARKER)).to.have.length(2);
        expect(normal.secret).to.equal(undefined);
    });

    test("la contraseña no viaja en el objeto: solo la ranura y qué pedir", () => {
        // La misma invariante de M6, comprobada también aquí: si algún día alguien añadiera un
        // campo con el valor, este test lo vería.
        const statement = buildCreateContainedUserStatement({
            name: "ventas_app",
            database: "Ventas",
        });

        // La sentencia lleva la ranura, y la ranura lleva **qué pedir**, no el valor: si alguien
        // añadiera un campo con la contraseña dentro, estas dos listas de claves lo verían.
        expect(Object.keys(statement).sort()).to.deep.equal(["database", "label", "secret", "sql"]);
        expect(Object.keys(statement.secret ?? {}).sort()).to.deep.equal(["prompt", "subject"]);
        expect(statement.secret?.prompt).to.include("ventas_app");
    });

    test("aborta si la base o el esquema no pasan la validación del 11.2", () => {
        expect(() =>
            buildCreateContainedUserStatement({ name: "ventas_app", database: "Ventas'; DROP" }),
        ).to.throw();
        expect(() =>
            buildCreateContainedUserStatement({
                name: "ventas_app",
                database: "Ventas",
                defaultSchema: "ventas]--",
            }),
        ).to.throw();
    });

    test("la precondición mira la contención, y pasa la validación del plan", () => {
        const statement = buildCreateContainedUserStatement({
            name: "ventas_app",
            database: "Ventas",
        });
        statement.precondition = databaseIsContained("Ventas");

        expect(statement.precondition.check).to.include("sys.databases");
        expect(statement.precondition.check).to.include("containment <> 0");
        // El nombre entra como literal, entrecomillado por `quoteLiteral`, no interpolado.
        expect(statement.precondition.check).to.include("N'Ventas'");
        assertValid(statement);
    });

    test("la precondición aborta con un nombre que no pasa la validación", () => {
        expect(() => databaseIsContained("Ventas'; DROP DATABASE X --")).to.throw();
    });
});

suite("Fork: roles", () => {
    test("rol de servidor, con y sin propietario", () => {
        expect(buildCreateServerRoleStatement("operadores").sql).to.equal(
            "CREATE SERVER ROLE [operadores]",
        );
        expect(buildCreateServerRoleStatement("operadores", "sa").sql).to.equal(
            "CREATE SERVER ROLE [operadores] AUTHORIZATION [sa]",
        );
        assertValid(buildCreateServerRoleStatement("operadores", "sa"));
    });

    test("rol de base, en su base", () => {
        const statement = buildCreateDatabaseRoleStatement("ParityDb", "editores", "dbo");
        expect(statement.sql).to.equal("CREATE ROLE [editores] AUTHORIZATION [dbo]");
        expect(statement.database).to.equal("ParityDb");
        assertValid(statement);
    });

    test("borrar un rol de servidor y uno de base", () => {
        expect(buildDropRoleStatement("server", "operadores").sql).to.equal(
            "DROP SERVER ROLE [operadores]",
        );
        expect(buildDropRoleStatement("database", "editores", "ParityDb").sql).to.equal(
            "DROP ROLE [editores]",
        );
        expect(buildDropRoleStatement("database", "editores", "ParityDb").database).to.equal(
            "ParityDb",
        );
    });

    test("borrar un rol de base sin decir la base aborta", () => {
        expect(() => buildDropRoleStatement("database", "editores")).to.throw();
    });
});

suite("Fork: DROP LOGIN", () => {
    test("va por master y la etiqueta nombra el login", () => {
        const statement = buildDropLoginStatement("ventas_app");
        expect(statement.sql).to.equal("DROP LOGIN [ventas_app]");
        expect(statement.database).to.equal("master");
        expect(statement.label).to.contain("ventas_app");
        assertValid(statement);
    });

    test("no lleva ranura: borrar no necesita contraseña", () => {
        expect(buildDropLoginStatement("a").secret).to.equal(undefined);
    });
});
