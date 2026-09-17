# FORK.md

Registro del fork interno de `microsoft/vscode-mssql`.

Este archivo cumple dos funciones:

1. **Inventario** del repositorio upstream (punto 5 del brief). Es la foto del terreno sobre
   el que vamos a construir.
2. **Deuda de merge**: la tabla de archivos del upstream que hemos modificado. Se actualiza
   en el mismo commit del cambio, nunca después.

| Dato                             | Valor                                                               |
| -------------------------------- | ------------------------------------------------------------------- |
| Upstream                         | `https://github.com/microsoft/vscode-mssql.git` (remoto `upstream`) |
| Origen del fork                  | `https://github.com/AlfredC1403/vscode-mssql` (remoto `origin`)     |
| Commit base de este inventario   | `752692d`                                                           |
| Versión de la extensión upstream | `1.46.0`                                                            |
| Fecha del inventario             | 2026-09-17                                                          |

---

## 0. Archivos del upstream modificados

**Ninguno todavía.** M0 es solo inventario.

| Archivo | Qué se cambió | Por qué | Hito |
| ------- | ------------- | ------- | ---- |
| —       | —             | —       | —    |

Cada línea nuestra dentro de un archivo del upstream lleva un comentario `// [FORK]` al inicio
del bloque. Para auditarlas:

```bash
git grep -n "\[FORK\]"
```

---

## 1. Estructura del repositorio

**El repositorio ya no es la extensión suelta que describe el brief: es un monorepo de npm
workspaces con cuatro extensiones y un paquete compartido.** Esto no rompe nada del plan, pero
cambia todas las rutas.

```
/
├── package.json                  raíz del monorepo (privado, no publicable)
├── scripts/                      orquestación de build para todos los targets
│   ├── workspaces.mjs            implementa build/watch/test/lint/package --target <x>
│   ├── esbuild-utils.js          configuración compartida de esbuild
│   ├── bootstrap-install.mjs     postinstall: instala cada workspace
│   ├── inject-telemetry-key.mjs  inyecta aiKey en build oficial (ver §6)
│   └── localization-*.js         extracción y generación de l10n
├── packages/
│   └── extension-toolkit/        DI, http, telemetría, l10n. Dos capas: base y vscode
├── extensions/
│   ├── mssql/                    ← LA EXTENSIÓN. Todo nuestro trabajo vive aquí
│   ├── sql-database-projects/
│   ├── data-workspace/
│   └── database-management-keymap/
├── tools/perftest/
├── eslint/custom-rules/
├── LICENSE.txt                   MIT de Microsoft — se conserva intacto
└── ThirdPartyNotices.txt         se conserva intacto
```

`extensions/mssql/src/` tiene **971 archivos `.ts`/`.tsx`** repartidos en 53 carpetas de primer
nivel. No es un proyecto pequeño.

### 1.1. El `package.json` de la extensión

`extensions/mssql/package.json` — **296 KB**, y ahí están `contributes`, `engines.vscode` y
`activationEvents`.

| Campo                   | Valor                      |
| ----------------------- | -------------------------- |
| `name`                  | `mssql`                    |
| `displayName`           | `SQL Server (mssql)`       |
| `publisher`             | `ms-mssql`                 |
| `version`               | `1.46.0`                   |
| `icon`                  | `images/extensionIcon.png` |
| `engines.vscode`        | `^1.105.0`                 |
| `main`                  | `./dist/extension`         |
| `l10n`                  | `./l10n`                   |
| `extensionDependencies` | `["vscode.sql"]`           |
| `aiKey`                 | **ausente** (ver §6)       |

Volumen de `contributes`: **119 comandos**, **166 ajustes de configuración**, 70 entradas en
`view/item/context`, 2 contenedores de vistas.

`activationEvents` es corto (`onUri`, `onCommand:mssql.loadCompletionExtension`,
`onNotebook:jupyter-notebook`, `onView:dataworkspace.views.main`); casi toda la activación va
por los `contributes` implícitos.

---

## 2. Scripts de build, watch y package

Todo se lanza **desde la raíz** con `--target mssql`. `scripts/workspaces.mjs` delega en los
scripts del workspace.

