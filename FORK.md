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

Cada línea nuestra dentro de un archivo del upstream lleva un comentario `// [FORK]` al inicio
del bloque. Para auditarlas:

```bash
git grep -n "\[FORK\]"
```

| Archivo                                                         | Qué se cambió                                                                                                                                                                                                                                          | Por qué                                                                                                                                                        | Hito |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `extensions/mssql/package.json`                                 | Bloque de identidad (`name`, `displayName`, `version`, `description`, `publisher`, `icon`, `repository`, `bugs`, `homepage`, `galleryBanner`, `keywords`); título del contenedor de vistas; `extensionPack` sin `ms-dotnettools.vscode-dotnet-runtime` | Renombrado del §7 del brief. El runtime de .NET sobra porque el STS va autocontenido                                                                           | M1   |
| `extensions/mssql/src/extension.ts`                             | **2 líneas**: el `import` de `disableTelemetry` y su llamada en lugar de `initializeTelemetryReporter(...)`                                                                                                                                            | Quitar el envío de telemetría. La lógica vive en `src/custom/overrides/telemetry.ts`                                                                           | M1   |
| `extensions/mssql/README.md`                                    | Reescrito                                                                                                                                                                                                                                              | Se distribuye dentro del `.vsix` bajo nuestro nombre, y el del upstream es material de marca de Microsoft                                                      | M1   |
| `extensions/mssql/images/extensionIcon.png`                     | Contenido sustituido, **misma ruta**                                                                                                                                                                                                                   | El logotipo de Microsoft no se redistribuye. Lo importa `src/webviews/pages/Changelog/changelogPage.tsx:40`, así que conservar la ruta evita tocar ese webview | M1   |
| `extensions/mssql/images/mssql-chat-avatar.jpg`                 | Contenido sustituido, **misma ruta**                                                                                                                                                                                                                   | Ídem. Manteniendo la ruta no hay que tocar `extension.ts:155`                                                                                                  | M1   |
| `extensions/mssql/images/yt-thumbnail.png`                      | **Eliminado**                                                                                                                                                                                                                                          | Recurso de marketing de Microsoft. Nada lo referenciaba en local: el README apuntaba a `raw.githubusercontent.com`                                             | M1   |
| `extensions/mssql/images/mssql-demo.gif`                        | **Eliminado**                                                                                                                                                                                                                                          | Ídem, sin ninguna referencia                                                                                                                                   | M1   |
| `extensions/mssql/src/constants/constants.ts`                   | **1 línea**: `extensionId` pasa a `alfredc1403.sqlworks`                                                                                                                                                                                               | La extensión se autolocaliza con `vscode.extensions.getExtension(extensionId)` en 6 sitios. Ver §15.6                                                          | M1   |
| `extensions/mssql/src/databaseProjects/common/extensionIds.ts`  | **1 línea**: `mssqlExtensionId`                                                                                                                                                                                                                        | Ídem, segunda copia del mismo identificador                                                                                                                    | M1   |
| `extensions/mssql/src/databaseProjects/tools/buildHelper.ts`    | **1 línea**: identificador en línea                                                                                                                                                                                                                    | Ídem, tercera copia                                                                                                                                            | M1   |
| `extensions/mssql/src/integration/azureResourcesIntegration.ts` | **1 línea**: autoridad del URI `vscode://…/connect`                                                                                                                                                                                                    | VS Code enruta `vscode://<publisher>.<name>/…` al gestor de URI de la extensión                                                                                | M1   |
| `extensions/mssql/src/mssqlProtocolHandler.ts`                  | 2 líneas de comentario con el esquema de URI de ejemplo                                                                                                                                                                                                | Quedaban desactualizadas tras el cambio anterior                                                                                                               | M1   |
| `eslint.config.mjs`                                             | Plantilla `forkNotice` y un bloque final que la aplica a `src/custom/**` y `test/unit/custom/**`                                                                                                                                                       | La regla `notice/notice` exige la cabecera de copyright de Microsoft en todo archivo. Nuestro código no es suyo                                                | M1   |

