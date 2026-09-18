/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import {
    PUBLIC_ROLE,
    collectPermissionSources,
    computeEffectivePermissions,
    listMatrixPrincipals,
} from "../../../src/custom/sharedInterfaces/permissionMatrix";
import { DatabasePermission, RoleMembership } from "../../../src/custom/admin/sql/types";

/**
 * La herencia de permisos se calcula aquí, no en el servidor: el `effectivePermissions` del API
 * Object Management volvió vacío para un permiso heredado de un rol (FORK.md §18.4 y §21).
 *
 * El escenario de los tests es el que está sembrado en el servidor de pruebas:
 *
 *     analista  ->  ventas_supervisores  ->  ventas_lectores
 *                        INSERT en ventas      SELECT en ventas
 *
 * y `parity_user`, miembro directo de `ventas_lectores`, con un `DENY SELECT` propio sobre una
 * columna.
 */
const MEMBERSHIPS: RoleMembership[] = [
    { role: "ventas_lectores", member: "parity_user", memberType: "SQL_USER" },
    { role: "ventas_lectores", member: "ventas_supervisores", memberType: "DATABASE_ROLE" },
    { role: "ventas_supervisores", member: "analista", memberType: "SQL_USER" },
];

function permission(overrides: Partial<DatabasePermission> = {}): DatabasePermission {
    return {
        grantee: "public",
        granteeType: "DATABASE_ROLE",
        permission: "CONNECT",
        state: "GRANT",
        stateDescription: "GRANT",
        securableClass: "DATABASE",
        securable: "",
        columnName: "",
        ...overrides,
    };
}

const PERMISSIONS: DatabasePermission[] = [
    permission({ grantee: "analista", permission: "CONNECT" }),
    permission({ grantee: "parity_user", permission: "CONNECT" }),
    permission({
        grantee: "ventas_lectores",
        permission: "SELECT",
        securableClass: "SCHEMA",
        securable: "ventas",
    }),
    permission({
        grantee: "ventas_supervisores",
        permission: "INSERT",
        securableClass: "SCHEMA",
        securable: "ventas",
    }),
    permission({
        grantee: "parity_user",
        permission: "SELECT",
        state: "DENY",
        stateDescription: "DENY",
        securableClass: "OBJECT_OR_COLUMN",
        securable: "ventas.Cliente",
        columnName: "Email",
    }),
    permission({ grantee: "public", permission: "VIEW ANY COLUMN MASTER KEY DEFINITION" }),
];

/** Busca un permiso en el resultado, para no depender del orden. */
function find(
    permissions: ReturnType<typeof computeEffectivePermissions>,
    name: string,
    securable = "",
) {
    return permissions.find((item) => item.permission === name && item.securable === securable);
}

suite("Fork: orígenes de permisos de un principal", () => {
    test("incluye al principal, sus roles, y los roles de sus roles", () => {
        const sources = collectPermissionSources("analista", MEMBERSHIPS);

        expect(sources.map((source) => source.holder)).to.deep.equal([
            "analista",
            "ventas_supervisores",
            "ventas_lectores",
            PUBLIC_ROLE,
        ]);
        // La cadena explica el camino, y por eso se puede decir dónde quitar el permiso.
        expect(sources[1].via).to.deep.equal(["ventas_supervisores"]);
        expect(sources[2].via).to.deep.equal(["ventas_supervisores", "ventas_lectores"]);
    });

    test("añade public, que el catálogo no lista pero hereda todo el mundo", () => {
        const sources = collectPermissionSources("solitario", []);

        expect(sources.map((source) => source.holder)).to.deep.equal(["solitario", PUBLIC_ROLE]);
    });

    test("no duplica public si ya aparece como rol explícito", () => {
        const sources = collectPermissionSources("ana", [
            { role: PUBLIC_ROLE, member: "ana", memberType: "SQL_USER" },
        ]);

        expect(sources.filter((source) => source.holder === PUBLIC_ROLE)).to.have.length(1);
    });

    test("un ciclo de pertenencias no cuelga el cálculo", () => {
        // SQL Server no deja crear ciclos, pero el algoritmo no puede depender de eso.
        const sources = collectPermissionSources("a", [
            { role: "b", member: "a", memberType: "SQL_USER" },
            { role: "c", member: "b", memberType: "DATABASE_ROLE" },
            { role: "a", member: "c", memberType: "DATABASE_ROLE" },
        ]);

        expect(sources.map((source) => source.holder)).to.deep.equal(["a", "b", "c", PUBLIC_ROLE]);
    });
});