```bash
npm install                      # postinstall instala cada workspace
npm run build   -- --target mssql
npm run watch   -- --target mssql
npm run lint    -- --target mssql
npm test        -- --target mssql
npm run package -- --target mssql
```

**Requisito no documentado en el brief: Node.js 24 o superior.** `workspaces.mjs` aborta con
Node 22. Verificado: con Node 22.22.2 el build falla; con Node 24.21.0 pasa.

### 2.1. Empaquetadores

Hay **un solo empaquetador de bundles: esbuild**, con tres configuraciones, más `tsc`/`tsgo`
para el chequeo de tipos.

| Paso                     | Herramienta                                | Entrada                | Salida                     |
| ------------------------ | ------------------------------------------ | ---------------------- | -------------------------- |
| Typecheck extensión      | `tsgo -p tsconfig.extension.json --noEmit` | —                      | —                          |
| Emit extensión           | `tsc -p tsconfig.extension.json --noCheck` | `src/**`               | `out/`                     |
| Bundle extensión         | esbuild (`scripts/bundle-extension.js`)    | `out/`                 | `dist/extension.js`        |
| Typecheck webviews       | `tsgo -p tsconfig.webviews.json`           | —                      | —                          |
| Bundle webviews          | esbuild (`scripts/bundle-webviews.js`)     | 28 entry points `.tsx` | `dist/views/*.js`          |
| Bundle notebook renderer | esbuild                                    | —                      | `dist/notebookRenderer.js` |

`bundle-webviews.js` tiene una **lista literal de entry points**. Cada panel nuevo nuestro añade
una línea ahí. Es un archivo del upstream, y es el único punto de anclaje que el brief no
previó. Ver §10.

Empaquetado: `scripts/package-extension.js` envuelve a `vsce package --no-dependencies`, con dos
modos que importan para el punto 7 del brief:

- `--online` (por defecto): descarga el STS _portable_ y lo mete en el `.vsix`. Requiere el
  runtime de .NET (extensión `ms-dotnettools.vscode-dotnet-runtime`) en la máquina del usuario.
- `--offline`: genera **un `.vsix` por plataforma** con el STS _self-contained_ dentro. Sin
  dependencia del runtime de .NET. Quita `extensionDependencies` sobre el runtime al empaquetar
  y lo restaura después.

**La opción autocontenida que el brief pedía evaluar ya existe en el upstream y no requiere
tocar código.** Ver la recomendación en §11.

---

## 3. Stack de los webviews

**Adoptable tal cual. No hace falta introducir nada.**

| Pieza           | Elección del upstream                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| UI              | React 18 + **Fluent UI v9** (`@fluentui/react-components`)                                   |
| Bundling        | esbuild, `splitting: true`, salida a `dist/views/`                                           |
| Host ↔ webview | **JSON-RPC sobre `postMessage`** (`vscode-jsonrpc/node`), no `postMessage` crudo             |
| Estado          | `useVscodeSelector` (estado compartido) + reducers tipados; estado local con `useState`      |
| Tema            | `webviewTheme()` mapea el tema Fluent a variables `--vscode-*`                               |
| Rejilla         | `FluentSlickGrid` / `FluentResultGrid` (AGENTS.md prohíbe importar `SlickgridReact` directo) |
| Listas largas   | `@tanstack/react-virtual`, `@fluentui-contrib/react-data-grid-react-window`                  |
| Editor embebido | `@monaco-editor/react` (`vscodeMonaco.tsx`)                                                  |

### 3.1. Las tres clases base

En `src/controllers/`:

| Clase                    | Para qué                                              | Nos sirve para                |
| ------------------------ | ----------------------------------------------------- | ----------------------------- |
| `WebviewBaseController`  | Transporte JSON-RPC, tema, l10n, estado, telemetría   | base de todo                  |
| `WebviewPanelController` | `vscode.WebviewPanel` — pestaña del editor            | **paneles de administración** |
| `WebviewViewController`  | `vscode.WebviewViewProvider` — vista en barra lateral | **vista de snippets**         |

**`WebviewViewController` ya implementa `vscode.WebviewViewProvider`.** El punto 12 del brief
(«la vista de snippets se implementa como un `WebviewViewProvider`, no como un
`TreeDataProvider`») encaja con una clase que ya existe. No hay trabajo de infraestructura ahí.