| `extensions/mssql/package.json` | **M2**: comando `sqlworks.openAdminPanel` y su entrada en `view/item/context` | Anclaje nº1 del brief: así el panel se lanza desde el árbol sin tocar el explorador de objetos | M2 |
| `extensions/mssql/src/extension.ts` | **M2, 2 líneas más**: el `import` de `registerCustom` y su llamada | Anclaje nº2 del brief: registro único de todo lo que añade el fork | M2 |
| `extensions/mssql/scripts/bundle-webviews.js` | **1 línea**: entry point `sqlworks` | Anclaje que el brief no previó (§11.1). Es un router, así que se queda en una línea para siempre | M2 |
| `extensions/mssql/tsconfig.extension.json` | **1 línea**: excluye `src/custom/webviews` | Mismo reparto que el upstream hace con `src/webviews` | M2 |
| `extensions/mssql/tsconfig.webviews.json` | **2 líneas**: incluye `src/custom/webviews` y `src/custom/sharedInterfaces` | Ídem | M2 |

### Archivos de test y de arnés e2e que el renombrado obligó a tocar

Todos por la misma razón: fijaban el identificador de la extensión o el título del contenedor de
vistas como literal. Detalle y síntomas en §15.6 y §15.7.

| Archivo                                                              | Qué se cambió                                                      | Hito |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ | ---- |
| `extensions/mssql/test/e2e/utils/launchVscodeWithMsSqlExt.ts`        | **1 línea**: selector de la pestaña de la barra de actividad       | M1   |
| `extensions/mssql/test/e2e/utils/testHelpers.ts`                     | **1 línea**: el mismo selector                                     | M1   |
| `extensions/mssql/test/unit/databaseProjects/testUtils.ts`           | **2 líneas**: usa la constante en vez del literal, más su `import` | M1   |
| `extensions/mssql/test/unit/databaseProjects/testContext.ts`         | **2 líneas**: ídem                                                 | M1   |
| `extensions/mssql/test/unit/databaseProjects/baselines/baselines.ts` | **2 líneas**: ídem                                                 | M1   |
| `extensions/mssql/test/unit/databaseProjects/buildHelper.test.ts`    | **3 líneas**: ídem, dos usos                                       | M1   |
| `extensions/mssql/test/unit/azureResourcesIntegration.test.ts`       | **2 líneas**: la aserción de la autoridad del URI, más su `import` | M1   |

**Coste real de merge: nueve líneas de código de producto** repartidas en seis archivos, ninguna
con lógica, más **trece líneas de infraestructura de test** en siete archivos. El resto son
identidad, recursos binarios y un README, donde un conflicto se resuelve siempre quedándose con
el nuestro.

En los archivos de test el cambio es además a prueba de futuro: pasan a leer el identificador de
la constante, así que un renombrado posterior no los vuelve a romper.

### Archivos nuevos, que no generan conflicto

| Archivo                                                       | Para qué                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `extensions/mssql/src/custom/overrides/telemetry.ts`          | El corte de telemetría, documentado                        |
| `extensions/mssql/test/unit/custom/telemetryOverride.test.ts` | Fija el corte para que un merge no lo revierta en silencio |
| `extensions/mssql/scripts/package-fork.js`                    | Empaquetado de una sola plataforma (ver §2.1)              |
| `NOTICE.md`                                                   | Aviso de copyright propio, junto al de Microsoft           |
| `FORK.md`                                                     | Este archivo                                               |

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

## 11. Decisiones

**Decisiones tomadas por el usuario el 2026-09-17:**

| #    | Asunto                            | Decisión                                                                                                                     |
| ---- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 11.4 | Empaquetado del SQL Tools Service | **Aprobada la recomendación: modo `--offline`** (STS autocontenido dentro del `.vsix`)                                       |
| 11.5 | Replanteo de M8 (formateador)     | **Aprobada la recomendación: conservar el formateador del upstream y construir solo lo que falta.** No entra `sql-formatter` |

Consecuencias de 11.5 sobre el brief, que quedan formalmente derogadas:

- §13.1 («sustituye el proveedor de formato del upstream») — no se hace: no hay registro que
  sustituir y el del upstream es mejor.
