/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import * as Constants from "../../constants/constants";
import ConnectionManager from "../../controllers/connectionManager";
import { Strings } from "../strings";

/**
 * El selector de conexión: servidor y base de datos, siempre a la vista (FORK.md §30).
 *
 * ## Qué problema resuelve
 *
 * El upstream pinta la conexión activa como un **CodeLens en la línea 0** del editor. Se desplaza
 * con el texto, así que en cuanto bajas por un script deja de verse, y para cambiar de servidor o de
 * base hay que subir hasta arriba. Medido en el VS Code real: a partir de la línea ~50 ya no está.
 *
 * Aquí vive el sustituto: dos elementos de la barra de estado que **no se mueven nunca**, uno para
 * el servidor y otro para la base, cada uno con su lista al pulsarlo. Es lo más parecido a los dos
 * desplegables de dbForge que permite VS Code: un widget flotante anclado arriba del editor no está
 * en la API de extensiones, y el único sitio de la ventana que siempre está visible es esta barra.
 *
 * ## Por qué a la izquierda
 *
 * El upstream ya pone su propio par a la **derecha**, entre `SQLCMD: Off`, `MSSQL`, el indicador de
 * lenguaje y lo que añada cada extensión instalada. Ahí es donde el usuario no los encontraba. La
 * izquierda está casi vacía —solo los contadores de errores— así que el par del fork cae siempre en
 * el mismo sitio y con el mismo aspecto, esté instalado lo que esté instalado.
 *
 * Sí, eso deja la información dos veces en la barra. Es el precio de no tocar `statusView.ts` del
 * upstream, que es código suyo y deuda de merge segura; la API de VS Code no deja que una extensión
 * esconda un elemento de barra de estado que ha creado otra parte del mismo proceso. Se acepta a
 * sabiendas, y se anota aquí para que no parezca un descuido.
 */
export class ConnectionSelector implements vscode.Disposable {
    private readonly server: vscode.StatusBarItem;
    private readonly database: vscode.StatusBarItem;
    private readonly disposables: vscode.Disposable[] = [];

    constructor(private readonly connectionManager: ConnectionManager) {
        // Prioridades altas y contiguas: así los dos caen juntos y a la izquierda del todo, y el
        // servidor queda siempre antes que la base, que es el orden en el que se leen.
        this.server = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
        this.database = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999);
        this.server.command = Constants.cmdConnect;
        this.database.command = Constants.cmdChangeDatabase;

        this.disposables.push(
            this.server,
            this.database,
            // El editor activo decide qué conexión se muestra: en este producto la conexión es por
            // documento, no por ventana.
            vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),
        );

        // `registerCustom` recibe `controller.connectionManager`, que **puede no existir todavía**:
        // `test/unit/extension.test.ts` del upstream activa la extensión con un controlador simulado
        // y ahí llega `undefined`. Lo encontró esa suite, y el fallo no era cosmético: este es el
        // punto de anclaje único, así que una excepción aquí tumbaba la activación entera. Sin
        // gestor no hay nada que mostrar, y el selector se queda callado en lugar de reventar.
        const changed = this.connectionManager?.onConnectionsChanged?.(() => this.refresh());
        if (changed) {
            this.disposables.push(changed);
        }

        this.refresh();
    }

    /** Repinta los dos elementos con la conexión del editor activo. */
    public refresh(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor?.document.languageId !== "sql" || !this.connectionManager) {
            // Fuera de un editor de SQL el selector no significa nada y solo sería ruido. Sin gestor
            // de conexiones tampoco hay nada que decir; ver el comentario del constructor.
            this.server.hide();
            this.database.hide();
            return;
        }

        const connection = this.connectionManager.getConnectionInfo(editor.document.uri.toString());

        if (!connection?.connectionId || connection.connecting) {
            this.server.text = connection?.connecting
                ? `$(loading~spin) ${Strings.connectionSelector.connecting}`
                : `$(plug) ${Strings.connectionSelector.noConnection}`;
            this.server.tooltip = Strings.connectionSelector.connectTooltip;
            this.server.show();
            this.database.hide();
            return;
        }

        const { server, database } = connection.credentials;
        this.server.text = `$(server) ${server}`;
        this.server.tooltip = Strings.connectionSelector.serverTooltip(server);
        this.server.show();

        // Sin base explícita, la conexión usa la predeterminada del login. El selector tiene que
        // decir a qué apunta igualmente: un hueco en blanco se lee como «no hay base».
        this.database.text = `$(database) ${database || Strings.connectionSelector.defaultDatabase}`;
        this.database.tooltip = Strings.connectionSelector.databaseTooltip;
        this.database.show();
    }

    public dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables.length = 0;
    }
}