### 3.2. Piezas reutilizables ya escritas

`src/webviews/common/` trae, entre otras: `confirmationDialog.tsx`, `errorDialog.tsx`,
`dialogHeader.component.tsx`, `dialogPageShell.tsx`, `searchableDropdown.component.tsx`,
`segmentedControl.tsx` (el control segmentado que pide §14 de brief), `sqlText.tsx` (T-SQL con
resaltado — sirve para el cajón del script generado), `wizard.tsx`, `findWidget.component.tsx`,
`virtualizedList.ts`, `textViewDialog.tsx`, `objectManagementDialog.tsx`.

El diseño de §14 del brief (cabecera + barra de filtros + cajón de script al pie) se puede
montar casi entero con estos componentes.

### 3.3. Tema

`webviewTheme(themeKind)` en `src/webviews/common/theme.ts` reasigna ~40 tokens de Fluent a
`var(--vscode-*)`. La regla del brief («todos los colores salen de las variables `--vscode-*`»)
ya es la regla del upstream. Si usamos los componentes de Fluent que el repo usa, la cumplimos
gratis.

---

## 4. Gestión de conexiones

Cuatro capas, todas inyectadas por el contenedor de DI del `extension-toolkit`.

| Capa                | Archivo                                    | Responsabilidad                        |
| ------------------- | ------------------------------------------ | -------------------------------------- |
| `ConnectionConfig`  | `src/connectionconfig/connectionconfig.ts` | perfiles y grupos en `settings.json`   |
| `ConnectionStore`   | `src/models/connectionStore.ts`            | MRU, contraseñas, _quick pick_         |
| `CredentialStore`   | `src/credentialstore/credentialstore.ts`   | `vscode.SecretStorage`                 |
| `ConnectionManager` | `src/controllers/connectionManager.ts`     | conexiones vivas por URI (2786 líneas) |

- **Perfiles**: ajustes `mssql.connections` y `mssql.connectionGroups` (constantes
  `connectionsArrayName` / `connectionGroupsArrayName`). Global y de workspace.
- **Contraseñas**: `vscode.SecretStorage` vía `CredentialStore`. Las de sesión
  (`savePassword: false`) van en un `Map` en memoria de `ConnectionStore`. **Nunca en
  `settings.json`.** La regla 11.3 del brief ya la cumple el upstream.

### 4.1. La API interna que vamos a usar

`ConnectionManager` es lo que nos importa. Es accesible desde `MainController.connectionManager`.

```ts
// Ejecutar cualquier cosa contra el STS sobre la conexión ya abierta.
connectionManager.sendRequest<P, R, E>(requestType: RequestType<P, R, E>, params?: P): Promise<R>

connectionManager.isConnected(fileUri: string): boolean
connectionManager.getConnectionInfo(fileUri: string): ConnectionInfo
connectionManager.getUriForConnection(connection: IConnectionInfo): string
connectionManager.getServerInfo(credentials: IConnectionInfo): IServerInfo
connectionManager.listDatabases(connectionUri: string): Promise<string[]>
connectionManager.connect(fileUri, credentials, promise?): Promise<boolean>
connectionManager.onConnectionsChanged: vscode.Event<void>
connectionManager.onSuccessfulConnection: vscode.Event<ConnectionSuccessfulEvent>
```

**Para leer datos, el patrón del repo es `query/simpleexecute`.** Lo usan
`src/copilot/tools/runQueryTool.ts`, `listTablesTool.ts`, `listViewsTool.ts` y
`src/services/schemaService.ts`:

```ts
const result = await connectionManager.sendRequest(
    new RequestType<{ ownerUri: string; queryString: string }, SimpleExecuteResult, void>(
        "query/simpleexecute",
    ),
    { ownerUri, queryString },
);
```

Devuelve un solo conjunto de resultados (`columnInfo`, `rows`, `rowCount`). Suficiente para todas
las consultas del punto 10 del brief. Para lotes con varios resultados o para la ejecución
transaccional de M5 habrá que mirar `QueryRunner` (`src/controllers/queryRunner.ts`).

**Conclusión: no creamos segunda lista de conexiones ni segundo almacén de credenciales, y no
necesitamos tocar ningún archivo del upstream para usarlos.**