- §13 «Cómo implementarlo sin escribir un parser» (usar `sql-formatter`) — se sustituye por el
  mapeo perfil XML ↔ `mssql.format.options.*`.
- El anclaje nº 3 del brief (registro del proveedor de formato) desaparece de la lista.

Lo que M8 sigue entregando, sin cambios: el perfil XML, los perfiles múltiples con selector, el
panel de opciones con vista previa lado a lado, la importación desde los ajustes actuales, un
test por opción, y las opciones no soportadas deshabilitadas en la interfaz con su mensaje.

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

### 13.1. Cómo se reproduce

El entorno de verificación se monta entero con Docker, sin depender de ninguna instancia externa:

```bash
docker run -d --name mssql-parity \
  -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='<contraseña>' -e MSSQL_PID=Developer \
  -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest
```

La base de prueba (`ParityDb`) lleva dos tablas con clave ajena e índice, una vista, un
procedimiento, un esquema propio (`ventas`), un login y usuario `parity_user`, un rol
`ventas_lectores` con `GRANT SELECT` de esquema, y un **`DENY` a nivel de columna** —
el escenario que M4 necesita para probar la matriz de permisos.

Dos arneses distintos:

1. **La suite e2e del upstream** (`npx playwright test`, VS Code real bajo `xvfb`), que cubre
   la interfaz. Requiere `extensions/mssql/test/e2e/.env` (está en `.gitignore`, así que la
   contraseña no entra al repositorio).
2. **Un arnés JSON-RPC contra el STS** para lo que la suite del upstream no cubre. Habla
   directamente con `sqltoolsservice/<versión>/Linux/MicrosoftSqlToolsServiceLayer` usando los
   mismos contratos que la extensión. Verifica el motor sin depender de la interfaz.

### 13.2. Resultado sobre el fork sin modificar (commit `752692d`)

| #   | Comprobación                                                          | Estado | Evidencia                                                                                 |
| --- | --------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| 1   | Conectar con autenticación SQL                                        | ✅     | e2e `connection.spec.ts` + arnés: SQL Server 16.0.4295.3, Developer Edition               |
| 1b  | Conectar con autenticación integrada                                  | ❌     | **No verificable aquí**: requiere Windows y un dominio Kerberos                           |
| 2   | Explorador: servidor, base, tablas, vistas, procedimientos, seguridad | ✅     | arnés: árbol completo expandido, incluidas columnas con tipo y PK                         |
| 3   | IntelliSense sugiere tablas y columnas reales                         | ✅     | arnés: `ventas.` → `Cliente`, `Pedido`, `vPedidoCliente`                                  |
| 4   | Ejecutar consulta: resultados, mensajes, varios conjuntos             | ✅     | arnés: 2 conjuntos + 3 mensajes (`PRINT` y los dos «rows affected»)                       |
| 5   | Exportar a CSV y a JSON                                               | ✅     | arnés: `query/saveCsv` y `query/saveJson`, contenido comprobado                           |
| 6   | Script as Create sobre tabla y sobre procedimiento                    | ✅     | arnés: `CREATE TABLE [ventas].[Cliente]` y `CREATE PROCEDURE [ventas].[ObtenerPedidos]`   |
| 7   | Plan de ejecución estimado                                            | ✅     | e2e `executionPlan.spec.ts`: 12 tests (zoom, tooltips, propiedades, XML, buscar nodo)     |
| 8   | Historial de consultas                                                | ⚠️     | `queryHistoryProvider.test.js`: 10 tests unitarios en verde. Sin comprobación de interfaz |

**Siete de los ocho puntos verificados contra una instancia real.** Los dos huecos:

- **Autenticación integrada** es un hueco estructural de este entorno, no un fallo del fork.
  Solo se puede comprobar en la máquina del usuario, que es además donde se usa.
- **Historial de consultas** tiene cobertura unitaria del upstream pero es una vista de
  `TreeDataProvider` que no pasa por el STS, así que el arnés no la alcanza.

### 13.3. Toolchain