suite("Fork: matriz de permisos efectivos", () => {
    test("un permiso propio sale como propio", () => {
        const effective = computeEffectivePermissions("parity_user", PERMISSIONS, MEMBERSHIPS);

        expect(find(effective, "CONNECT").via).to.deep.equal([]);
    });

    test("un permiso de un rol sale heredado, y dice de cuál", () => {
        const effective = computeEffectivePermissions("parity_user", PERMISSIONS, MEMBERSHIPS);

        const select = find(effective, "SELECT", "ventas");
        expect(select.state).to.equal("GRANT");
        expect(select.via).to.deep.equal(["ventas_lectores"]);
    });

    test("la herencia atraviesa varios saltos, y la cadena lo explica", () => {
        const effective = computeEffectivePermissions("analista", PERMISSIONS, MEMBERSHIPS);

        // Un salto: lo tiene el rol del que es miembro directo.
        expect(find(effective, "INSERT", "ventas").via).to.deep.equal(["ventas_supervisores"]);
        // Dos saltos: lo tiene un rol del que su rol es miembro.
        expect(find(effective, "SELECT", "ventas").via).to.deep.equal([
            "ventas_supervisores",
            "ventas_lectores",
        ]);
    });

    test("los permisos de public llegan a todo el mundo", () => {
        const effective = computeEffectivePermissions("analista", PERMISSIONS, MEMBERSHIPS);

        const publicPermission = find(effective, "VIEW ANY COLUMN MASTER KEY DEFINITION");
        expect(publicPermission, "public no está en el catálogo de pertenencias").to.not.equal(
            undefined,
        );
        expect(publicPermission.via).to.deep.equal([PUBLIC_ROLE]);
    });

    test("quien no hereda nada no ve los permisos de los demás", () => {
        const effective = computeEffectivePermissions("otro_usuario", PERMISSIONS, MEMBERSHIPS);

        expect(find(effective, "SELECT", "ventas"), "no es miembro de lectores").to.equal(
            undefined,
        );
        // Pero sí los de public.
        expect(find(effective, "VIEW ANY COLUMN MASTER KEY DEFINITION")).to.not.equal(undefined);
    });

    test("el DENY propio sobre una columna sale como fila aparte del GRANT del esquema", () => {
        const effective = computeEffectivePermissions("parity_user", PERMISSIONS, MEMBERSHIPS);

        const columnDeny = effective.find((item) => item.columnName === "Email");
        expect(columnDeny.state).to.equal("DENY");
        expect(columnDeny.securable).to.equal("ventas.Cliente");
        expect(columnDeny.via, "es propio, no heredado").to.deep.equal([]);
        // Y el SELECT heredado del esquema sigue ahí: son objetos distintos.
        expect(find(effective, "SELECT", "ventas").state).to.equal("GRANT");
    });

    test("DENY gana sobre GRANT cuando caen sobre lo mismo, y se marca el conflicto", () => {
        const conflicting: DatabasePermission[] = [
            permission({
                grantee: "ventas_lectores",
                permission: "SELECT",
                securableClass: "SCHEMA",
                securable: "ventas",
            }),
            permission({
                grantee: "parity_user",
                permission: "SELECT",
                state: "DENY",
                securableClass: "SCHEMA",
                securable: "ventas",
            }),
        ];

        const effective = computeEffectivePermissions("parity_user", conflicting, MEMBERSHIPS);
        const select = find(effective, "SELECT", "ventas");

        expect(select.state, "DENY gana siempre").to.equal("DENY");
        expect(select.conflict).to.equal(true);
        // La explicación es la del camino que gana: el DENY es propio.
        expect(select.via).to.deep.equal([]);
    });

    test("sin conflicto, la explicación es la del camino más corto", () => {
        const twice: DatabasePermission[] = [
            permission({
                grantee: "ventas_lectores",
                permission: "SELECT",
                securableClass: "SCHEMA",
                securable: "ventas",
            }),
            permission({
                grantee: "ventas_supervisores",
                permission: "SELECT",
                securableClass: "SCHEMA",
                securable: "ventas",
            }),
        ];

        const effective = computeEffectivePermissions("analista", twice, MEMBERSHIPS);
        const select = find(effective, "SELECT", "ventas");

        expect(select.conflict).to.equal(false);
        expect(select.via).to.deep.equal(["ventas_supervisores"]);
    });

    test("GRANT WITH GRANT OPTION pesa más que GRANT", () => {
        const both: DatabasePermission[] = [
            permission({ grantee: "ventas_lectores", permission: "EXECUTE" }),
            permission({
                grantee: "parity_user",
                permission: "EXECUTE",
                state: "GRANT_WITH_GRANT_OPTION",
            }),
        ];

        const effective = computeEffectivePermissions("parity_user", both, MEMBERSHIPS);

        expect(find(effective, "EXECUTE").state).to.equal("GRANT_WITH_GRANT_OPTION");
        expect(find(effective, "EXECUTE").conflict, "no es un conflicto").to.equal(false);
    });
});

suite("Fork: lista de principales de la matriz", () => {
    test("los propios van antes que los del sistema, y cada uno con su tipo", () => {
        const principals = listMatrixPrincipals(
            [
                { name: "dbo", system: true },
                { name: "parity_user", system: false },
            ],
            [
                { name: "db_owner", fixed: true },
                { name: "ventas_lectores", fixed: false },
            ],
        );

        expect(principals.map((entry) => entry.name)).to.deep.equal([
            "parity_user",
            "ventas_lectores",
            "db_owner",
            "dbo",
        ]);
        expect(principals[0].kind).to.equal("user");
        expect(principals[1].kind).to.equal("role");
    });
});