---

## 5. SQL Tools Service: descarga y arranque

`src/configurations/config.ts`, literal, sin ajuste de usuario que lo redirija:

```ts
downloadUrl: "https://github.com/Microsoft/sqltoolsservice/releases/download/{#version#}/microsoft.sqltools.servicelayer-{#fileName#}";
version: "6.0.20260915.1";
installDir: "./sqltoolsservice/{#version#}/{#platform#}";
```

Siete archivos por plataforma (`win-x64-net10.0.zip`, `linux-x64-net10.0.tar.gz`, …, más
`portable-net10.0.zip`).

Cadena de arranque:
`src/languageservice/serviceclient.ts` → `serviceDownloadProvider.ts` → `downloadHelper.ts` →
`decompressProvider.ts` → `serviceExecutablePaths.ts` → `dotnetRuntimeProvider.ts`.

El cliente LSP se crea con:

```ts
documentSelector: ["sql"];
synchronize: {
    configurationSection: ["mssql", "telemetry"];
}
```

Es decir: **el STS recibe la sección `mssql` completa de los ajustes**, y de ahí lee
`mssql.format.options.*`. Esto es central para el hito M8 (ver §8).

Hay además un segundo binario, **SQL Tools MCP** (`Microsoft.SqlServer.SQLtools.MCPserver`
v2.0.35), que se instala aparte y solo se empaqueta con `--package-mcp`.

**No tocamos nada aquí sin preguntar (regla 16.3).** La recomendación va en §11.

---

## 6. Telemetría

Tres emisores, y un punto de estrangulamiento muy limpio.

| Vía                     | Dónde                                                                                        | Cómo se corta                            |
| ----------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Eventos de la extensión | `extension-toolkit/vscode/telemetry/` (`sendActionEvent`, `sendErrorEvent`, `startActivity`) | `initializeTelemetryReporter(undefined)` |
| Eventos del STS         | notificación `telemetry/sqlevent` → `serviceclient.ts:551` los reenvía                       | quitar el handler                        |
| Perf                    | `src/perf/perfTelemetry.ts` (`Perf.marker`, `Perf.flush`)                                    | pasa por el mismo reporter               |

El transporte real es `@vscode/extension-telemetry` 1.5.2, dependencia de
`packages/extension-toolkit`, construido en `extension.ts:117` con
`context.extension.packageJSON.aiKey`.

**`aiKey` no está en `package.json`.** Lo inyecta `scripts/inject-telemetry-key.mjs` solo en la
build oficial de Microsoft, leyendo `MSSQL_APP_INSIGHTS_KEY`. Sin esa variable el script falla
adrede, y el `launch.json` lo confirma: _«If not set, no telemetry will be emitted»_.

**Consecuencia práctica: un `.vsix` compilado por nosotros ya no envía telemetría de la
extensión.** Aun así, en M1 haremos el corte explícito (el brief pide quitar el envío, no
confiar en la ausencia de una clave), y el sitio es `extension.ts:117` más el handler de
`telemetry/sqlevent`.

_Pendiente de verificar:_ si el STS abre algún canal propio hacia Microsoft además de
`telemetry/sqlevent`. Es un binario de .NET que no controlamos; conviene confirmarlo con un
cortafuegos saliente antes de dar M1 por bueno.

---

## 7. Localización

Sistema de VS Code l10n, con **dos catálogos separados que no se mezclan**:

| Ámbito            | Archivo de strings                    | API                       |
| ----------------- | ------------------------------------- | ------------------------- |
| Host de extensión | `src/constants/locConstants.ts`       | `vscode.l10n.t()`         |
| Webviews          | `src/webviews/common/locConstants.ts` | `@vscode/l10n` `l10n.t()` |
| `package.json`    | `package.nls.json` (claves `%clave%`) | resolución de VS Code     |

Generados, **no se editan a mano** (AGENTS.md): `l10n/bundle.l10n.json`, `*.xlf`, `*.xlf.lcl`,
`*.l10n.json`, `localizedConstants.ts`. Extracción: `npm run localization`.

Los webviews reciben su catálogo por RPC (`GetLocalizationRequest`), precargado en
`initializeWebviewLocalizationCache()`.