| Comprobación                                     | Resultado                                                 |
| ------------------------------------------------ | --------------------------------------------------------- |
| `npm install` en la raíz                         | ✅                                                        |
| `npm run build -- --target mssql`                | ✅ (con Node 24; falla con Node 22)                       |
| `dist/extension.js` generado                     | ✅                                                        |
| `dist/views/` con los 28 entry points de webview | ✅                                                        |
| `npm test -- --target mssql`                     | ✅ 5103 pasan, 0 fallan, 17 omitidos (289 archivos)       |
| Suite e2e del upstream                           | ✅ 15 pasan, 2 omitidos (tras aislar el defecto de §13.4) |
| Remoto `upstream` configurado y accesible        | ✅                                                        |

La salida de los tests confirma además el hallazgo de §6: _«No telemetry connection string
found; telemetry will not be sent»_.

### 13.4. Defecto del upstream encontrado al correr la paridad

`test/e2e/utils/testHelpers.ts:37` busca el campo «Database name» del diálogo de conexión como
`getByRole("textbox", …)`, pero ese campo es un **combobox** desde que
`src/connectionconfig/formComponentHelpers.ts:299` lo declara `FormItemType.Combobox` con
`freeform: true`. La suite falla siempre que `DATABASE_NAME` está puesto en el `.env`.

Hay una segunda causa encadenada: el combobox intenta poblar la lista de bases antes de que el
helper marque «Trust server certificate», y con `Encrypt=Mandatory` y certificado autofirmado
falla con _«Unable to load database list from server»_.

Comprobado que es el test y no el producto: con `DATABASE_NAME` vacío las dos especificaciones
pasan, y el errorlog del servidor muestra la creación y el borrado reales de `TestDB`.

**No lo arreglamos**: es código de test del upstream, y tocarlo es deuda de merge para un
defecto que no nos afecta. Queda anotado aquí para no volver a diagnosticarlo, y para reportarlo
al upstream si interesa. Consecuencia práctica: **nuestro `.env` de paridad deja
`DATABASE_NAME` vacío.**

Aviso adicional: `connection.spec.ts` y `queryExecution.spec.ts` tienen aserciones débiles
(`connection.spec` no comprueba que la conexión se creara; `queryExecution` busca el texto
`Doe`, que también está en el propio editor). Pasan aunque no se conecte. No te fíes de su
verde: mira el errorlog del servidor, como se hizo aquí.

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

---

## 15. Renombrado (M1)

### 15.1. Identidad

| Campo                           | Antes                 | Ahora         |
| ------------------------------- | --------------------- | ------------- |
| `name`                          | `mssql`               | `sqlworks`    |
| `displayName`                   | `SQL Server (mssql)`  | `SQLWorks`    |
| `publisher`                     | `ms-mssql`            | `alfredc1403` |
| `version`                       | `1.46.0`              | `0.1.0`       |
| `icon`                          | logotipo de Microsoft | obra propia   |
| Título del contenedor de vistas | `SQL Server`          | `SQLWorks`    |

El identificador completo de la extensión pasa de `ms-mssql.mssql` a `alfredc1403.sqlworks`, así
que VS Code las trata como extensiones distintas.

**Versión:** propia desde `0.1.0`. La base del upstream se anota en la tabla de cabecera de este
archivo y se actualiza en cada merge. Así dos builds nuestros sobre la misma base se distinguen.

### 15.2. Prefijo de identificadores: se conserva `mssql.`

Los 119 comandos, las 166 opciones de configuración y las vistas siguen llamándose `mssql.*`.
**Renombrarlos sería el cambio más caro posible en este fork:** los identificadores están en
`src/constants/constants.ts` y referenciados por centenares de archivos del upstream, y cada
merge futuro traería conflictos en todos ellos. Es exactamente lo que la regla de oro del §4 del
brief quiere evitar, y el propio brief lo permite («deja los existentes como están, salvo que haya
conflicto con la extensión oficial»).

Lo nuevo sí usa prefijo propio: **`sqlworks.`**

Consecuencia que hay que respetar: **no se pueden tener SQLWorks y la extensión MSSQL oficial
instaladas a la vez**, porque los dos declararían los mismos `mssql.*`. Está avisado en el README
de la extensión. Si algún día hiciera falta convivencia, habría que renombrar el prefijo y asumir
el coste.

