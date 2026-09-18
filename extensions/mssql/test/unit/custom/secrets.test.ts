/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import {
    MAX_SECRET_LENGTH,
    SECRET_MARKER,
    SECRET_PLACEHOLDER,
    countSecretMarkers,
    escapeSecretLiteral,
    validateSecret,
} from "../../../src/custom/admin/sql/ddl/secrets";
import {
    buildTransactionalBatch,
    redactSecrets,
    secretRequirements,
} from "../../../src/custom/admin/sql/writeGate";
import {
    buildCreateLoginStatement,
    buildCreateServerRoleStatement,
    buildResetPasswordStatement,
} from "../../../src/custom/admin/sql/ddl/createPrincipals";
import { renderReadableScript, validateStatement } from "../../../src/custom/admin/sql/ddl/plan";

/**
 * La regla 11.3 del brief dicha en tests: la contraseña no se guarda, no se muestra y no se registra.
 *
 * El test que más importa es «la vista previa no contiene el secreto». Si alguna vez falla, el panel
 * está enseñando una contraseña en pantalla.
 */
const POLICY_OFF = { checkPolicy: false, checkExpiration: false, mustChange: false };

suite("Fork: validación de contraseñas", () => {
    test("rechaza la vacía", () => {
        expect(validateSecret("")).to.be.a("string");
    });

    test("acepta exactamente 128 y rechaza 129, que es el límite medido", () => {
        // Medido contra SQL Server 2022: con 129 caracteres `CREATE LOGIN` **no crea el login y no
        // devuelve error**. Es un fallo silencioso, así que esta es la única barrera que hay.
        expect(validateSecret("a".repeat(MAX_SECRET_LENGTH))).to.equal(undefined);
        expect(validateSecret("a".repeat(MAX_SECRET_LENGTH + 1))).to.be.a("string");
    });

    test("el motivo del rechazo no repite la contraseña", () => {
        const problem = validateSecret("secreto".repeat(30)) ?? "";
        expect(problem).to.not.contain("secreto");
    });

    test("rechaza un carácter nulo, que no sobrevive al envío", () => {
        // El nulo se construye, no se escribe: `eslint --fix` convierte un `\u0000` del
        // fuente en un NUL **literal e invisible** en el fichero, que es frágil y no se ve al
        // revisar. Pasó lo mismo en `production.ts` durante M5.
        const nul = String.fromCharCode(0);
        expect(validateSecret(`abc${nul}def`)).to.be.a("string");
    });

    test("acepta comillas, corchetes y saltos de línea: son contraseñas legítimas", () => {
        // Medido: con QUOTENAME el motor las guarda tal cual y PWDCOMPARE devuelve 1.
        expect(validateSecret("a'b]];--\nGO x")).to.equal(undefined);
    });
});

suite("Fork: el literal del secreto en el lote", () => {
    test("dobla la comilla simple, y solo eso", () => {
        expect(escapeSecretLiteral("a'b")).to.equal("a''b");
        expect(escapeSecretLiteral("a]]b")).to.equal("a]]b");
        expect(escapeSecretLiteral("sin comillas")).to.equal("sin comillas");
    });

    test("aborta en lugar de recortar si la contraseña no vale", () => {
        // La regla 11.2 manda abortar, no arreglar. Aquí es lo mismo: una contraseña recortada sería
        // una contraseña distinta de la que el usuario escribió.
        expect(() => escapeSecretLiteral("a".repeat(MAX_SECRET_LENGTH + 1))).to.throw();
    });
});

suite("Fork: la ranura de contraseña en la sentencia", () => {
    test("el generador de CREATE LOGIN pone el marcador una vez y declara la ranura", () => {
        const statement = buildCreateLoginStatement({ name: "app", policy: POLICY_OFF });
        expect(countSecretMarkers(statement.sql)).to.equal(1);
        expect(statement.secret?.prompt).to.contain("app");
        // Y sigue sin comillas, que es lo que hace segura la plantilla del ejecutor.
        expect(statement.sql).to.not.contain("'");
        expect(validateStatement(statement, { routed: true })).to.equal(undefined);
    });

    test("una sentencia con marcador pero sin ranura se rechaza", () => {
        const problem = validateStatement(
            {
                label: "x",
                sql: `CREATE LOGIN [a] WITH PASSWORD = ${SECRET_MARKER}`,
                database: "master",
            },
            { routed: true },
        );
        expect(problem).to.be.a("string");
    });

    test("una ranura sin marcador se rechaza", () => {
        const problem = validateStatement(
            {
                label: "x",
                sql: "CREATE LOGIN [a] WITH PASSWORD = algo",
                database: "master",
                secret: { prompt: "p", subject: "s" },
            },
            { routed: true },
        );
        expect(problem).to.be.a("string");
    });

    test("una sentencia irreversible no puede llevar contraseña", () => {
        // Las irreversibles se envían sin envoltorio, así que no hay dónde sustituir el marcador.
        const problem = validateStatement(
            {
                label: "x",
                sql: `KILL 1 ${SECRET_MARKER}`,
                secret: { prompt: "p", subject: "s" },
            },
            { routed: false },
        );
        expect(problem).to.be.a("string");
    });

    test("MUST_CHANGE sin caducidad aborta: el motor lo rechazaría con el 15099", () => {
        expect(() =>
            buildCreateLoginStatement({
                name: "app",
                policy: { checkPolicy: true, checkExpiration: false, mustChange: true },
            }),
        ).to.throw();
    });
});

