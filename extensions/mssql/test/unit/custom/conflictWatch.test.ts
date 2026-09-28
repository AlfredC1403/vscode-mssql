/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { findConflictingExtensions } from "../../../src/custom/overrides/conflictWatch";

/**
 * El aviso de convivencia con la extensión MSSQL de Microsoft (FORK.md §29).
 *
 * Lo que se fija es **qué** cuenta como choque: la de Microsoft sí, SQLWorks y las demás de
 * `ms-mssql.*` no, porque sin la principal no hacen nada y el aviso ya las nombra.
 */
suite("Fork: aviso de convivencia con MSSQL de Microsoft", () => {
    test("no avisa cuando solo está SQLWorks", () => {
        expect(findConflictingExtensions(["alfredc1403.sqlworks", "vscode.sql"])).to.deep.equal([]);
    });

    test("detecta la extensión de Microsoft", () => {
        expect(
            findConflictingExtensions([
                "alfredc1403.sqlworks",
                "ms-mssql.mssql",
                "ms-mssql.data-workspace-vscode",
            ]),
        ).to.deep.equal(["ms-mssql.mssql"]);
    });

    test("ignora mayúsculas en el identificador", () => {
        expect(findConflictingExtensions(["MS-MSSQL.mssql"])).to.deep.equal(["MS-MSSQL.mssql"]);
    });

    test("no confunde las extensiones hermanas con la principal", () => {
        expect(
            findConflictingExtensions([
                "ms-mssql.mssql-database-management-keymap",
                "ms-mssql.sql-database-projects-vscode",
            ]),
        ).to.deep.equal([]);
    });
});