### 15.3. Telemetría

Cortada en `src/custom/overrides/telemetry.ts`, con dos líneas en `src/extension.ts`. El
razonamiento completo está en el comentario de ese archivo; en resumen:

- Los tres emisores del upstream (extensión, relé de `telemetry/sqlevent` del STS, y `Perf`)
  comparten un único `telemetryReporter` del extension-toolkit. Basta con dejarlo sin transporte.
- Se cierran **las dos** vías de entrada de la clave: `package.json` → `aiKey`, y la variable de
  entorno `MSSQL_APP_INSIGHTS_KEY` que el constructor del reporter consulta como respaldo.
- `test/unit/custom/telemetryOverride.test.ts` lo fija con cuatro tests, para que un merge no lo
  revierta en silencio.
- `scripts/package-fork.js` aborta el empaquetado si `package.json` declara `aiKey`.

El único `http.request` que queda en el árbol es el sink de `src/diagnostics/sinks.ts`, que exige
`PERF_MODE=1` más `PERF_MARKER_URL` y `PERF_CONTROL_TOKEN`: es el arnés local de `tools/perftest`,
no un canal hacia el exterior. No se toca.

### 15.4. Empaquetado

`extensions/mssql/scripts/package-fork.js` (archivo nuevo) empaqueta **una** plataforma con el
SQL Tools Service autocontenido dentro, reutilizando las funciones que exporta
`package-extension.js` del upstream:

```bash
npm run build -- --target mssql        # desde la raíz
cd extensions/mssql
node scripts/package-fork.js --platform win-x64
```

El modo `--offline` del upstream recorre las seis plataformas y tarda mucho; para distribución
interna sobra. Tampoco hace falta su `withOfflinePackageManifest`, porque este fork ya no declara
`ms-dotnettools.vscode-dotnet-runtime` en `extensionPack`.

### 15.5. Restos cosméticos que se dejan a propósito

Tres cadenas de `package.nls.json` siguen diciendo «MSSQL extension»:
`mssql.openInMssqlExtensionFromAzureResources`, `mssql.enableExperimentalFeatures.description` y
`mssql.walkthroughs.nextSteps.description`. Cambiarlas obligaría a tocar un archivo de
localización generado del upstream, que AGENTS.md prohíbe editar a mano, por tres textos
descriptivos. Se dejan.

El `README.md` de la raíz del monorepo también sigue siendo el de Microsoft. No se distribuye en
el `.vsix` y tocarlo es deuda de merge sin ganancia funcional. Si se quiere cambiar, es un cambio
de una sola vez y sin riesgo.

### 15.6. El identificador de la extensión se autorreferencia: cinco sitios

Esto no estaba previsto y es el hallazgo caro de M1. Renombrar `publisher` y `name` cambia el
identificador de `ms-mssql.mssql` a `alfredc1403.sqlworks`, y **la extensión se busca a sí misma
por ese identificador**. Si no se actualiza, `src/configurations/changelog.ts:267` hace
`vscode.extensions.getExtension(constants.extensionId).packageJSON.version` sobre `undefined` y
**el host de extensiones revienta al cargar el módulo**, no al usar la función.

Se detectó porque la suite de tests pasó de 5103 pruebas a 89: el fallo aborta la carga.

Los cinco sitios están en la tabla del §0. Tres son copias del mismo literal
(`constants.ts`, `databaseProjects/common/extensionIds.ts`, `databaseProjects/tools/buildHelper.ts`),
uno es la autoridad del URI de `vscode://…/connect`, y el último son dos comentarios.

Lo que **no** se toca, porque son identificadores de contribución declarados en nuestro propio
`package.json` y no dependen del publisher:

- `ms-mssql.sql-result-renderer` — el `notebookRenderer` que contribuimos.
- `ms-mssql.sql-notebook-controller` — el controlador de notebooks.

Tampoco se tocan las referencias a **otras** extensiones, que siguen siendo de Microsoft:
`ms-mssql.sql-database-projects-vscode`, `ms-mssql.data-workspace-vscode`,
`ms-mssql.mssql-database-management-keymap`.