**Para nosotros:** los textos nuevos en español van en `src/custom/`, en nuestros propios
archivos de constantes, con las mismas dos APIs según el ámbito. No tocamos los `locConstants.ts`
del upstream — serían conflicto en cada merge, y además el brief no quiere traducir lo existente.

---

## 8. Formateador: el hallazgo que cambia M8

**El upstream tiene, desde hace pocos días, un formateador de T-SQL de clase dbForge.** Esto
invalida el plan de §13 del brief.

Los commits:

- `ea050a4` — _Expose additional formatter options and bump STS_ (#22925)
- `7dc5a66` — _Remove legacy SQL formatter settings_ (#22940)

Hoy hay **56 ajustes `mssql.format.options.*`**, servidos por el parser real de T-SQL
(ScriptDom) dentro del STS, no por un reformateador de tokens.

### 8.1. Cómo funciona

No hay ninguna llamada a `registerDocumentFormattingEditProvider` en el repositorio. El
formateador **lo provee el cliente LSP**: `documentSelector: ["sql"]`, y el STS anuncia la
capacidad `documentFormattingProvider`. Las opciones viajan por
`synchronize.configurationSection: ["mssql", ...]`.

Es decir: **no hay «el registro del proveedor de formato» que el brief (punto 4.3 y 13.1) daba
por sentado que podíamos sustituir.** Sustituirlo obligaría a interceptar la capacidad del LSP,
que es justo el tipo de cambio caro que la regla de oro quiere evitar.

### 8.2. Cobertura del perfil XML del brief contra lo que ya existe

| Opción del perfil XML                     | Ajuste del upstream                                      | Estado                  |
| ----------------------------------------- | -------------------------------------------------------- | ----------------------- |
| `Case/Keywords`                           | `keywordCasing`                                          | ✅                      |
| `Case/BuiltInFunctions`                   | `builtInFunctionCasing`                                  | ✅                      |
| `Case/Identifiers`                        | `identifierCasing`                                       | ✅                      |
| `Case/DataTypes`                          | —                                                        | ❌                      |
| `Indentation/UseTabs`, `Size`             | `FormattingOptions` del editor                           | ✅                      |
| `Indentation/IndentSubqueries`            | —                                                        | ❌                      |
| `Indentation/IndentCaseWhen`              | —                                                        | ❌                      |
| `Indentation/IndentParenthesesContent`    | `clauseBodyAlignment`                                    | ⚠️ parcial              |
| `Lists/CommaPosition`                     | `commaPlacement` (`trailing`/`leading`)                  | ✅                      |
| `Lists/SpaceAfterComma`                   | `leadingCommaSpaceCount`                                 | ⚠️ solo comas al inicio |
| `Lists/SelectItemsOnNewLine`              | `multilineSelectElementsList`                            | ✅                      |
| `Lists/InsertColumnsOnNewLine`            | `multilineInsertTargetsList`                             | ✅                      |
| `Lists/InsertValuesOnNewLine`             | `multilineInsertSourcesList`                             | ✅                      |
| `Lists/UpdateSetItemsOnNewLine`           | `multilineSetClauseItems`                                | ✅                      |
| `Lists/WherePredicatesOnNewLine`          | `multilineWherePredicatesList`                           | ✅                      |
| `Lists/ColumnDefinitionsOnNewLine`        | `newLineFormattedIndexDefinition` y afines               | ⚠️ parcial              |
| `Lists/AlignColumnDefinitions`            | `alignColumnDefinitionFields`                            | ✅                      |
| `Lists/AlignAliases`                      | —                                                        | ❌                      |
| `Lists/AsKeywordForAliases`               | `columnAliasStyle` (`asKeyword`/`equalsSign`/`preserve`) | ✅                      |
| `Clauses/NewLineBeforeFrom` … `Output`    | `newLineBeforeFromClause` … `newLineBeforeOutputClause`  | ✅ los 8                |
| `Clauses/NewLineBeforeLogicalOperator`    | `multilineWherePredicatesList`                           | ⚠️ parcial              |
| `Parentheses/NewLineBeforeOpen` / `Close` | `newLineBefore{Open,Close}ParenthesisInMultilineList`    | ✅                      |
| `Spacing/AroundOperators`                 | —                                                        | ❌                      |
| `Spacing/BeforeDataTypeParameters`        | `spaceBetweenDataTypeAndParameters`                      | ✅                      |
| `Spacing/BetweenDataTypeParameters`       | `spaceBetweenParametersInDataType`                       | ✅                      |
| `Statements/BlankLinesBetweenStatements`  | `numNewlinesAfterStatement`                              | ✅                      |
| `Statements/PreserveComments`             | `preserveComments`                                       | ✅                      |
| `Statements/MaxLineLength`                | —                                                        | ❌                      |
| `Statements/NewLineBeforeSemicolon`       | —                                                        | ❌                      |
| `Statements/PreserveEmptyLines`           | —                                                        | ❌                      |

Cobertura: **~80 % completa, ~10 % parcial, ~10 % ausente.** Y el upstream trae además opciones
que el brief ni pedía: `sqlVersion` (sql80…sql180, Fabric DW), `identifierBracketing`,
`persistTrailingGo`, `terminateBlockStatements`, `multilineNestedFunctionCalls`,
`multilineProcedureParametersList`, `alignSetClauseItem`, `indentViewBody`.

Propuesta de replanteo de M8 en §11.

---

## 9. Explorador de objetos

`src/objectExplorer/` — `ObjectExplorerProvider implements vscode.TreeDataProvider`, registrado
en `mainController.ts:1525` con `vscode.window.createTreeView("objectExplorer", …)`.

**Los nodos no se construyen en TypeScript: los devuelve el STS** (`objectexplorer/expand`).
`TreeNodeInfo` es solo el envoltorio. **No hay punto de extensión para añadir nodos propios**; el
punto de anclaje nº 4 que el brief anticipaba («el archivo de contribución del árbol») no existe.
Añadir un nodo obligaría a editar `objectExplorerService.ts`, que es deuda cara.

**Pero no hace falta.** Los nodos exponen su `contextValue` como una cadena
`type=X,subType=Y,filterable=…`, y el upstream ya cuelga 70 comandos del árbol por
`contributes.menus` → `view/item/context`:

```json
{
    "command": "mssql.createDatabase",
    "when": "view == objectExplorer && viewItem =~ /\\btype=(Folder)\\b.*\\bsubType=(Databases)\\b/",
    "group": "3_MSSQL_instanceDatabaseActions@1"
}
```

**Nuestros paneles de administración se lanzan así, con cero archivos del upstream tocados.**
Solo entradas en `package.json`.

Además, `media/objectTypes/` ya trae los iconos que necesitaremos:
`ServerLevelLogin.svg`, `ServerLevelLogin_Disabled.svg`, `ServerLevelServerRole.svg`,
`DatabaseRole.svg`, `ApplicationRole.svg`, `User.svg`, `SecurityPolicy.svg`. El árbol ya muestra
la rama de seguridad.

---

## 10. Rejilla de resultados: coste de intervenirla

Pregunta del brief: ¿se puede cambiar su aspecto sin editar sus componentes? **Sí, y barato.**

`src/webviews/common/FluentResultGrid/FluentResultGrid.vscode.css` define la apariencia entera
como **variables CSS propias sobre `body .fluent-result-grid`**:

```css
body .fluent-result-grid {
    --fluent-result-grid-background: var(--vscode-editor-background, #1e1e1e);
    --fluent-result-grid-foreground: var(--vscode-foreground, #cccccc);
    --fluent-result-grid-border-color: var(--vscode-editorWidget-border, …);
    --fluent-result-grid-list-active-selection-background: var(
        --vscode-list-activeSelectionBackground,
        #094771
    );
    /* … */
}
```

Tres niveles de intervención, de más barato a más caro:

1. **Ajustes ya existentes**, sin una línea de código: `mssql.resultsGrid.rowPadding`,
   `alternatingRowColors`, `showGridLines`, `freezeFirstColumnByDefault`,
   `autoSizeColumnsMode`, más los colores de tema `mssql.resultsGridNullBackground` /
   `NullForeground`.
2. **Una hoja de estilos nuestra** que redefina las `--fluent-result-grid-*`. Cae entera en
   `src/custom/overrides/`. Coste de merge: prácticamente cero.
3. Editar los componentes. Solo para cambios de comportamiento, no de aspecto.

**Estimación: un rediseño visual de la rejilla es (1) + (2). No hay que tocar sus componentes.**
Buena noticia para cuando llegue el momento.

---

## 11. Decisiones que hay que tomar antes de seguir

### 11.1. Punto de anclaje que el brief no previó

`extensions/mssql/scripts/bundle-webviews.js` tiene la lista literal de entry points de esbuild.
Cada panel nuestro añade **una línea**. Es un archivo del upstream y hay que sumarlo a los cuatro
anclajes permitidos.

Mitigación propuesta: una sola entrada que apunte a `src/custom/index.tsx` como _router_ de
todos nuestros paneles. **Una línea en total, para siempre**, en lugar de una por panel.

### 11.2. Anclaje nº 4 del brief: no existe

El árbol del explorador de objetos no admite nodos añadidos. Se sustituye por
`contributes.menus` en `package.json`, que ya está en la lista permitida (anclaje nº 1).
Saldo neto de anclajes: sigue habiendo cuatro.

### 11.3. Anclaje nº 3 del brief: no existe como tal

No hay registro de proveedor de formato que sustituir; lo aporta el cliente LSP. Ver §8.

### 11.4. Recomendación sobre el SQL Tools Service

**Empaquetarlo, con `npm run package -- --target mssql -- --offline`.** Razones:

1. La capacidad ya existe upstream. Cero código nuestro, cero deuda de merge.
2. El brief quiere que la extensión no hable con ningún servidor. En modo `--online` la primera
   ejecución descarga de `github.com/Microsoft/sqltoolsservice`.
3. Elimina la dependencia de `ms-dotnettools.vscode-dotnet-runtime`, que en una instalación
   interna por `.vsix` es una segunda cosa que distribuir.

Coste: un `.vsix` por plataforma y bastante más tamaño. Para distribución interna a máquinas
Windows conocidas, se genera solo `win-x64`.

### 11.5. Recomendación sobre M8 (formateador)

El plan de §13 del brief —añadir `sql-formatter` y sustituir el proveedor— **produciría un
formateador peor que el que ya hay**: `sql-formatter` reformatea tokens, el STS parsea T-SQL de
verdad con conocimiento de versión de motor.

Propuesta: **conservar el formateador del upstream y construir encima solo lo que falta**, que es
justo lo que el usuario echa de menos de dbForge:

- El **perfil XML** y su lector/escritor (`src/custom/format/`).
- El **mapeo perfil XML ↔ `mssql.format.options.*`**, en ambos sentidos. La importación desde los
  ajustes actuales que pide §13.3 sale gratis: es el mapeo al revés.
- El **panel de opciones con vista previa lado a lado** (§13.2). Esto es lo que hoy no existe: 56
  ajustes sueltos en `settings.json` sin previsualización.
- Los **perfiles múltiples** con selector (§13.4), que VS Code no da.
- Las opciones sin equivalente (§8.2) se marcan como no soportadas y se deshabilitan en la
  interfaz, exactamente como manda el brief.

Esto **no añade ninguna dependencia** (no entra `sql-formatter`), no escribe ningún parser, y no
toca el registro del proveedor. La vista previa en vivo puede pedirle el formato al propio STS.

Contrapartida honesta: el perfil XML pasa a ser una capa sobre `settings.json` en lugar de la
fuente de verdad del formateo. Si prefieres el plan original del brief, dilo y lo hacemos, pero
el resultado será peor.

### 11.6. Solapamiento del upstream con los hitos de administración

El upstream ya trae, vía el API **Object Management** del STS
(`objectManagement/initializeView`, `/save`, `/script`, `/rename`, `/dropDatabase`):

| Ya existe                                                | Hito del brief afectado    |
| -------------------------------------------------------- | -------------------------- |
| Crear base de datos (`createDatabaseWebviewController`)  | M6                         |
| Eliminar base de datos (`dropDatabaseWebviewController`) | M6                         |
| Renombrar base de datos                                  | M6                         |
| Backup y restore                                         | fuera de alcance del brief |
| Cambiar contraseña (`changePasswordWebviewController`)   | M3                         |

Y `objectManagement/script` **devuelve el T-SQL sin ejecutarlo** — que es exactamente la regla
11.1 del brief («nunca ejecutes DDL sin mostrar antes el script»), ya implementada.

El API del STS soporta más tipos de objeto de los que la extensión usa hoy (en Azure Data Studio
cubría Login, User, ServerRole, DatabaseRole, ApplicationRole). **Si soporta Login y User, M5 se
reduce mucho**: en vez de generar nuestro propio DDL, pedimos el script al STS y lo mostramos.
Esto hay que verificarlo contra una instancia real; no se puede confirmar leyendo el repositorio.

Hasta verificarlo, el plan del brief (T-SQL propio en `src/custom/admin/sql/`, funciones puras
con tests) sigue siendo el plan. Pero conviene comprobarlo antes de M5, porque puede ahorrar la
mitad del hito.

---

## 12. Política de merge

1. `git remote add upstream https://github.com/microsoft/vscode-mssql.git` — **hecho**.
2. Trabajar siempre en rama propia, nunca sobre la que sigue al upstream.
3. Integrar el upstream cada tres meses, o antes si sale un arreglo que importe.
4. Después de cada merge, correr la lista de paridad (§13) antes de dar el merge por bueno.
5. Actualizar la tabla de §0 en el mismo commit de cada cambio a un archivo del upstream.

**Aviso:** el upstream se mueve rápido. Entre `v1.42.2` y `1.46.0` entraron un motor de lenguaje
SQL nativo nuevo (`src/sqlLanguage/`, commit `0f2b343`), el formateador de §8, un servidor MCP y
la migración de la rejilla a `FluentResultGrid`. Tres meses entre merges puede ser demasiado.

---

## 13. Lista de paridad

Se corre después del fork inicial y después de cada merge.

| #   | Comprobación                                                          | Estado                     |
| --- | --------------------------------------------------------------------- | -------------------------- |
| 1   | Conectar con autenticación SQL y con autenticación integrada          | ⏳ requiere instancia real |
| 2   | Explorador: servidor, base, tablas, vistas, procedimientos, seguridad | ⏳ requiere instancia real |
| 3   | IntelliSense sugiere tablas y columnas reales                         | ⏳ requiere instancia real |
| 4   | Ejecutar consulta: resultados, mensajes, varios conjuntos             | ⏳ requiere instancia real |
| 5   | Exportar a CSV y a JSON                                               | ⏳ requiere instancia real |
| 6   | Script as Create sobre tabla y sobre procedimiento                    | ⏳ requiere instancia real |
| 7   | Plan de ejecución estimado                                            | ⏳ requiere instancia real |
| 8   | Historial de consultas                                                | ⏳ requiere instancia real |

Lo que sí se ha verificado en este entorno:

| Comprobación                                     | Resultado                                           |
| ------------------------------------------------ | --------------------------------------------------- |
| `npm install` en la raíz                         | ✅                                                  |
| `npm run build -- --target mssql`                | ✅ (con Node 24; falla con Node 22)                 |
| `dist/extension.js` generado                     | ✅                                                  |
| `dist/views/` con los 28 entry points de webview | ✅                                                  |
| `npm test -- --target mssql`                     | ✅ 5103 pasan, 0 fallan, 17 omitidos (289 archivos) |
| Remoto `upstream` configurado y accesible        | ✅                                                  |

La salida de los tests confirma además el hallazgo de §6: _«No telemetry connection string
found; telemetry will not be sent»_.

Los ocho puntos de paridad **no se pueden verificar desde este contenedor**: no hay instancia de
SQL Server accesible ni una sesión de VS Code con interfaz. Hay que correrlos en la máquina del
usuario con F5.

---

## 14. Estructura acordada para el código nuevo

```
extensions/mssql/src/custom/
  index.ts            registro único, lo llama el punto de entrada
  admin/
    sql/
      types.ts
      queries/        todo el T-SQL, y solo aquí
      script/         generadores de script: funciones puras, con tests
    panels/
  snippets/
  format/
  overrides/          modificaciones a lo existente
  util/
    identifiers.ts    validación y QUOTENAME
```

`src/custom/` va **dentro de `extensions/mssql/src/`**, no en la raíz del monorepo: es donde
están el `package.json`, el `tsconfig` y el build que la van a compilar.