suite("Fork: la vista previa no muestra la contraseña", () => {
    const statement = buildCreateLoginStatement({ name: "app", policy: POLICY_OFF });
    const SECRET = "Clave!Secreta9";

    test("el lote de vista previa lleva el marcador de posición y NO el secreto", () => {
        const preview = buildTransactionalBatch([statement]);
        expect(preview).to.contain(SECRET_PLACEHOLDER);
        expect(preview).to.not.contain(SECRET);
        // Y tampoco el marcador crudo: eso se le enviaría al servidor como contraseña literal.
        expect(preview).to.not.contain(SECRET_MARKER);
    });

    test("el lote de ejecución y el de vista previa solo difieren en el DECLARE", () => {
        const preview = buildTransactionalBatch([statement]).split("\n");
        const real = buildTransactionalBatch([statement], [SECRET]).split("\n");
        expect(real.length).to.equal(preview.length);

        const different = preview
            .map((line, index) => (line === real[index] ? undefined : index))
            .filter((index): index is number => index !== undefined);
        expect(different.length, "solo una línea puede cambiar").to.equal(1);
        expect(real[different[0]].trim()).to.match(/^DECLARE @secreto1\b/);
    });

    test("el script legible pinta la contraseña como un literal, no como el marcador", () => {
        const script = renderReadableScript({
            id: "p1",
            title: "t",
            statements: [statement],
            irreversible: [],
            production: false,
        });
        expect(script).to.contain(`N'${SECRET_PLACEHOLDER}'`);
        expect(script).to.not.contain(SECRET_MARKER);
        // Y avisa de que la contraseña se pide al ejecutar.
        expect(script).to.contain("11.3");
    });

    test("el ensamblado lo hace el motor con QUOTENAME, no este código", () => {
        // Si el escapado lo hiciéramos aquí, la contraseña entraría en el texto de la sentencia y
        // habría que anidar dos niveles de comillas a mano. La regla 11.2 lo prohíbe.
        const real = buildTransactionalBatch([statement], ["a'b"]);
        expect(real).to.contain("QUOTENAME(@secreto1, '''')");
        expect(real).to.contain("DECLARE @secreto1 nvarchar(128) = N'a''b';");
    });

    test("un lote sin contraseñas queda exactamente como en M5", () => {
        // Añadir M6 no puede cambiar el texto de lo que ya funcionaba y estaba medido.
        const plain = buildTransactionalBatch([buildCreateServerRoleStatement("r")]);
        expect(plain).to.not.contain("@secreto");
        expect(plain).to.not.contain("DECLARE @sql");
    });

    test("varias ranuras se numeran por orden de aparición", () => {
        const two = buildTransactionalBatch(
            [statement, buildCreateServerRoleStatement("r"), buildResetPasswordStatement("otro")],
            ["uno", "dos"],
        );
        expect(two).to.contain("DECLARE @secreto1 nvarchar(128) = N'uno';");
        expect(two).to.contain("DECLARE @secreto2 nvarchar(128) = N'dos';");
        expect(two).to.contain("QUOTENAME(@secreto2, '''')");
    });

    test("secretRequirements devuelve las ranuras en el orden en que se piden", () => {
        const requirements = secretRequirements([
            buildCreateServerRoleStatement("r"),
            statement,
            buildResetPasswordStatement("otro"),
        ]);
        expect(requirements.map((requirement) => requirement.subject)).to.deep.equal([
            "el login app",
            "el login otro",
        ]);
    });
});

suite("Fork: la contraseña no llega a un mensaje", () => {
    test("se tacha de cualquier texto que la lleve", () => {
        // Medido que el motor no la filtra en ERROR_MESSAGE(), pero eso es una medida de una versión
        // concreta: la garantía no debe depender de haberlo medido.
        const message = redactSecrets("Falló cerca de 'Clave9!' al ejecutar", ["Clave9!"]);
        expect(message).to.not.contain("Clave9!");
        expect(message).to.contain("<contraseña oculta>");
    });

    test("una contraseña vacía no parte el mensaje carácter a carácter", () => {
        expect(redactSecrets("hola", [""])).to.equal("hola");
    });

    test("sin contraseñas, el mensaje queda intacto", () => {
        expect(redactSecrets("Error 15025", [])).to.equal("Error 15025");
    });
});