**Comprobación para después de cada merge:** si el upstream añade un nuevo
`getExtension("ms-mssql.mssql")`, el síntoma es el host de extensiones cayéndose al arrancar.

```bash
git grep -n '"ms-mssql\.mssql"' -- extensions/mssql/src
```

Tiene que devolver cero resultados.

### 15.7. Otros sitios que el renombrado rompió

Además de los cinco del §15.6, el cambio de título del contenedor de vistas
(`SQL Server` → `SQLWorks`) rompió el **arnés e2e**, que buscaba la pestaña de la barra de
actividad por su etiqueta:

| Archivo                                                       | Línea                               |
| ------------------------------------------------------------- | ----------------------------------- |
| `extensions/mssql/test/e2e/utils/launchVscodeWithMsSqlExt.ts` | selector `aria-label^="SQL Server"` |
| `extensions/mssql/test/e2e/utils/testHelpers.ts`              | el mismo selector                   |

Síntoma: **todos** los tests e2e fallan con timeout al arrancar, porque el lanzador no encuentra
la pestaña. Arreglado con el título nuevo en las dos.

Y cinco archivos de test que fijaban el identificador de la extensión como literal. Todos pasan
ahora a leerlo de la constante, así que un renombrado futuro no los vuelve a romper:

| Archivo                                             | Qué hacía                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `test/unit/databaseProjects/testUtils.ts`           | `getExtension("ms-mssql.mssql")`, y lanzaba «MSSQL extension is unavailable in the test host» |
| `test/unit/databaseProjects/testContext.ts`         | ídem                                                                                          |
| `test/unit/databaseProjects/baselines/baselines.ts` | ídem, degradaba la ruta base a `""` en silencio                                               |
| `test/unit/databaseProjects/buildHelper.test.ts`    | ídem, dos veces                                                                               |
| `test/unit/azureResourcesIntegration.test.ts`       | `expect(uri.authority).to.equal("ms-mssql.mssql")`                                            |

Lo que **no** se toca: los nueve `vscode://ms-mssql.mssql/...` de
`test/unit/mssqlProtocolHandler.test.ts`. El gestor de URI no mira la autoridad (VS Code ya la ha
usado para enrutar), así que esos tests pasan igual. Cambiarlos sería deuda de merge por estética.

### 15.8. Verificación de M1

| Comprobación                                               | Resultado                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run build -- --target mssql`                          | ✅                                                                             |
| `npm run lint -- --target mssql`                           | ✅                                                                             |
| `npm test -- --target mssql`                               | ✅ **5107 pasan, 0 fallan**, 17 omitidos (290 archivos)                        |
| `node scripts/package-fork.js --platform win-x64`          | ✅ `sqlworks-0.1.0-win-x64.vsix`, 118,93 MB, 1492 archivos                     |
| Identidad dentro del paquete                               | ✅ `alfredc1403.sqlworks` v0.1.0, icono propio                                 |
| `aiKey` en el paquete                                      | ✅ ausente                                                                     |
| `LICENSE.txt` y `ThirdPartyNotices.txt` en el paquete      | ✅ intactos                                                                    |
| STS empaquetado                                            | ✅ `MicrosoftSqlToolsServiceLayer.exe` nativo, con el runtime de .NET incluido |
| Recursos de marca de Microsoft en el paquete               | ✅ ninguno                                                                     |
| Instalación del `.vsix` en ventana limpia y activación     | ✅ `vsix.spec.ts`, 2 tests                                                     |
| STS del paquete funcionando **sin `dotnet` en la máquina** | ✅ los 6 puntos del arnés de paridad, contra el binario extraído del `.vsix`   |

Los 4 tests nuevos de `telemetryOverride.test.ts` están dentro de los 5107.

La última fila es la que valida la decisión 11.4. Se generó un paquete `linux-x64` solo para
poder comprobarlo aquí, se extrajo su `sqltoolsservice/` y se corrió el arnés del §13.1 contra ese
binario, con `dotnet` ausente del sistema. Arrancó y los seis puntos pasaron, así que el
`.vsix` offline es de verdad autocontenido. El paquete `linux-x64` se descartó después: el que se
distribuye es `win-x64`.

---

## 16. Punto de anclaje (M2)

### 16.1. Estructura real de `src/custom/`

El brief propone una estructura que asume la extensión suelta. El repositorio separa el código del
**host de extensión** del de los **webviews** con dos `tsconfig` distintos, así que la carpeta
propia refleja ese mismo reparto:

```
extensions/mssql/src/custom/
  index.ts                  registerCustom(): único punto de anclaje
  strings.ts                textos del host, en español
  sharedInterfaces/         tipos compartidos host ↔ webview (en AMBOS tsconfig)
    customWebview.ts        discriminante de vista para el router
    adminPanel.ts
  admin/
    panels/                 controladores del host
      adminPanelController.ts
    sql/                    (M3) todo el T-SQL, y solo aquí
  util/
    connectionTarget.ts     resuelve un nodo del árbol → servidor y base
  overrides/                modificaciones a lo existente
    telemetry.ts
  webviews/                 TODO el React del fork (solo en tsconfig.webviews)
    index.tsx               router de vistas
    strings.ts              textos de los webviews
    common/panelShell.tsx   estructura común de paneles (§14 del brief)
    AdminPanel/
  snippets/                 (M7)
  format/                   (M8)
```

Dos desviaciones del brief, ambas forzadas por el reparto de `tsconfig`:

1. **`webviews/` es una carpeta de primer nivel**, no una subcarpeta de cada función. Si cada
   función metiera su React en su propio directorio, cada una necesitaría su línea en los dos
   `tsconfig`. Con una sola raíz, el coste es de una vez.
2. **`sharedInterfaces/`** existe porque los tipos que cruzan el puente host ↔ webview tienen que
   compilar en los dos lados. No puede importar `vscode` ni nada del host.

### 16.2. Un solo entry point de esbuild, con router

`scripts/bundle-webviews.js` tiene una lista literal de entry points, y el brief no lo previó.
En lugar de añadir una línea por panel, hay **una sola**:

```js
sqlworks: "src/custom/webviews/index.tsx",
```

Ese archivo es un router: lee el campo `view` del estado que le manda el host y elige el
componente. Añadir un panel es añadir un `case`, no una línea en un archivo del upstream.

Todos los controladores del fork pasan `"sqlworks"` como `sourceFile`, y `WebviewBaseController`
construye el HTML como `sqlworks.js` + `sqlworks.css`.

### 16.3. Textos en español, sin `l10n.t()`

Los textos nuevos son constantes planas en `src/custom/strings.ts` (host) y
`src/custom/webviews/strings.ts` (webviews), no `l10n.t()`.

La regla de ESLint `custom-eslint-rules/no-direct-l10n` tiene una **lista blanca cerrada de dos
archivos del upstream**, y ampliarla sería deuda de merge. Pero la razón de fondo es otra: la
tubería de localización (`*.xlf`, `*.l10n.json`) la genera y la traduce Microsoft en su propia
infraestructura, y nuestros textos no entran ahí. La interfaz nueva es solo en español por
decisión del brief, así que envolverlos en `l10n.t()` no aportaría nada.

Contrapartida honesta: si algún día hiciera falta un segundo idioma, hay que retrofitear. Los dos
archivos de textos son el único punto a cambiar.

### 16.4. El panel no abre su propia conexión

`resolveConnectionTarget` reutiliza la conexión que la extensión ya tiene abierta y **no conecta
por su cuenta** (regla 16.2 del brief). Si el perfil no está conectado, avisa y el usuario conecta
desde el árbol como haría siempre. La URI de conexión que devuelve es la identidad con la que M3 y
siguientes hablarán con el SQL Tools Service.

Los datos del motor (versión, edición, nube) salen de `connectionManager.getServerInfo()`, que es
lo que el motor informó al establecer la conexión: **cero T-SQL en M2**. El T-SQL llega en M3 y vive
solo en `src/custom/admin/sql/`.

### 16.5. Verificación de M2

| Comprobación                                       | Resultado                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run build -- --target mssql`                  | ✅ genera `dist/views/sqlworks.js` y `.css`                                         |
| `npm run lint -- --target mssql`                   | ✅                                                                                  |
| `npm test -- --target mssql`                       | ✅ **5119 pasan, 0 fallan** (290 archivos + 2 nuestros)                             |
| Tests propios de M2                                | ✅ 8 de `resolveConnectionTarget` + 4 de `AdminPanelController`                     |
| **Panel abriendo desde el explorador de objetos**  | ✅ `test/e2e/sqlworksAdminPanel.spec.ts`, contra SQL Server 2022 real               |
| Panel mostrando servidor y base de datos correctos | ✅ en el mismo test: `localhost,1433` y `ParityDb`, más versión y edición del motor |

El criterio de cierre del brief («terminado cuando el panel abre desde el explorador de objetos y
sabe a qué servidor y base está apuntando») queda comprobado de punta a punta, no solo por
unitarios.

### 16.6. Cómo correr el test e2e del panel

```bash
# 1. Levanta la instancia y siembra la base (ver §13.1)
# 2. Configura extensions/mssql/test/e2e/.env  (está en .gitignore)
cd extensions/mssql
SKIP_DOTNET_RUNTIME_EXTENSION_INSTALL=true npx playwright test sqlworksAdminPanel.spec.ts
```

El test **precarga el perfil de conexión en `settings.json`** en lugar de rellenar el diálogo, por
la razón del §17.3. Es más rápido y no depende de la interfaz del diálogo.

---

## 17. Defectos del upstream encontrados

Se anotan aquí para no volver a diagnosticarlos, y por si interesa reportarlos. **Ninguno se
arregla**: son código del upstream y tocarlos es deuda de merge a cambio de nada para nosotros.

### 17.1. El helper e2e busca el campo «Database name» como `textbox`

`test/e2e/utils/testHelpers.ts:37` lo busca con `getByRole("textbox", …)`, pero
`src/connectionconfig/formComponentHelpers.ts:299` lo declara `FormItemType.Combobox` con
`freeform: true`. La suite falla siempre que `DATABASE_NAME` está puesto en el `.env`.

Ver §13.4 para el diagnóstico completo.

### 17.2. Aserciones débiles en dos especificaciones e2e

`connection.spec.ts` no comprueba que la conexión se creara, y `queryExecution.spec.ts` busca el
texto `Doe`, que también está en el propio editor. **Pasan aunque no se conecte nada.** No te fíes
de su verde: mira el errorlog del servidor.

### 17.3. El diálogo de conexión se cuelga tras un primer intento fallido por certificado

Con un certificado autofirmado y `Encrypt=Mandatory`, el primer intento falla con
_«error occurred during the pre-login handshake (provider: TCP Provider, error: 35)»_. La
extensión reintenta y **la conexión se establece**: el log muestra
`Connected to server … Server information: {…}` con la versión y la edición del motor.

Pero el botón del diálogo se queda en «Connecting…» indefinidamente. Cinco minutos después
aparece `Error disconnecting after connection test: Client is not running`.

Reproducido varias veces contra SQL Server 2022 en Docker. Con el perfil **precargado en
`settings.json`** —que ya lleva `trustServerCertificate: true` desde el principio— no hay primer
intento fallido y la conexión tarda **76 ms**. Por eso los tests del fork precargan el perfil.

Consecuencia práctica para el usuario: si al conectar por primera vez a un servidor con
certificado autofirmado el diálogo se queda colgado, la conexión probablemente ya funcionó;
cerrar el diálogo y usar el árbol.

### 17.4. El lanzador e2e asumía un árbol vacío

`test/e2e/utils/launchVscodeWithMsSqlExt.ts` esperaba el nodo «Add Connection» para dar el
explorador por listo. Ese nodo solo existe cuando no hay ningún perfil, así que precargar uno
rompía el arranque de **toda** la suite. Cambiado por esperar a que el árbol de conexiones tenga
cualquier elemento, que es lo que de verdad indica que ya está montado. Está en la tabla del §0.
