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
| **Último merge con el upstream** | **`f9e632ea`, traído en M9 el 2026-09-18** (§26)                    |
| Versión de la extensión upstream | `1.46.0` (sin cambio en el merge de M9)                             |
| Fecha del inventario             | 2026-09-17                                                          |

> **El inventario sigue anclado a `752692d`, a propósito.** Describe el terreno sobre el que se
> construyó el fork, y reescribirlo en cada merge perdería esa foto. Lo que el merge de M9 dejó
> desfasado está corregido en el sitio, y lo que el upstream añadió está en §26.3.

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
| `extensions/mssql/src/mssqlProtocolHandler.ts`                  | 2 líneas de comentario con el esquema de URI de ejemplo, **más su marcador `// [FORK]` (añadido en M9)**                                                                                                                                               | Quedaban desactualizadas tras el cambio anterior. Era el único archivo de esta tabla sin marcador, así que `git grep "\[FORK\]"` no lo veía (§26.5)            | M1   |
| `eslint.config.mjs`                                             | Plantilla `forkNotice` y un bloque final que la aplica a `src/custom/**`, `test/unit/custom/**` y `test/harness/**` (esta última, §28)                                                                                                                 | La regla `notice/notice` exige la cabecera de copyright de Microsoft en todo archivo. Nuestro código no es suyo                                                | M1   |

| `extensions/mssql/package.json` | **M2**: comando `sqlworks.openAdminPanel` y su entrada en `view/item/context` | Anclaje nº1 del brief: así el panel se lanza desde el árbol sin tocar el explorador de objetos | M2 |
| `extensions/mssql/src/extension.ts` | **M2, 2 líneas más**: el `import` de `registerCustom` y su llamada | Anclaje nº2 del brief: registro único de todo lo que añade el fork | M2 |
| `extensions/mssql/scripts/bundle-webviews.js` | **1 línea**: entry point `sqlworks` | Anclaje que el brief no previó (§11.1). Es un router, así que se queda en una línea para siempre | M2 |
| `extensions/mssql/tsconfig.extension.json` | **1 línea**: excluye `src/custom/webviews` | Mismo reparto que el upstream hace con `src/webviews` | M2 |
| `extensions/mssql/tsconfig.webviews.json` | **2 líneas**: incluye `src/custom/webviews` y `src/custom/sharedInterfaces` | Ídem | M2 |
| `extensions/mssql/tsconfig.webviews.json` | **M3, 1 línea**: incluye además `src/custom/admin/sql/types.ts` | Los tipos del dominio los fija el §9 del brief en esa ruta y el panel los pinta tal cual. No importan nada, así que compilan en los dos lados sin duplicarlos | M3 |
| `extensions/mssql/package.json` | **M5**: el ajuste `sqlworks.productionServers` en `contributes.configuration.properties`, con `scope: "application"` | Regla 11.4 del brief. Un ajuste solo existe si está declarado aquí; el `scope` impide que el `settings.json` de un repositorio desmarque un servidor de producción (§22.7). Es el **único** archivo del upstream que M5 toca | M5 |
| `extensions/mssql/package.json` | **M7**: la vista `sqlworksSnippets` (`type: "webview"`) dentro del contenedor `objectExplorer` que ya existe, el comando `sqlworks.showSnippets` y el ajuste `sqlworks.snippets.sharedLibraries` | Punto 12 del brief. Una vista y un comando solo existen si están declarados aquí. Va en el contenedor del upstream en lugar de crear otro, que sería una segunda barra para lo mismo. Es el **único** archivo del upstream que M7 toca | M7 |
| `extensions/mssql/package.json` | **M8**: los comandos `sqlworks.openFormatPanel` y `sqlworks.applyFormatProfile`, y el ajuste `sqlworks.format.profiles` | El fork **no sustituye** el formateador: lo configura escribiendo `mssql.format.options.*` (§25.1). No se toca ninguna de las 55 declaraciones del upstream; el panel las **lee** en tiempo de ejecución. Es el **único** archivo del upstream que M8 toca | M8 |
| `extensions/mssql/package.json` | **M9, 1 línea**: `"visibility": "collapsed"` en nuestra vista `sqlworksSnippets` | Visible por omisión materializaba un segundo `iframe.webview` y rompía dos e2e del upstream, y con ellos los puntos 1 y 7 de la lista de paridad (§26.4). Se arregla en **nuestra** contribución, no en el arnés del upstream | M9 |
| `extensions/mssql/package.json` | **§29**: `editor.quickSuggestions` dentro del `[sql]` de `contributes.configurationDefaults`, que ya existía | VS Code trae `other` en `offWhenInlineCompletions` y con Copilot delante la lista no se abría sola: solo con Ctrl+Espacio (§29.2). Es un valor de fábrica, por debajo de los ajustes del usuario. **Ninguna línea del upstream sustituida** | §29 |
| `extensions/mssql/src/views/statusView.ts` | **§30, 6 líneas**: un guardia al principio de `showStatusBarItem` que esconde `statusConnection` y `statusChangeDatabase` | El selector del fork los pinta a la izquierda. Sin el guardia, servidor y base salen dos veces en la misma barra (§30.2). **Ninguna línea del upstream sustituida** | §30 |
| `extensions/mssql/src/sharedInterfaces/queryResult.ts` | **§31**: el tipo de petición `ShowReferencedRowRequest` y el `import` de los tipos del fork | La rejilla del upstream es quien la manda y quien pinta la respuesta, así que el contrato tiene que estar donde ella lo ve | §31 |
| `extensions/mssql/src/queryResult/queryResultWebViewController.ts` | **§31, 3 líneas**: el `import` y el manejador de esa petición | Su controlador es el único que puede atenderla. La resolución vive en `src/custom/results/` | §31 |
| `extensions/mssql/src/webviews/pages/QueryResult/queryResultFluentResultGrid.tsx` | **§31**: la contribución `sqlworks.showReferencedRow` al menú de celda, su caso, y el globo junto a la rejilla | La rejilla admite comandos de terceros por diseño; lo que hay que tocar es el consumidor que arma la configuración (§31.1) | §31 |
| `extensions/mssql/src/webviews/common/FluentResultGrid/internal/fluentResultGridCommandController.ts` | **§31, 6 líneas y un helper**: el menú contextual de celda lleva ahora la celda en su contexto | Hasta aquí `cell` solo lo rellenaba el doble clic, así que un comando del menú **de celda** no sabía sobre qué celda se había pulsado (§31.4) | §31 |
| `extensions/mssql/package.json` | **§30**: `mssql.query.showActiveConnectionAsCodeLensSuggestion` pasa a `default: false` | El CodeLens de la línea 0 se desplaza con el texto y deja de verse (§30.1). El ajuste sigue declarado: quien lo quiera lo enciende | §30 |
| `extensions/mssql/src/webviews/pages/TableExplorer/TableExplorerToolbar.tsx` | **§32**: el botón «Save Changes» **sustituido** por el par confirmar/descartar, más el `import` y la propiedad `onDiscard` | Es justo lo que se pidió cambiar: un disquete gris entre nueve iconos grises, sin cuenta y sin la otra mitad (§32.1). Único sitio del upstream sustituido en §32 | §32 |
| `extensions/mssql/src/webviews/pages/TableExplorer/TableDataGrid.tsx` | **§32, 2 añadidos**: `revertAllPendingRows()` en el ref de la rejilla y el `import` de `pendingRowIds` | La cuenta y el resaltado son de la rejilla, en refs propias: revertir desde fuera devolvía los valores y dejaba la barra diciendo «(2)» (§32.3). **Ninguna línea del upstream sustituida** | §32 |
| `extensions/mssql/src/webviews/pages/TableExplorer/TableExplorerPage.tsx` | **§32, 5 líneas**: `handleDiscard`, que llama a la rejilla, y su paso a la barra | Es quien tiene el ref de la rejilla. **Ninguna línea del upstream sustituida** | §32 |
| `extensions/mssql/src/tableExplorer/tableExplorerWebViewController.ts` | **§33, 3 líneas**: un parámetro opcional `_initialQuery` en el constructor, que pasa a `edit/initialize` y al panel de SQL | Es lo que ata la sesión de edición a la consulta del usuario en lugar de a la tabla entera (§33.1). Opcional: sin él todo sigue igual. **Ninguna línea del upstream sustituida** | §33 |
| `extensions/mssql/src/sharedInterfaces/queryResult.ts` | **§33**: el tipo de petición `EditQueryResultsRequest` y el `import` de los tipos del fork | Mismo motivo que §31: la rejilla del upstream es quien la manda | §33 |
| `extensions/mssql/src/queryResult/queryResultWebViewController.ts` | **§33, 14 líneas**: el `import` y el manejador, que saca del `QueryRunner` el rango del lote | Su controlador es el único que ve el `QueryRunner`, que es quien sabe qué texto produjo cada conjunto (§33.3) | §33 |
| `extensions/mssql/src/webviews/pages/QueryResult/queryResultFluentResultGrid.tsx` | **§33**: la contribución `sqlworks.editQueryResults` al menú de celda y su caso | Igual que §31: la rejilla admite comandos de terceros por diseño | §33 |

**Sobre el marcador `// [FORK]` en `package.json`:** JSON no admite comentarios, así que ahí no se
puede poner. El registro son esta tabla y el prefijo `sqlworks.` de todo lo que añade el fork, que
es auditable con `git grep -n '"sqlworks\.' -- extensions/mssql/package.json`. Mismo criterio que en
M1 y M2.

### Archivos de test y de arnés e2e que el renombrado obligó a tocar

Todos por la misma razón: fijaban el identificador de la extensión o el título del contenedor de
vistas como literal. Detalle y síntomas en §15.6 y §15.7.

| Archivo                                                              | Qué se cambió                                                                                                                                                                                                                                                                                                  | Hito |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `extensions/mssql/test/e2e/utils/launchVscodeWithMsSqlExt.ts`        | **1 línea**: selector de la pestaña de la barra de actividad                                                                                                                                                                                                                                                   | M1   |
| `extensions/mssql/test/e2e/utils/launchVscodeWithMsSqlExt.ts`        | **4 líneas de lógica**: espera a que el árbol de conexiones exista, en lugar del nodo «Add Connection» que solo aparece con el árbol vacío (§17.4)                                                                                                                                                             | M0   |
| `extensions/mssql/test/e2e/utils/launchVscodeWithMsSqlExt.ts`        | **5 líneas**: un `workspaceFolder` opcional en la configuración de lanzamiento, su `--folder-uri` y el `import` de `pathToFileURL`. Sin carpeta abierta no existen los ámbitos de espacio de trabajo ni de carpeta, y no se puede medir que un `.vscode/settings.json` **no** cambia un ajuste nuestro (§27.1) | M9   |
| `extensions/mssql/test/e2e/utils/testHelpers.ts`                     | **1 línea**: el mismo selector                                                                                                                                                                                                                                                                                 | M1   |
| `extensions/mssql/test/unit/databaseProjects/testUtils.ts`           | **2 líneas**: usa la constante en vez del literal, más su `import`                                                                                                                                                                                                                                             | M1   |
| `extensions/mssql/test/unit/databaseProjects/testContext.ts`         | **2 líneas**: ídem                                                                                                                                                                                                                                                                                             | M1   |
| `extensions/mssql/test/unit/databaseProjects/baselines/baselines.ts` | **2 líneas**: ídem                                                                                                                                                                                                                                                                                             | M1   |
| `extensions/mssql/test/unit/databaseProjects/buildHelper.test.ts`    | **3 líneas**: ídem, dos usos                                                                                                                                                                                                                                                                                   | M1   |
| `extensions/mssql/test/unit/azureResourcesIntegration.test.ts`       | **2 líneas**: la aserción de la autoridad del URI, más su `import`                                                                                                                                                                                                                                             | M1   |

**Coste real de merge, medido.** La cifra que importa es cuántas líneas **del upstream** hemos
sustituido, porque son las únicas que pueden entrar en conflicto; las que añadimos encima (casi
todas comentarios que explican el porqué) no chocan con nada:

```bash
# Sustituidas / añadidas, archivo a archivo
git diff --numstat 752692d77..HEAD -- extensions/mssql/src extensions/mssql/test
```

| Categoría                       | Archivos | Líneas del upstream sustituidas | Líneas nuestras añadidas |
| ------------------------------- | -------- | ------------------------------- | ------------------------ |
| Código de producto              | 6        | **8**                           | 22                       |
| Infraestructura de test y arnés | 7        | **13**                          | 29                       |

De las 8 de producto, **ninguna tiene lógica**: son el identificador de la extensión en cuatro
copias, la autoridad de un URI, dos líneas de ejemplo en un comentario y la llamada a
`disableTelemetry()`. El resto de la tabla de arriba son identidad, recursos binarios y un README,
donde un conflicto se resuelve siempre quedándose con el nuestro.

> **Corregido en M9.** Antes aquí ponía «nueve líneas de producto» y «trece de test», sin decir qué
> se estaba contando. Trece era correcto y nueve no; ahora está medido, con el comando al lado, y
> separando lo sustituido de lo añadido, que es la distinción que de verdad predice un conflicto.

En los archivos de test el cambio es además a prueba de futuro: pasan a leer el identificador de
la constante, así que un renombrado posterior no los vuelve a romper.

**M3 no añadió ni una línea de producto al upstream**: solo una línea de configuración de build
(`tsconfig.webviews.json`). Todo lo demás vive en `src/custom/`.

**M4 no añadió ninguna, ni de producto ni de configuración.** El código que tienen que compartir el
host y el webview —el formato de duraciones y el cálculo de la herencia de permisos— vive en
`src/custom/sharedInterfaces/`, que ya está en los dos `tsconfig` desde M2. Es el mismo sitio donde
el upstream pone sus funciones puras compartidas.

### Archivos nuevos, que no generan conflicto

| Archivo                                                                        | Para qué                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `extensions/mssql/src/custom/overrides/telemetry.ts`                           | El corte de telemetría, documentado                                                                                                                                                                                                                          |
| `extensions/mssql/test/unit/custom/telemetryOverride.test.ts`                  | Fija el corte para que un merge no lo revierta en silencio                                                                                                                                                                                                   |
| `extensions/mssql/images/sqlworksIcon.png`                                     | El icono al que apunta de verdad `package.json`. La copia idéntica en `images/extensionIcon.png` existe solo para no tocar `changelogPage.tsx:40`, que la importa por esa ruta (NOTICE.md). **Son dos copias: al cambiar el logotipo hay que tocar las dos** |
| `extensions/mssql/scripts/package-fork.js`                                     | Empaquetado de una sola plataforma (ver §2.1)                                                                                                                                                                                                                |
| `NOTICE.md`                                                                    | Aviso de copyright propio, junto al de Microsoft                                                                                                                                                                                                             |
| `extensions/mssql/test/harness/stsCompletionProbe.mjs`                         | Sonda JSON-RPC contra el STS: qué devuelve al pedirle sugerencias. Es el arnés nº 2 del §13.1, que se mencionaba sin estar. Cerró §28                                                                                                                        |
| `extensions/mssql/test/unit/custom/quickSuggestions.test.ts`                   | Fija §29: que las sugerencias se abran solas al escribir, también con sugerencias en línea delante                                                                                                                                                           |
| `extensions/mssql/src/custom/connection/connectionSelector.ts`                 | El selector de servidor y base en la barra de estado (§30)                                                                                                                                                                                                   |
| `extensions/mssql/src/custom/results/referencedRow.ts`                         | Resuelve la clave ajena de una celda y lee la fila a la que apunta (§31)                                                                                                                                                                                     |
| `extensions/mssql/src/custom/results/foreignKeyLookup.ts`                      | Las tres consultas de §31, con sus reglas de entrecomillado                                                                                                                                                                                                  |
| `extensions/mssql/src/custom/webviews/ReferencedRow/referencedRowPopover.tsx`  | El globo que las enseña, anclado a la celda (§31.4)                                                                                                                                                                                                          |
| `extensions/mssql/test/unit/custom/referencedRow.test.ts`                      | Fija el texto que se manda al servidor: identificadores validados y valor parametrizado                                                                                                                                                                      |
| `extensions/mssql/src/custom/webviews/TableExplorer/pendingChangesButtons.tsx` | El par confirmar (verde) / descartar (rojo) de la barra del editor de datos (§32.2)                                                                                                                                                                          |
| `extensions/mssql/src/custom/webviews/TableExplorer/pendingChanges.ts`         | Qué filas hay que revertir para descartarlo todo, y en qué orden. Sin React, para que lo alcancen los unitarios (§32.3)                                                                                                                                      |
| `extensions/mssql/test/unit/custom/pendingChanges.test.ts`                     | Fija ese conjunto y ese orden: es lo único de §32 que se puede equivocar en silencio                                                                                                                                                                         |
| `extensions/mssql/src/custom/results/editQueryResults.ts`                      | Abre el editor de datos sobre la consulta que produjo unos resultados, si salen de una sola tabla (§33)                                                                                                                                                      |
| `extensions/mssql/src/custom/sharedInterfaces/editQueryResults.ts`             | Los tipos de esa petición, que la rejilla del upstream también importa                                                                                                                                                                                       |
| `extensions/mssql/test/unit/custom/editQueryResults.test.ts`                   | Fija de qué tabla salen unos resultados: pasarse de estricto deja fuera consultas editables, quedarse corto abre un editor que el servidor rechaza                                                                                                           |
| `FORK.md`                                                                      | Este archivo                                                                                                                                                                                                                                                 |

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

`extensions/mssql/src/` tenía, en la base de este inventario (`752692d`), **971 archivos
`.ts`/`.tsx`** repartidos en **51 carpetas** de primer nivel. No es un proyecto pequeño.

Tras el merge de M9 son **988 del upstream**, y **1069 en total** contando `src/custom/`, en 52
carpetas (la 52.ª es `custom/`, la nuestra). El upstream no creó ninguna carpeta de primer nivel:
`src/dab/` ya existía.

```bash
git ls-tree -r --name-only upstream/main -- extensions/mssql/src | grep -cE '\.tsx?$'
find extensions/mssql/src -maxdepth 1 -type d | tail -n +2 | wc -l
```

> **Corregido en M9:** aquí ponía «53 carpetas», y eran 51 ya entonces. El 971 sí era correcto para
> la base, y se conserva como tal porque el inventario describe ese punto.

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

Tres emisores. **Dos** comparten un punto de estrangulamiento muy limpio; el tercero no, y eso
estuvo mal escrito aquí hasta M9.

| Vía                     | Dónde                                                                                        | Cómo se corta                            |
| ----------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Eventos de la extensión | `extension-toolkit/vscode/telemetry/` (`sendActionEvent`, `sendErrorEvent`, `startActivity`) | `initializeTelemetryReporter(undefined)` |
| Eventos del STS         | notificación `telemetry/sqlevent` → `serviceclient.ts:551` los reenvía                       | el mismo reporter                        |
| Perf                    | `src/perf/perfTelemetry.ts` (`Perf.marker`, `Perf.flush`)                                    | **no pasa por el reporter**: ver abajo   |

> **Corregido en M9 (§26.6).** Esta tabla decía que `Perf` «pasa por el mismo reporter». Es falso:
> `Perf.marker` acaba en `diag.emit` (`src/diagnostics/diagnosticsCore.ts`) y solo sale del proceso
> si hay un **sink** registrado. El único del árbol es `PerfModeSink`, que manda por `http.request`
> (`src/diagnostics/sinks.ts:184`), no por Application Insights. `disableTelemetry()` no lo toca ni
> puede tocarlo.
>
> Lo que de verdad lo contiene es su propia puerta: el sink solo se registra si
> `PERF_MODE=1` **y** están puestas `PERF_MARKER_URL` y `PERF_CONTROL_TOKEN`
> (`perfTelemetry.ts:131-145`). Es el arnés local de `tools/perftest`. Se comprueba con:
>
> ```bash
> git grep -n "sendActionEvent\|sendErrorEvent\|startActivity" -- extensions/mssql/src/perf   # vacío
> git grep -n "addSink" -- extensions/mssql/src                                               # solo perfTelemetry.ts:144
> ```
>
> El error importaba: daba por cortado un camino que nadie estaba cortando. Ahora la invariante real
> —sin `PERF_MODE` no hay ningún sink— la fija `test/unit/custom/telemetryOverride.test.ts`.

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

Hoy hay **55 ajustes `mssql.format.options.*`** (56 contando `mssql.format.showParseErrorNotification`), servidos por el parser real de T-SQL
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

> **Corregido en §25 (M8).** De esa lista **se retiran tres cosas**, por decisión del usuario y por
> lo medido: el **perfil XML** (los perfiles viven en `sqlworks.format.profiles`, §25.2), el **test
> por opción** (probaría ScriptDom, que es código de Microsoft, §25.7) y las **opciones no
> soportadas deshabilitadas** (el panel se guía por el `package.json`, así que solo existen las que
> existen). Lo demás se entrega tal cual.

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

> **Matizado en M9, y hay una decisión pendiente.** Las razones 2 y 3 siguen siendo ciertas **del
> SQL Tools Service**, que es de lo que hablaba esta sección. Pero el merge de M9 trajo una función
> nueva del upstream (Data API Builder) con **una segunda descarga de red y un segundo consumidor de
> .NET**, y `--offline` no cubre ninguna de las dos:
>
> - `src/dab/dabCliTool.ts` se baja la CLI de Data API Builder (un `.nupkg`) de un feed NuGet
>   —`https://api.nuget.org/v3-flatcontainer` por omisión, `src/sharedInterfaces/dab.ts`— y ejecuta
>   lo que desempaqueta con `spawn(..., {detached: true})`, o sea que el proceso sobrevive a cerrar
>   VS Code. **No hay comprobación de firma ni de hash.**
> - El feed no es fijo: `src/dab/dabNuGetFeed.ts` recorre los `NuGet.Config` de la carpeta abierta y
>   de todos sus directorios padre, y gana la primera fuente que conteste. Es decir, **el repositorio
>   que tengas abierto puede decidir de dónde sale el binario**, y la extensión se declara compatible
>   con espacios de trabajo no confiables.
> - `src/dab/dabCliRunner.ts` resuelve el runtime con `DotnetRuntimeProvider`, que pide
>   `ms-dotnettools.vscode-dotnet-runtime` —la extensión que la razón 3 dice que quitamos— con caída
>   a un `dotnet` del `PATH`.
>
> **Hoy nada de esto se alcanza**, y está medido: el camino cuelga del destino de despliegue «DAB
> CLI», que solo se pinta si `mssql.schemaDesigner.enableDeploymentsView` está activo, y
> `isDeploymentsViewEnabled()` hace `!!get<boolean>(...)` sobre un ajuste **que el upstream no
> declara en su `package.json`**. Sin declarar, vale `undefined`, y la función queda apagada.
>
> Lo incómodo es de dónde viene ese apagado: **es un descuido del upstream, no una decisión
> nuestra**, y un `settings.json` de repositorio puede encenderlo. La recomendación y las opciones
> están en §26.8, pendientes de decisión del usuario.

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

> **Corregido en §23.5 (M6).** La última fila es falsa: ese controlador **no** tiene comando y solo
> salta cuando falla una conexión por contraseña caducada (`connectionManager.ts:1984`). Es el flujo
> de recuperación de tu propia contraseña, no una operación de administrador sobre otro login, así que
> restablecer la de un tercero sigue siendo trabajo propio. Las tres filas de bases de datos **sí**
> son correctas, y por eso M6 no las reimplementa (§23.4).

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
`ventas_lectores` con `GRANT SELECT` de esquema, y un **`DENY` a nivel de columna**
(`ventas.Cliente`, columna `Email`).

Para M4 se añadió una **cadena de herencia de dos saltos**, que es lo que la matriz de permisos
tiene que resolver:

```
analista  →  ventas_supervisores  →  ventas_lectores
                  INSERT en ventas        SELECT en ventas
```

`ventas_supervisores` es un rol **miembro de otro rol**, y `analista` es un usuario sin login
(`CREATE USER analista WITHOUT LOGIN`), que además comprueba la columna «sin login» de la sección de
usuarios.

Dos arneses distintos:

1. **La suite e2e del upstream** (`npx playwright test`, VS Code real bajo `xvfb`), que cubre
   la interfaz. Requiere `extensions/mssql/test/e2e/.env` (está en `.gitignore`, así que la
   contraseña no entra al repositorio).
2. **Un arnés JSON-RPC contra el STS** para lo que la suite del upstream no cubre. Habla
   directamente con `sqltoolsservice/<versión>/Linux/MicrosoftSqlToolsServiceLayer` usando los
   mismos contratos que la extensión. Verifica el motor sin depender de la interfaz.

### 13.2. Resultado sobre el fork sin modificar (commit `752692d`)

| #   | Comprobación                                                          | Estado | Evidencia                                                                               |
| --- | --------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| 1   | Conectar con autenticación SQL                                        | ✅     | e2e `connection.spec.ts` + arnés: SQL Server 16.0.4295.3, Developer Edition             |
| 1b  | Conectar con autenticación integrada                                  | ❌     | **No verificable aquí**: requiere un dominio Kerberos (KDC, SPN y ticket)               |
| 2   | Explorador: servidor, base, tablas, vistas, procedimientos, seguridad | ✅     | arnés: árbol completo expandido, incluidas columnas con tipo y PK                       |
| 3   | IntelliSense sugiere tablas y columnas reales                         | ✅     | arnés: `ventas.` → `Cliente`, `Pedido`, `vPedidoCliente`                                |
| 4   | Ejecutar consulta: resultados, mensajes, varios conjuntos             | ✅     | arnés: 2 conjuntos + 3 mensajes (`PRINT` y los dos «rows affected»)                     |
| 5   | Exportar a CSV y a JSON                                               | ✅     | arnés: `query/saveCsv` y `query/saveJson`, contenido comprobado                         |
| 6   | Script as Create sobre tabla y sobre procedimiento                    | ✅     | arnés: `CREATE TABLE [ventas].[Cliente]` y `CREATE PROCEDURE [ventas].[ObtenerPedidos]` |
| 7   | Plan de ejecución estimado                                            | ✅     | e2e `executionPlan.spec.ts`: 12 tests (zoom, tooltips, propiedades, XML, buscar nodo)   |
| 8   | Historial de consultas                                                | ✅     | 10 tests unitarios del upstream + **interfaz comprobada por el usuario en Windows**     |

**De los nueve puntos, siete se verificaron desde aquí contra una instancia real, el usuario cerró
el octavo, y uno sigue abierto.** El punto 8 lo comprobó **el usuario en su máquina Windows**: aquí
solo había cobertura unitaria, porque el historial es una vista de `TreeDataProvider` que no pasa
por el STS y el arnés no la alcanza. Se anota como lo que es —una comprobación suya, no una medida
de este entorno— y con eso la fila deja de estar en ⚠️.

Un detalle que juega a favor: esta tabla está acotada al fork **sin modificar** (`752692d`), pero
esa comprobación se hizo sobre el `.vsix` ya renombrado y empaquetado. Es evidencia **más** fuerte
que la que pedía la fila, no menos: dice que el historial sigue funcionando _después_ de los
cambios del fork, no solo antes.

Queda un hueco, y es el mismo de siempre:

- **Autenticación integrada (1b)** sigue sin verificar: requiere un **dominio Kerberos** —un KDC
  alcanzable, un SPN registrado para la instancia y un ticket—, así que es un hueco estructural de
  este entorno y no un fallo conocido del fork. Es **lo único de la lista de paridad que nadie ha
  ejercitado todavía**, y conviene no perderlo de vista: el renombrado de M1 cambió el identificador
  de la extensión en cuatro archivos (§15.6), que es justo el tipo de cambio capaz de romper una ruta
  de autenticación sin que ningún test de aquí lo note. Hasta que alguien la pruebe en un dominio, la
  paridad del fork es de ocho sobre nueve, no completa.

    > **Corregido en M9.** Antes aquí ponía «requiere Windows». No es exacto, y el propio upstream lo
    > desmiente: `extensions/mssql/KERBEROS_HELP.md` explica cómo usar autenticación integrada **desde
    > macOS y Linux** con un ticket de Kerberos. Lo que falta en este entorno es el dominio, no el
    > sistema operativo. La distinción importa porque cambia quién puede cerrar la fila: no hace falta
    > una máquina Windows, hace falta acceso a un dominio.
    >
    > Y el merge de M9 tocó justo esta ruta: el upstream reescribió `KERBEROS_HELP.md` (+200 líneas),
    > añadió un botón «Learn more» al error de Kerberos fuera de Windows y un tooltip en el desplegable
    > de autenticación **solo visible en macOS y Linux** (`formComponentHelpers.ts:288`, con
    > `requiresKerberos = process.platform === "darwin" || "linux"`). Para las máquinas Windows a las
    > que va este fork, ese código es inerte; el resto del cambio es texto de ayuda. No mueve la fila,
    > pero explica por qué 1b aparece en el diff de M9 (§26.4).

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
`src/connectionconfig/formComponentHelpers.ts:303` lo declara `FormItemType.Combobox` con
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

- **Dos** de los tres emisores del upstream (extensión y relé de `telemetry/sqlevent` del STS)
  comparten un único `telemetryReporter` del extension-toolkit. Basta con dejarlo sin transporte.
  El tercero, `Perf`, **no pasa por ahí**: es un canal aparte con su propia puerta de variables de
  entorno (§6 y §26.6). Hasta M9 aquí ponía «los tres», que era falso.
- Cortar en el reporter, y no evento a evento, es lo que hace que el corte **sobreviva a los
  merges**: los puntos de entrada leen el enlace de módulo en cada llamada. Medido en M9, donde el
  upstream trajo tres `sendActionEvent` nuevos y quedaron cortados sin tocar nada (§26.6).
- Se cierran **las dos** vías de entrada de la clave: `package.json` → `aiKey`, y la variable de
  entorno `MSSQL_APP_INSIGHTS_KEY` que el constructor del reporter consulta como respaldo.
- El reporter queda sin transporte porque el constructor de `@vscode/extension-telemetry` **lanza**
  con `undefined` y el `try/catch` del toolkit se lo traga. El aviso `Error initializing
TelemetryReporter:` de la consola **es** el corte, no ruido: silenciarlo con una clave de relleno
  lo reabriría.
- `test/unit/custom/telemetryOverride.test.ts` lo fija, para que un merge no lo
  revierta en silencio, e incluye la invariante de `Perf` (sin `PERF_MODE`, ningún sink).
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
| El `.vsix` de `win-x64` instalado **en Windows de verdad** | ✅ **comprobado por el usuario**: se construye, instala y arranca              |

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
    serverSecurityService.ts  (M3) una lectura por sección, con su propio error
    sql/                    todo el T-SQL, y solo aquí
      types.ts              (M3) tipos del dominio, sin imports
      rows.ts               (M3) acceso por nombre de columna a SimpleExecuteResult
      execute.ts            (M3) query/simpleexecute, con run() y tryRun()
      queries/              (M3) una consulta + su mapeador por archivo
  util/
    connectionTarget.ts     resuelve un nodo del árbol → servidor y base
  overrides/                modificaciones a lo existente
    telemetry.ts
  webviews/                 TODO el React del fork (solo en tsconfig.webviews)
    index.tsx               router de vistas
    strings.ts              textos de los webviews
    common/
      panelShell.tsx        estructura común de paneles (§14 del brief)
      propertyList.tsx      (M3) bloques de propiedades etiqueta/valor
      dataTable.tsx         (M3) rejilla de solo lectura sobre DataGrid
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
`src/connectionconfig/formComponentHelpers.ts:303` lo declara `FormItemType.Combobox` con
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

---

## 18. El API Object Management del STS: sondeo antes de M3

> **Corregido en §22.5 (M5).** Este sondeo se hizo antes de M3 y su conclusión —el plan híbrido de
> §18.6— **no** es lo que el fork hace. En resumen: `objectManagement/script` devuelve la contraseña
> en claro para un login, y `save` ejecuta fuera de nuestra transacción y responde de forma
> asíncrona, así que ninguno de los dos sirve para cumplir las reglas 11.3 y 11.6. M5 escribe su
> propio DDL. Lo que sigue vigente es `initializeView` para el detalle de un objeto y el diagnóstico
> de que los listados necesitan T-SQL propio.

Pregunta que se planteó en M0 (§11.6): ¿soporta el SQL Tools Service los tipos de objeto de
seguridad? Si los soporta, M5 puede pedirle a él el script en lugar de que generemos nuestro
propio DDL. **Verificado contra SQL Server 2022 real**, con un arnés JSON-RPC.

### 18.1. Tipos soportados

`objectManagement/initializeView` con `isNewObject: true`:

| `objectType`            | Soportado | Campos que devuelve                                                                                                                                                                                                                                                                                    |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ServerLevelLogin`      | ✅        | `name`, `authenticationType`, `isEnabled`, `isLockedOut`, `mustChangePassword`, `enforcePasswordPolicy`, `enforcePasswordExpiration`, `password`, `oldPassword`, `defaultDatabase`, `defaultLanguage`, `connectPermission`, `windowsGrantAccess`, `serverRoles`, `userMapping`, `securablePermissions` |
| `ServerLevelServerRole` | ✅        | `name`, `owner`, `members`, `memberships`, `securablePermissions`                                                                                                                                                                                                                                      |
| `User`                  | ✅        | `name`, `type`, `loginName`, `password`, `defaultSchema`, `ownedSchemas`, `databaseRoles`, `defaultLanguage`, `securablePermissions`                                                                                                                                                                   |
| `DatabaseRole`          | ✅        | `name`, `owner`, `ownedSchemas`, `members`, `extendedProperties`, `securablePermissions`                                                                                                                                                                                                               |
| `ApplicationRole`       | ✅        | `name`, `defaultSchema`, `password`, `ownedSchemas`, `securablePermissions`                                                                                                                                                                                                                            |
| `Database`              | ✅        | `owner`, `collationName`, `recoveryModel`, `compatibilityLevel`, `containmentType`, `sizeInMb`, `spaceAvailableInMb`, `status`, `numberOfUsers`, `dateCreated`, `lastDatabaseBackup`, y más                                                                                                            |
| `ServerRole`            | ✅        | igual que `ServerLevelServerRole`, es un alias                                                                                                                                                                                                                                                         |
| `ServerLevelCredential` | ❌        | error de parseo en el propio STS                                                                                                                                                                                                                                                                       |
| `Table`                 | ❌        | «This operation is not supported for this object type»                                                                                                                                                                                                                                                 |
| `Login`                 | ❌        | no es un nombre válido: hay que usar `ServerLevelLogin`                                                                                                                                                                                                                                                |

Esto cubre **todo lo que piden los §8.1, §8.2, §8.3 y §9 del brief**, salvo esquemas, sesiones
activas y propiedades de la instancia.

### 18.2. Leer objetos existentes: el URN sale del explorador

Los nodos del explorador de objetos traen su URN de SMO en `metadata.urn`:

```json
{
    "nodePath": "localhost,1433/Security/Logins/parity_user",
    "nodeType": "ServerLevelLogin",
    "metadata": {
        "metadataTypeName": "Login",
        "name": "parity_user",
        "urn": "Server[@Name='a41e603be4a3']/Login[@Name='parity_user']"
    }
}
```

Ese valor es el `objectUrn` de `initializeView` con `isNewObject: false`. Encadenando
**nodo del árbol → URN → objeto completo** se lee un login o un usuario existente sin escribir
una línea de T-SQL. Comprobado con `parity_user`: devolvió `isEnabled: true`,
`enforcePasswordPolicy: true`, `defaultDatabase: "master"`, `serverRoles: ["dbcreator","public"]`,
y el usuario de base con `type: "LoginMapped"`, `defaultSchema: "ventas"`,
`databaseRoles: ["ventas_lectores"]`.

**La contraseña viene enmascarada** (`"***************"`), así que la regla 11.3 del brief la
cumple el propio STS.

### 18.3. `objectManagement/script` devuelve DDL sin ejecutar

> **Corregido en §22.5:** para un **login** ese script lleva la contraseña **en claro**. El texto de
> abajo la muestra vacía solo porque la sonda creó el login con una contraseña vacía. Mostrarlo en un
> diálogo o dejarlo pasar por el registro viola la regla 11.3, así que el fork no usa `script` para
> logins.

```
USE [master] GO CREATE LOGIN [sqlworks_probe] WITH PASSWORD=N'' MUST_CHANGE, DEFAULT_DATABASE=[master], …
USE [ParityDb] GO CREATE USER [sqlworks_probe] GO
USE [master] GO CREATE SERVER ROLE [sqlworks_probe] GO
USE [ParityDb] GO CREATE ROLE [sqlworks_probe] GO
```

Es exactamente la regla 11.1 del brief («nunca ejecutes DDL sin mostrar antes el script»),
implementada por el upstream. Y como el DDL lo genera SMO, los identificadores vienen ya
entrecomillados: desaparece el riesgo de inyección por identificador en la ruta de edición.

### 18.4. Forma de `securablePermissions`

```json
[
    {
        "name": "Cliente",
        "schema": "ventas",
        "type": "Table",
        "effectivePermissions": [],
        "permissions": [
            { "permission": "Select", "grantor": "dbo", "grant": null, "withGrant": null },
            { "permission": "Insert", "grantor": "", "grant": null, "withGrant": null }
        ]
    }
]
```

Un elemento por securable, con sus permisos y `grant` en tres estados (`true`, `false`, `null`).
Encaja bien con el `PermissionMatrix` del §9 del brief.

**Aviso, y hay que verificarlo en M4:** en la prueba, `parity_user` tiene `SELECT` sobre el
esquema `ventas` **heredado del rol** `ventas_lectores`, y `effectivePermissions` volvió **vacío**
para la tabla. Si ese campo no resuelve la herencia, el estado «heredado de rol» de la matriz hay
que calcularlo nosotros combinando permisos explícitos y pertenencia a roles, como ya prevé el
§10 del brief. No se da por bueno hasta comprobarlo.

> **Comprobado en M4: el aviso era correcto.** `effectivePermissions` no resuelve la herencia, así
> que la matriz la calcula por su cuenta (§21, `sharedInterfaces/permissionMatrix.ts`).

### 18.5. Lo que el API **no** da, y sigue necesitando T-SQL propio

1. **Listados.** `initializeView` es un objeto por llamada. Para una rejilla de 200 logins serían
   200 idas y vueltas. Las consultas del §10 del brief traen la tabla entera en un viaje, con
   exactamente las columnas que muestra el panel.
2. **Sesiones activas** (§8.5) y **propiedades de la instancia** (§8.4): collation, modo de
   autenticación, rutas de datos y log, memoria configurada, fecha de arranque. No son tipos de
   objeto.
3. **Esquemas con su propietario** (§8.3.3).
4. **Matriz de permisos agregada** por principal y acción: `securablePermissions` viene por
   objeto, no en forma de matriz.

### 18.6. Plan que sale de esto

> **Sin efecto desde M5. Ver §22.5.** El plan de abajo daba por ahorrados los generadores de DDL
> usando `objectManagement/script` + `/save`. No se puede: `save` ejecuta **fuera** de nuestra
> transacción y responde de forma asíncrona, así que no hay forma de envolverlo en el lote de la
> regla 11.6 ni de saber qué quedó aplicado, y `drop`/`rename` ejecutan de inmediato sin vista
> previa. M5 escribe su propio DDL en `src/custom/admin/sql/ddl/`, con generadores puros y tests,
> que es lo que el §9 del brief pedía desde el principio. **La tabla que sigue queda como registro
> de lo que se pensó, no de lo que se hizo.**

**Híbrido, y reduce M5 de forma importante:**

| Para                                           | Se usa                                                    |
| ---------------------------------------------- | --------------------------------------------------------- |
| Listados y rejillas de solo lectura (M3, M4)   | Nuestro T-SQL del §10, en `src/custom/admin/sql/queries/` |
| Sesiones, propiedades de instancia, esquemas   | Ídem                                                      |
| Detalle de un objeto (M3, M4)                  | `objectManagement/initializeView` con el URN del árbol    |
| **Crear, modificar y generar script** (M5, M6) | `objectManagement/script` + `/save`                       |

Lo que esto **ahorra**: escribir y probar generadores de DDL para `CREATE`/`ALTER` de login,
usuario, roles y sus pertenencias. El §9 del brief los pedía como funciones puras con tests; con
el API dejan de hacer falta para esos casos.

Lo que **sigue en pie**:

- `src/custom/util/identifiers.ts` con su validación y sus tests (§11.2). Hace falta para el
  T-SQL que sí escribimos, y para validar nombres antes de mandarlos al API.
- La transacción explícita con `SET XACT_ABORT ON` y el rollback (§11.6) para **nuestros** lotes:
  `GRANT`/`DENY`/`REVOKE`, `DROP LOGIN`, `DROP USER`, `DROP DATABASE`. `objectManagement/save`
  ejecuta a su manera y no lo controlamos.
- Las confirmaciones escribiendo el nombre del objeto (§11.5) y el aviso de producción (§11.4).
- Mostrar el script antes de ejecutar, venga del API o de nosotros.

---

## 19. Seguridad del servidor en solo lectura (M3)

El hito pide leer y mostrar logins, roles de servidor, permisos de servidor, propiedades de la
instancia y sesiones activas. **Ni una sentencia que modifique nada**: las siete consultas son
`SELECT`.

### 19.1. Cuatro capas, y la frontera entre ellas

```
queries/<tema>.ts        SQL literal (constante)  +  mapeador puro
rows.ts                  SimpleExecuteResult → acceso por nombre de columna
execute.ts               query/simpleexecute sobre la conexión ya abierta
serverSecurityService.ts una lectura por sección, cada una con su propio error
webviews/AdminPanel/     una vista por sección, sin lógica de datos
```

El corte importante está entre las dos primeras: **el mapeador es una función pura** que recibe un
`SimpleExecuteResult` y devuelve tipos del dominio. Por eso los 28 tests de M3 no necesitan
servidor ni mocks del STS, solo literales de filas. El §10 del brief pedía exactamente esto.

Las siete consultas:

| Constante                 | Archivo                         | Vistas del sistema                                                | Permiso                             |
| ------------------------- | ------------------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `LOGINS_SQL`              | `queries/logins.ts`             | `sys.server_principals`, `sys.sql_logins`                         | ninguno especial                    |
| `SERVER_ROLES_SQL`        | `queries/serverRoles.ts`        | `sys.server_principals` (autojoin por propietario)                | ninguno especial                    |
| `SERVER_ROLE_MEMBERS_SQL` | `queries/serverRoles.ts`        | `sys.server_role_members`                                         | ninguno especial                    |
| `SERVER_PERMISSIONS_SQL`  | `queries/serverPermissions.ts`  | `sys.server_permissions`, `sys.endpoints`                         | ninguno especial                    |
| `INSTANCE_PROPERTIES_SQL` | `queries/instanceProperties.ts` | `SERVERPROPERTY(...)`, `sys.configurations`                       | ninguno especial                    |
| `INSTANCE_RUNTIME_SQL`    | `queries/instanceProperties.ts` | `sys.dm_os_sys_info`                                              | **`VIEW SERVER STATE`**             |
| `ACTIVE_SESSIONS_SQL`     | `queries/sessions.ts`           | `sys.dm_exec_sessions`, `dm_exec_connections`, `dm_exec_sql_text` | **`VIEW SERVER STATE`** (ver §19.5) |

`SERVER_ROLE_MEMBERS_SQL` se usa dos veces, con dos mapeadores distintos: `mapServerRoleMembership`
la invierte a «miembro → roles» para la columna de roles de la rejilla de logins, y `mapMembersByRole`
la deja como «rol → miembros» para la de roles. Una consulta, dos lecturas, cero duplicación de SQL.

### 19.2. Cero interpolación: por qué `identifiers.ts` aún no aparece

Las siete constantes son **texto literal sin una sola sustitución**. Nada que venga del usuario, del
árbol de objetos ni del perfil de conexión entra en el SQL de M3. Se audita así:

```bash
git grep -n '\${' -- extensions/mssql/src/custom/admin/sql/queries
```

La única coincidencia está en un texto que se muestra (`Desconocida (${engineEdition})`), no en una
consulta.

Por eso `src/custom/util/identifiers.ts` y su validación (regla 11.2 del brief) **todavía no
existen**: no hay ningún identificador que validar. La primera consulta que reciba un nombre
—`USE [<base>]` en M4— es la que lo estrena, y entonces se escriben la función y sus tests de
corchete de cierre, comilla simple, punto y coma y doble guión. Adelantarlo ahora sería código sin
uso, y el brief prohíbe refactorizar más allá del hito en curso (§16.7).

### 19.3. Acceso por nombre de columna, no por índice

`SimpleExecuteResult` devuelve `rows: DbCellValue[][]`, es decir índices. Un mapeador escrito contra
índices se rompe en silencio en cuanto alguien añade una columna a la mitad de la consulta y todos
los valores se corren un puesto.

`rows.ts` construye un índice `nombre → posición` a partir de `columnInfo` y expone
`text`, `optionalText`, `number` y `boolean`. Dos detalles:

- **El índice va en minúsculas.** Los nombres de columna de T-SQL no distinguen mayúsculas, y el
  mapeador no tiene por qué recordar si la consulta escribió `is_disabled` o `Is_Disabled`.
- **Pedir una columna que no existe lanza, y el mensaje la nombra.** Si el fallo fuese silencioso
  (`undefined` → `""`), una columna mal escrita saldría como una celda vacía en producción en lugar
  de reventar el test.

`NULL` se convierte a `""` en `text()` y a `undefined` en `optionalText()`: el panel distingue «el
login no tiene base por defecto» de «el login tiene una base llamada cadena vacía».

### 19.4. Lo que cambió al correr las consultas contra un servidor de verdad

Las siete se ejecutaron contra la instancia SQL Server 2022 del §13.1 antes de dar el hito por
bueno. Tres errores que ningún test unitario habría encontrado:

1. **Roles internos en la rejilla.** `sys.server_principals` devuelve los roles `##MS_...##` que SQL
   Server crea para firmar procedimientos del sistema. SSMS no los muestra. Añadido
   `AND r.name NOT LIKE '##%'`, y el test e2e comprueba que no aparece ninguno.
2. **Un entero mostrado como zona horaria.** Había mapeado `sys.dm_os_sys_info.time_source` a un
   campo `timeZone`; es un entero (`0` = `QueryPerformanceCounter`), no una zona horaria. Se quitó
   de la consulta, del tipo y del mapeador: mejor no mostrar el dato que mostrarlo mal.
3. **Sentencias con salto de línea y sangría al principio.** `sys.dm_exec_sql_text` devuelve el
   texto tal cual lo mandó el cliente, así que la columna de última sentencia empezaba en blanco.
   `.trim()` en el mapeador, con su test.
4. **Cuatro filas «public · CONNECT · Concedido» idénticas.** `public` tiene `CONNECT` concedido
   sobre los cuatro puntos de conexión de fábrica (`TSQL Default TCP`, `Default VIA`,
   `Local Machine`, `Named Pipes`), y la consulta no traía el objeto sobre el que cae el permiso:
   se veían cuatro filas repetidas sin explicación, y la clave de fila
   (`principal::permiso::estado`) se repetía. Ahora la consulta resuelve el objeto según la clase
   (100 `SERVER`, 101 `SERVER_PRINCIPAL` para `IMPERSONATE`, 105 `ENDPOINT`), el panel lo muestra
   en su propia columna y la clave de fila lo incluye.

### 19.5. Degradación parcial, nunca el panel en blanco

Cada sección se lee por separado y guarda su propio error, y dentro de una sección los datos
opcionales se piden con `tryRun`. Un login sin `VIEW SERVER STATE` ve logins, roles y permisos
completos, y pierde solo lo que ese permiso protege.

El caso que obliga a un aviso propio: **cuando falta `VIEW SERVER STATE`, la consulta de sesiones no
da error**. El motor devuelve solo la sesión del propio usuario. Sin explicarlo, el panel diría que
el servidor no tiene a nadie conectado. `looksLikeMissingViewServerState()` detecta la forma de ese
caso —una sola fila, y es la nuestra— y la vista muestra un `MessageBar` de aviso.

Lo mismo con la pertenencia a roles en la rejilla de logins: si esa segunda consulta falla, los
logins se muestran igual, con la columna de roles vacía.

### 19.6. Carga perezosa, por sección

Abrir el panel ejecuta **cero consultas**. Cada pestaña se lee al abrirla, la primera vez; volver a
una ya leída no vuelve a consultar; «Actualizar» recarga **solo la sección visible**. La razón es la
del §11 del brief: esto apunta a servidores de producción, y abrir una pestaña no debe disparar
cinco consultas contra uno.

El estado por sección es `idle → loading → loaded | error`, con `readAt` en el caso `loaded`. La
cabecera muestra ese sello de la sección activa, así que se ve **de cuándo son los datos** en
pantalla en lugar de suponer que son de ahora.

`loadSection` comprueba `this.isDisposed` después del `await`: cerrar el panel mientras una consulta
está en vuelo no debe escribir en un estado que ya no existe.

### 19.7. Interfaz: dos densidades, y el porqué

El §14 del brief fija filas de 44 px. Se aplica en `dataTable.tsx`, que es donde van **filas de
datos**: seleccionables y con acciones a partir de M5. El bloque de propiedades de la instancia no
son filas de datos sino pares etiqueta/valor, y a 44 px la ficha quedaba desparramada; va a 32 px en
`propertyList.tsx`, con tarjeta con borde, cabeceras de sección y separadores de 1 px. La desviación
está anotada en el propio archivo.

`dataTable.tsx` es un envoltorio del `DataGrid` de Fluent, el mismo componente que el upstream usa
para tablas que no son resultados de consulta. No se usa `FluentSlickGrid`: ese es para la rejilla de
resultados, con virtualización, y pesa más de lo que estas listas necesitan.

Tres decisiones que salieron de mirar el panel funcionando, midiéndolo en el navegador:

- **Anchos por columna.** `DataGrid` reparte el ancho a partes iguales, así que
  `NT AUTHORITY\NETWORK SERVICE` salía recortado mientras la columna de un `1` sobraba espacio. Cada
  vista pasa su `columnSizing` con mínimo y ancho por defecto, y la rejilla queda redimensionable.
- **El borde va fuera del elemento que desplaza.** `DataGrid` reparte los anchos según la caja de su
  contenedor, borde incluido, así que con el borde en el mismo `div` que hace scroll la tabla salía
  2 px más ancha que el hueco (1240 contra 1238, medido) y aparecía una barra de desplazamiento
  horizontal aunque todo cupiera. Tarjeta fuera, desplazamiento dentro: las rejillas que caben ya no
  la muestran, y la de sesiones —diez columnas, 1480 px— sí, que es lo correcto.
- **Buscador sin acentos.** Filtra en minúsculas y sin diacríticos, así que «administracion»
  encuentra «Administración».

Marcas visuales del §14: `sysadmin` y `securityadmin` llevan insignia de peligro, `DENY` sale en
color de peligro frente al verde de `GRANT`, y la sesión propia va marcada «Esta sesión».

### 19.8. Verificación de M3

| Comprobación                       | Resultado                                                            |
| ---------------------------------- | -------------------------------------------------------------------- |
| `npm run build -- --target mssql`  | ✅                                                                   |
| `npm run lint -- --target mssql`   | ✅                                                                   |
| `npm test -- --target mssql`       | ✅ **5148 pasan, 0 fallan** (4943 + 205 de `sql-database-projects`)  |
| Tests propios de M3                | ✅ 29 de los mapeadores, sin servidor ni mocks del STS               |
| Las siete consultas                | ✅ ejecutadas contra SQL Server 2022 real (§19.4)                    |
| Las cinco secciones en la interfaz | ✅ `test/e2e/sqlworksAdminPanel.spec.ts`, un recorrido por las cinco |

Lo que comprueba el e2e con datos reales sembrados en §13.1, no con dobles:

- **Logins**: `parity_user` existe, sale como «Login SQL» y con el rol `dbcreator`; `sa` existe;
  `BUILTIN\Administrators` sale como «Grupo de Windows».
- **Roles de servidor**: `sysadmin` y `public` presentes, y **cero** filas `##MS_`.
- **Permisos**: `CONNECT SQL` con estado «Concedido», y el objeto resuelto
  («Punto de conexión: TSQL …»).
- **Instancia**: `SQL_Latin1_General_CP1_CI_AS`, `Developer Edition (64-bit)`, autenticación en
  «modo mixto».
- **Sesiones**: la sesión propia marcada «Esta sesión», sobre `ParityDb`.
- **Buscador**: filtrando por `parity` queda `parity_user` y desaparece `sa`.

### 19.9. Lo que M3 deliberadamente no hace

- **No escribe.** No hay DDL, ni edición, ni `objectManagement/save`. Eso es M5, con vista previa
  del script, confirmación y transacción explícita.
- **No baja a la base de datos.** Usuarios, roles de base, esquemas y la matriz de permisos son M4.
- **No resuelve permisos heredados.** La duda del §18.4 —si `effectivePermissions` resuelve la
  herencia por rol— sigue abierta y se comprueba en M4. M3 muestra solo permisos **explícitos** de
  servidor, que es lo que devuelve `sys.server_permissions`, y la leyenda de la rejilla lo dice.

---

## 20. Bloqueos y terminación de sesiones (añadido a M3)

Dos añadidos pedidos sobre la sección de sesiones: **cuánto lleva abierta la transacción más
antigua** de cada sesión, para encontrar al que bloquea, y un **botón para terminar** esa sesión.
Esto último es la **primera operación del fork que escribe en el servidor**, así que aquí está todo
lo que la rodea.

### 20.1. El tiempo de la transacción, no el número

`sys.dm_exec_sessions.open_transaction_count` dice cuántas transacciones tiene abiertas una sesión,
pero no desde cuándo, y para cazar un bloqueo lo que importa es el tiempo. Sale de
`dm_tran_session_transactions` cruzada con `dm_tran_active_transactions`, con `MIN(...)` sobre
`transaction_begin_time`: **una sesión puede tener varias transacciones abiertas a la vez**, y la que
está bloqueando al resto es la más antigua.

La rejilla pasa a ordenarse por ese valor, así que quien abre el panel buscando un bloqueo lo
encuentra en la primera fila. La duración se pinta con `formatSeconds` (`4 s`, `3 min 20 s`,
`2 h 5 min`), y el momento exacto va en el tooltip porque una transacción puede llevar abierta días.

### 20.2. Lo que dijo el servidor, y lo que cambió el diseño

Comprobado contra SQL Server 2022 antes de escribir la interfaz:

| Prueba                                   | Resultado del motor                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `KILL` dentro de `BEGIN TRANSACTION`     | **Error 6115**: «KILL command cannot be used inside user transactions»    |
| `KILL` de la propia sesión               | **Error 6104**: «Cannot use KILL to kill your own process»                |
| `KILL` sin permiso (como `parity_user`)  | **Error 6102**: «User does not have permission to use the KILL statement» |
| `KILL` de un identificador que no existe | **Error 6106**: «Process ID 9999 is not an active process ID»             |
| Permisos de `sa`                         | `sysadmin`, `processadmin` y `ALTER ANY CONNECTION`: los tres a 1         |
| Permisos de `parity_user` (`dbcreator`)  | los tres a 0                                                              |

Dos consecuencias de diseño, no cosméticas:

1. **El `KILL` va suelto, sin transacción.** El §11.6 del brief pide transacción explícita con
   `SET XACT_ABORT ON` para los lotes; este es exactamente el caso que el propio brief exceptúa
   («las sentencias que SQL Server no permite dentro de una transacción van aparte y se marcan como
   irreversibles en la vista previa»). El diálogo lo dice con esas palabras.
2. **Los identificadores de sesión se reutilizan de inmediato.** Al terminar la sesión 54, la
   conexión siguiente del propio sondeo recibió el 54. Un panel abierto un rato puede tener en
   pantalla un número que ya es de otra conexión, así que antes de ejecutar se vuelve a leer la
   sesión y se compara su identidad (identificador, momento de inicio de sesión, login y equipo). Si
   no coincide, **no se termina nada**: se avisa y se recarga la lista.

### 20.3. La cadena de comprobaciones antes de escribir

Por orden, en `AdminPanelController.killSession`:

1. La fila tiene que seguir en el estado del panel.
2. **Se releen los permisos en el momento**, sin fiarse de lo leído al abrir la sección: un cambio de
   rol en el servidor no avisa al panel. Si no se pueden leer, no se ejecuta nada.
3. No se permite terminar la sesión del propio panel (el motor daría el 6104).
4. Se comprueba que el identificador siga siendo de la misma sesión (§20.2).
5. **Diálogo modal con la identidad de la sesión, el aviso de la transacción abierta y la sentencia
   exacta**, con el número en el botón para que no se confirme a ciegas (regla 11.1 del brief).
6. Solo entonces se ejecuta, y siempre se recarga la lista después.

El permiso se lee con `HAS_PERMS_BY_NAME(NULL, NULL, 'ALTER ANY CONNECTION')`, que ya devuelve 1
para `sysadmin` y `processadmin`. Los dos roles se leen además por separado para poder decir **de
dónde** sale el permiso en el tooltip del botón, en lugar de un «no tienes permiso» a secas.

### 20.4. Dónde vive lo que escribe

- `src/custom/admin/sql/queries/killSession.ts`: la sentencia, la consulta de permisos, la de
  identidad y las funciones puras que las mapean y comparan.
- `src/custom/admin/sessionAdminService.ts`: **el único archivo del fork que ejecuta algo que no es
  un `SELECT`**. No pregunta ni confirma: eso es del controlador. Está aislado a propósito para que
  auditar «qué escribe el fork» sea leer un archivo.
- `src/custom/sharedInterfaces/duration.ts`: el formato de duraciones, compartido host ↔ webview.
  Va en esa carpeta porque ya está en los dos `tsconfig`, así que **no costó ninguna línea del
  upstream**; el propio upstream pone funciones puras ahí (`queryResultCellCodec.ts`,
  `selectionSummary.ts`).

### 20.5. `identifiers.ts`: por qué sigue sin existir, y qué lo sustituye aquí

`KILL` no acepta parámetros, así que el identificador se concatena: es el primer sitio del fork
donde algo de fuera entra en una sentencia. La regla 11.2 del brief se cumple **validando y
abortando**, nunca escapando: `assertSessionId` exige un entero positivo seguro y lanza con
cualquier otra cosa. Los tests pasan `"78; DROP DATABASE Ventas"`, `"1 OR 1=1"`, `1.5`, `0`, `-1`,
`NaN`, `null` y `{}`, y todos abortan.

Sigue sin hacer falta `src/custom/util/identifiers.ts` porque aquí no hay **ningún identificador**:
hay un número. El validador de identificadores con `QUOTENAME` llega con la primera consulta que
reciba un nombre, que es M4.

### 20.6. Verificación

| Comprobación                        | Resultado                                                               |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `npm run build -- --target mssql`   | ✅                                                                      |
| `npm run lint -- --target mssql`    | ✅                                                                      |
| `npm test -- --target mssql`        | ✅ **5169 pasan, 0 fallan** (4964 + 205 de `sql-database-projects`)     |
| Tests propios nuevos                | ✅ 12 de la sentencia y los permisos, 7 del flujo completo, 2 del mapeo |
| Semántica de `KILL` en el motor     | ✅ los cinco casos del §20.2, contra SQL Server 2022                    |
| Interfaz                            | ✅ en `test/e2e/sqlworksAdminPanel.spec.ts`                             |
| Terminar de verdad, por la interfaz | ✅ comprobado contra una sesión con transacción abierta (ver abajo)     |

Lo que fija el test e2e que se commitea: la columna nueva existe, el botón está **deshabilitado** en
la sesión del propio panel y habilitado en las demás (el perfil e2e conecta como `sa`), y al pulsarlo
sale el diálogo con `KILL <n>;` y la palabra «irreversible». **Ese test cancela**: no termina
ninguna sesión.

El camino completo se comprobó aparte, con una especificación temporal que abría una víctima con una
transacción abierta en el contenedor de pruebas: el panel la mostró con `4 s` de transacción, el
diálogo pidió confirmación con `KILL 70;`, al confirmar la fila desapareció y las sesiones con
transacción abierta pasaron de 1 a 0, es decir el motor revirtió la transacción. Ese archivo no se
commitea porque depende de Docker; lo que queda fijado en la suite es todo lo demás.

**Nota sobre el diálogo en el test e2e:** los modales de VS Code son ventanas nativas del sistema y
Playwright no las ve, así que el perfil del test fija `window.dialogStyle: "custom"`. Es solo del
entorno de pruebas; en uso normal el diálogo es el nativo del sistema operativo.

---

## 21. Seguridad de la base de datos en solo lectura (M4)

Cuatro secciones nuevas —usuarios, roles de base, esquemas y la matriz de permisos— y un selector
de base de datos en la cabecera. Sigue sin escribir nada: todo son `SELECT`.

### 21.1. Sin `USE`: nombre de tres partes

**El panel comparte la conexión con el editor de consultas del usuario.** Un `USE [otra_base]`
cambiaría la base activa de esa conexión, y el usuario se encontraría sus consultas ejecutándose
contra otra base sin haber tocado nada. Así que las cinco consultas de M4 llegan al catálogo de la
base seleccionada con **nombre de tres partes**:

```sql
FROM [ParityDb].sys.database_principals AS p
```

Comprobado contra SQL Server 2022 desde `master`: el catálogo de otra base se lee entero sin cambiar
de contexto, incluidos `sys.database_permissions`, `sys.database_role_members`, `sys.schemas`,
`sys.objects`, `sys.columns` y `sys.types`.

Dos funciones **no** sirven aquí, y era fácil no darse cuenta:

- `SCHEMA_NAME(id)` y `OBJECT_NAME(id)` resuelven en la base activa de la conexión, no en la que se
  está leyendo. Cada clase de permiso resuelve su nombre con un `JOIN` al catálogo de la base
  correcta. (`OBJECT_NAME(id, DB_ID(N'base'))` sí funciona, pero entonces el nombre de la base entra
  como literal de cadena, y el `JOIN` no necesita eso.)
- `HAS_PERMS_BY_NAME` depende del contexto, así que no se usa en las consultas de base.

El test unitario lo fija: ninguna de las cinco sentencias contiene `USE `, y todas contienen
`[ParityDb].sys.`.

### 21.2. `identifiers.ts`: por fin hay identificadores

El nombre de la base entra en el texto de la consulta, y ahí es donde aparece la regla 11.2 del
brief: `src/custom/util/identifiers.ts`.

- Patrón cerrado del brief: empieza por letra o `_`, hasta 128 caracteres, y admite letras, dígitos,
  `_`, `@`, `$`, `#`, barra invertida, espacio y guion.
- **Regla aparte para `DOMINIO\usuario`**: exactamente una barra, con nombre a los dos lados. El
  dominio admite espacios (`NT AUTHORITY\SYSTEM`) y la cuenta admite además el punto
  (`CONTOSO\ana.perez`).
- **Se valida y se aborta**, nunca se escapa a mano. Los tests rechazan los cuatro casos que el
  brief nombra: corchete de cierre (`Ventas]`), comilla simple (`O'Brien`), punto y coma
  (`Ventas; DROP DATABASE Ventas`) y doble guion (`Ventas--`).
- Lo que pasa se envuelve entre corchetes, como `QUOTENAME`.
- **El mensaje de error no repite el valor rechazado** (regla 11.3): puede venir de un servidor de
  producción y acabar en un registro. Hay un test que lo comprueba.

Dos detalles que salieron de escribir los tests:

1. El patrón del brief admite el guion, así que `Ventas--` **pasaba**. Un doble guion abre un
   comentario en T-SQL, así que se descarta aparte del patrón.
2. Se rechazan los espacios al principio y al final: `[ Ventas]` no es `[Ventas]`, y ese fallo es de
   los que cuesta ver.

Consecuencia asumida y documentada en el propio archivo: SQL Server admite nombres que aquí se
rechazan, como `[raro]]nombre]`. Para lo que administra este panel el patrón sobra, y aceptarlos
obligaría a mantener un escapador propio, que es lo que el brief prohíbe.

### 21.3. La herencia se calcula aquí, no en el servidor

`sharedInterfaces/permissionMatrix.ts` resuelve qué puede hacer un principal y **por qué**. Reglas
del motor que implementa:

1. Un principal hereda de sus roles, **y de los roles de esos roles**: la pertenencia es transitiva.
2. **Todos los usuarios pertenecen a `public`, y el catálogo no lo dice**: `sys.database_role_members`
   no trae esa fila. Sin añadirla, los permisos de `public` no aparecerían en nadie.
3. **`DENY` gana siempre sobre `GRANT`**, venga por donde venga.
4. Con varios caminos al mismo permiso, la explicación que se muestra es la del que gana, y entre
   esos, la más corta. Recorrido en anchura, así que la cadena es la mínima.
5. Un ciclo de pertenencias no puede existir en SQL Server, pero el conjunto de visitados lo soporta
   sin colgarse. Hay test.

**Esto responde la duda que quedó abierta en §18.4.** El `effectivePermissions` del API Object
Management volvió vacío para un permiso heredado de un rol, tanto en el sondeo de M0 como al
comprobarlo ahora, así que la herencia se resuelve sobre `sys.database_permissions` y
`sys.database_role_members`, que son los catálogos que sí la contienen. El §10 del brief ya lo
preveía.

La matriz se calcula en el **webview** y no en el host, porque se recalcula al cambiar de principal y
hacerlo en el host costaría un viaje de ida y vuelta por cada clic. Vive en `sharedInterfaces/`, que
ya está en los dos `tsconfig`: **cero líneas nuevas del upstream**, igual que `duration.ts`. No
contiene T-SQL, así que el §16.5 del brief sigue cumpliéndose.

**Desviación consciente:** el brief pide una «matriz». Una rejilla de permisos × objetos es
ilegible en una base con cientos de objetos, así que la forma es: se elige un principal y se ve una
fila por permiso efectivo, con su objeto, su estado y **cómo lo obtiene** («Propio», «Hereda de
ventas_supervisores, que hereda de ventas_lectores»). La información es la de la matriz; la forma es
la que se puede leer.

**Límite que la leyenda dice en pantalla:** resuelve la herencia por roles, no la jerarquía de
objetos. Un `DENY` sobre una columna sale como fila aparte del `GRANT` sobre el esquema, en lugar de
fundirse en una sola fila «denegado». Es lo que muestran los catálogos, y esconderlo sería peor.

### 21.4. Lo que cambió al correr las consultas contra un servidor real

**`public` tiene cientos de `GRANT SELECT` sobre vistas del sistema.** La primera versión de la
consulta de permisos traía más de 200 filas de ruido (`sysquery_store_runtime_stats_2017`,
`external_governance_classifications`…) y ninguna útil. El filtro obvio —`is_ms_shipped = 0`— **no
funciona**: esas vistas viven en la base de recursos y no están en `sys.objects` de la base, así que
el `LEFT JOIN` las dejaba pasar. El filtro que sirve es exigir que el objeto **exista** en
`sys.objects` cuando la clase es 1. Con eso, `ParityDb` pasa de 200 y pico filas a nueve, que son
exactamente las que muestra SSMS.

**El rol `public` tiene `is_fixed_role = 0`**, así que la primera versión lo etiquetaba «De
usuario». No lo creó nadie y no se puede borrar: es el principal 0 de toda base. Ahora se trae
`principal_id` y se etiqueta «Predefinido».

**El `DENY` sembrado es a nivel de columna** (`ventas.Cliente`, columna `Email`), no de tabla. La
consulta resuelve la columna con `sys.columns` cuando `minor_id > 0`, y la matriz lo muestra como
`Objeto: ventas.Cliente (Email)`.

### 21.5. Selector de base de datos

En la cabecera del grupo de pestañas de base. Lo que hace y lo que no:

- Lista las bases **en línea** de `sys.databases`, con las del sistema al final.
- Una base a la que el login no puede entrar (`HAS_DBACCESS` = 0) **se muestra deshabilitada** en
  lugar de desaparecer: que exista y no se pueda abrir también es información.
- Al cambiar de base, las cuatro secciones de base vuelven a «sin leer» y se relee **solo la
  visible**. Las secciones de servidor no se tocan: no dependen de la base.
- **No cambia la conexión.** El tooltip lo dice, porque es lo que alguien esperaría de un selector de
  bases en una herramienta de SQL.

El nombre se valida **dos veces**: al guardarlo en el estado y al construir cada consulta. Si no
pasa, no se consulta nada y la sección muestra el motivo.

### 21.6. Verificación

| Comprobación                      | Resultado                                                         |
| --------------------------------- | ----------------------------------------------------------------- |
| `npm run build -- --target mssql` | ✅                                                                |
| `npm run lint -- --target mssql`  | ✅                                                                |
| `npm test -- --target mssql`      | ✅ **5206 pasan, 0 fallan**                                       |
| Tests propios nuevos              | ✅ 11 de identificadores, 12 de los mapeadores, 14 de la herencia |
| Las cinco consultas               | ✅ ejecutadas contra SQL Server 2022 real (§21.4)                 |
| Interfaz                          | ✅ en `test/e2e/sqlworksAdminPanel.spec.ts`                       |

Lo que el e2e fija con datos reales, sobre la cadena sembrada
`analista → ventas_supervisores → ventas_lectores`:

- **Usuarios**: `parity_user` con su login del servidor, `analista` sin login y con
  `ventas_supervisores`, y los cuatro usuarios del sistema marcados.
- **Roles**: `ventas_lectores` con dos miembros, uno de ellos **otro rol**.
- **Esquemas**: `ventas` con propietario `dbo`.
- **Matriz**: `INSERT` sobre el esquema `ventas` como «Hereda de ventas_supervisores», `SELECT` como
  «Hereda de ventas_supervisores, que hereda de ventas_lectores», `CONNECT` como «Propio», y el
  `DENY` de `parity_user` sobre la columna `Email`.
- **Selector**: cambiar a `master` recarga la sección y `ventas` desaparece de la lista de esquemas.

### 21.7. Lo que M4 deliberadamente no hace

- **No escribe.** Crear, modificar o borrar usuarios, roles y esquemas es M5, con vista previa del
  script, confirmación y transacción explícita.
- **No muestra permisos de objeto uno por uno.** La matriz parte de los permisos **explícitos** del
  catálogo; los objetos sin permiso explícito no aparecen, porque no hay nada que contar de ellos.
- **No resuelve la jerarquía de objetos** (§21.3), y lo dice en pantalla.

---

## 22. Escritura: la única puerta (M5)

M5 es el primer hito que **escribe** en el servidor. Todo lo que no es un `SELECT` sale por
`src/custom/admin/sql/writeGate.ts`, y no hay una segunda ruta: ni un `tryRun` suelto en un
controlador, ni una llamada a `objectManagement/save`. Esa es la propiedad que hace auditable el
§11 del brief, porque las seis reglas se cumplen en un solo sitio.

Antes de diseñarlo se midió el motor. Ocho sondas contra SQL Server 2022 (16.0.4295.3), y **tres de
los resultados contradicen el diseño obvio**. Van primero, porque son la razón de que el lote tenga
la forma que tiene y no otra más simple.

### 22.1. Las tres medidas que cambiaron el diseño

**1. `DROP DATABASE` dentro de una transacción no da el error 226, da el 574.**

El 226 (`... no se permite dentro de una transacción de varias instrucciones`) es el que devuelven
`CREATE DATABASE` y `ALTER DATABASE ... SET`. Lo intuitivo es tratar «DDL no transaccional» como un
solo caso y mirar un solo número. Medido, `DROP DATABASE` devuelve **574**, con otro texto. Un
`if (numero === 226)` habría dejado el caso destructivo sin mensaje propio. Por eso `GATE_ERRORS`
lista los dos, y `Strings.writeGate.engineError` tiene una entrada para cada uno.

De paso, el sondeo acotó la lista real: de todas las sentencias que M5 puede generar, **solo tres**
son no transaccionales (`CREATE DATABASE`, `ALTER DATABASE ... SET`, `DROP DATABASE`), más `KILL`
(6115). Todo lo demás —`GRANT`, `DENY`, `REVOKE`, `ALTER SERVER ROLE`, `ALTER ROLE`, `ALTER LOGIN`,
`DROP USER`, `CREATE SCHEMA`— **sí** admite transacción y rollback. La regla 11.6 del brief se puede
cumplir de verdad, no como aproximación.

**2. `SET XACT_ABORT ON` no es decorativo: sin él el error deja una transacción huérfana.**

Lo esperable es que un error dentro de `BEGIN TRY` salte al `CATCH` y ahí se revierta. Medido con
`XACT_ABORT OFF`, el 226 **no aborta el lote**: la ejecución continúa y la transacción queda
**abierta y sana** (`XACT_STATE() = 1`). El panel comparte la conexión con el editor del usuario
(§4), así que eso es una transacción huérfana reteniendo bloqueos hasta que alguien desconecte —
exactamente el problema que la sección de sesiones de §20 sirve para diagnosticar, provocado por
nosotros. Con `ON`, el error condena la transacción y el `CATCH` la revierte.

**3. Con `XACT_ABORT ON`, el `CATCH` no puede confirmar: el `COMMIT` falla con 3930.**

El reflejo al escribir un `CATCH` es «decide si confirmar o revertir». Medido, tras un error con
`XACT_ABORT ON` la transacción queda **condenada** (`XACT_STATE() = -1`) y un `COMMIT` devuelve 3930. Así que el `CATCH` del lote **solo revierte**, y no hay ninguna rama que confirme. No es una
elección de estilo: la otra rama no existe en el motor.

### 22.2. Las otras cinco medidas

**4. `EXEC [base].sys.sp_executesql` resuelve tres problemas con una sola construcción.**

- Los `GRANT`/`REVOKE` de ámbito de servidor exigen que la base actual sea `master`, o dan **4621**.
- El DDL de base exige estar **en** la base destino, y ahí el nombre de tres partes no sirve: no
  existe `[base].[esquema].[objeto]` para `ALTER ROLE`.
- `CREATE SCHEMA` tiene que ser **la primera sentencia de su lote** (si no, **156**), y dentro de
  `sp_executesql` lo es, porque `sp_executesql` es su propio lote.

Y se comprobó lo que hacía falta para poder usarlo: al volver de la llamada, `DB_NAME()` sigue
siendo la base original —el cambio de contexto dura solo la llamada— y el `ROLLBACK` del llamante
**sí** alcanza lo que se hizo dentro. Sin esa segunda propiedad, enrutar por `sp_executesql` habría
roto la transacción.

**5. Todo el lote va en **una sola** llamada de `query/simpleexecute`, y sin `GO`.**

El estado transaccional no sobrevive entre llamadas: `BEGIN TRANSACTION` en una y `@@TRANCOUNT` en
la siguiente da **0**. Y con `GO` dentro del texto, `query/simpleexecute` ejecuta lo que hay detrás
pero **se come los errores** de los lotes siguientes: un fallo volvería como éxito. Las dos cosas
juntas obligan a un único lote, un único `SELECT` de informe al final, y ningún `GO`.

**6. `HAS_PERMS_BY_NAME(NULL, NULL, 'ALTER ANY USER')` devuelve `NULL`, no 0 ni 1.**

Por eso `applyChanges` **no** comprueba permisos de escritura antes de ejecutar, y está comentado en
el código: una comprobación previa mal interpretada bloquearía incluso a `sa`. La transacción hace
inocuo el fallo de permisos —se revierte todo— y el panel muestra el mensaje del motor.

**7. Al borrar y recrear un **usuario** de base, `principal_id` y `sid` se conservan.**

Medido dentro de una transacción revertida: `principal_id` 9 → 9, y el `sid` byte a byte igual. La
única columna que cambia es `create_date`. En un **login** sí cambian `principal_id` y `sid`. De ahí
que el testigo de identidad de las precondiciones sea `(nombre, tipo, create_date)` y que
`create_date` sea obligatoria: comparar por `principal_id` no habría detectado nada.

**8. Los SPID se reutilizan de inmediato** (medido en §20), que es por qué `KILL` recomprueba la
identidad de la sesión antes de ejecutar.

### 22.3. La forma del lote, y qué garantiza cada parte

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;                          -- medida 2
DECLARE @paso int = 0; …                    -- de qué paso informar si falla
IF @@TRANCOUNT > 0                          -- guarda de transacción heredada
BEGIN SET @resultado = N'transaccion_heredada'; GOTO informe; END
BEGIN TRY
    BEGIN TRANSACTION;
    SET @paso = 1; SET @etiqueta = N'…';
    IF NOT (<precondición>) THROW 50001, N'…', 1;   -- dentro de la transacción
    EXEC [base].sys.sp_executesql N'…';             -- medida 4
    …
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH                                 -- medida 3: solo revierte
    SET @resultado = N'revertido'; SET @numero = ERROR_NUMBER(); …
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
END CATCH
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;    -- cinturón, por si el CATCH no llegó
informe:
SELECT @resultado, @paso, @etiqueta, @numero, @mensaje, @@TRANCOUNT;
```

La **guarda de transacción heredada** es propia, no salió de una medida: si la conexión ya trae una
transacción abierta, el lote no abre la suya ni ejecuta nada. Confirmar o revertir la transacción de
otro no es cosa del panel, y sobre una conexión compartida con el editor del usuario es un caso real.

Las **precondiciones van dentro de la transacción**, no en el cliente. Comprobar en el cliente deja
una ventana entre la comprobación y la escritura; dentro, la comprobación y el cambio confirman o se
revierten juntos. Sus números (`50001` objeto cambiado, `50002` fila cambiada, `50003` estado
cambiado) tienen mensaje propio en `Strings.writeGate.engineError`.

### 22.4. Las seis reglas del §11, y dónde se cumple cada una

| Regla                                       | Dónde                                                                                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11.1 mostrar el T-SQL y confirmar           | `panels/writeConfirm.ts` (`confirmPlan`) y el cajón, que muestra **los dos** textos: el legible y el exacto que se envía                                                           |
| 11.2 identificadores validados o abortar    | `util/identifiers.ts`; `ddl/plan.ts:validateStatement` rechaza comillas, `;`, `GO` y `USE` en una sentencia ya construida                                                          |
| 11.3 la contraseña no se guarda ni se anota | `sharedInterfaces/pendingChanges.ts` no tiene campo de contraseña (hay un test que lo fija); el ejecutor **nunca lanza**, así que el texto del lote no puede acabar en el registro |
| 11.4 marca de producción                    | `util/production.ts` + ajuste `sqlworks.productionServers`; insignia en el panel y en el cajón, aviso extra en el diálogo                                                          |
| 11.5 escribir el nombre                     | `confirmByTypingName`, exacto y sensible a mayúsculas, con `ignoreFocusOut`                                                                                                        |
| 11.6 transacción con `XACT_ABORT ON`        | `writeGate.ts:buildTransactionalBatch`; lo no transaccional va por `runStandalone` y **marcado como irreversible** en la vista previa                                              |

Dos detalles de la 11.3 que conviene no perder. El ejecutor **no lanza nunca**: devuelve el
resultado. Un `throw` desde un reducer acaba en `webviewBaseController.ts:432-441`, que hace
`logger.error(getErrorMessage(error))`, y ahí no pueden acabar ni el texto del lote ni un mensaje del
motor sin sanear. Y el único sitio donde se dobla una comilla es la función `literal` de
`writeGate.ts`, que escapa **etiquetas de presentación** para meterlas en `N'…'`; las **sentencias**
no pasan por ahí, porque para ellas la regla manda abortar, no escapar.

### 22.5. Correcciones a §18

El sondeo de §18 se hizo antes de M3 y llegó a un plan híbrido que M5 **no sigue**. Las tres
correcciones:

- **§18.3 es incorrecto en un punto que importa.** `objectManagement/script` devuelve el DDL sin
  ejecutar, sí, pero para un login **devuelve la contraseña en claro** dentro del `CREATE LOGIN`.
  Mostrar ese script en un diálogo, o dejar que pase por el registro, viola la regla 11.3. El fork
  no usa `script` para logins.
- **§18.6 queda sin efecto para M5.** El plan era usar `objectManagement/script` + `/save` para
  crear y modificar. No se puede: `save` **ejecuta fuera de nuestra transacción** y responde de
  forma asíncrona, así que no hay manera de envolverlo en el lote de la regla 11.6 ni de saber qué
  quedó aplicado; y `drop`/`rename` ejecutan de inmediato, sin vista previa. M5 escribe su propio
  DDL en `src/custom/admin/sql/ddl/`, con generadores puros y sus tests, que es lo que el §9 del
  brief pedía desde el principio. Lo que §18.6 daba por ahorrado no lo estaba.
- **§18.4 se confirma en lo que avisaba**: `effectivePermissions` no resuelve la herencia. La matriz
  de M4 la calcula por su cuenta (§21), y el aviso de §18.4 era correcto.

Lo que **sí** sigue en pie de §18: `initializeView` para el detalle de un objeto concreto, y el
diagnóstico de que los listados hay que hacerlos con T-SQL propio.

### 22.6. Listas cerradas de permisos, medidas

`ddl/permissionNames.ts` no valida los nombres de permiso con una expresión regular: los compara
contra listas cerradas sacadas de `sys.fn_builtin_permissions` de la propia instancia.

| Ámbito   | Permisos |
| -------- | -------- |
| SERVER   | 51       |
| DATABASE | 105      |
| SCHEMA   | 13       |
| OBJECT   | 13       |

`toPermissionScope` devuelve `undefined` para las clases que el panel todavía no cambia
(`DATABASE_PRINCIPAL`, `TYPE`, y cualquier otra), y quien la llama **aborta**. No se intenta
adivinar la sintaxis de una clase que no se ha medido.

Dos decisiones del generador de permisos que no son evidentes:

- **Revocar un permiso concedido con `WITH GRANT OPTION` se aborta.** Quitarlo exige `CASCADE`, que
  también revocaría lo que ese principal haya concedido a otros. Eso no se decide en un clic, así
  que la fila sale deshabilitada y explica por qué.
- **Columna ausente y columna vacía no son lo mismo.** `column: undefined` es un permiso de tabla;
  `column: ""` es un error de quien llama. Tratarlos igual convertía un permiso de columna en uno de
  tabla entera, ampliándolo en silencio. Lo encontró un test propio.

### 22.7. La marca de producción

El ajuste es `sqlworks.productionServers`, con **`scope: "application"`**. Ese `scope` no es un
detalle: sin él, el `.vscode/settings.json` de cualquier repositorio clonado podría **desmarcar** un
servidor de producción, y la marca dejaría de ser una garantía.

Se identifica de dos formas porque `profile.id` solo existe en los perfiles **guardados** —el
upstream lo asigna en `connectionconfig.ts` al guardar—, y un servidor de producción al que alguien
se conecta sin guardar el perfil es justo el caso en el que la marca importa. De ahí la semántica:
**unión, y solo amplía**. Un patrón no puede quitar la marca que puso un id, ni al revés, y no hay
forma de escribir una excepción.

Cuando el ajuste está **vacío**, el panel lo dice con una línea neutra. Que nadie haya marcado nada
no puede parecer lo mismo que «este servidor no es de producción»: sin ese aviso, el día que alguien
abra el panel contra producción sin haber configurado el ajuste no vería ninguna diferencia. Tampoco
se marca todo como producción por omisión, que enseñaría a ignorar la insignia, ni se adivina por el
nombre.

### 22.8. Un agujero que encontró un test propio

Montar un cambio limpiaba la vista previa del webview pero dejaba vivo el plan del host
(`this.currentPlan`). Con eso, un `previewId` viejo seguía coincidiendo y **el plan anterior se
ejecutaba** aunque la lista de cambios ya fuera otra: exactamente lo que el nonce existe para
impedir. Ahora `currentPlan` se limpia al montar, desmontar, descartar y al cambiar de base de
datos, y hay un test de flujo que lo fija.

En la misma línea, cambiar de base de datos **descarta** los cambios de ámbito de base ya montados,
con aviso visible, en lugar de ejecutarlos contra la base nueva. Los de ámbito de servidor se
quedan, porque no dependen de la base.

### 22.9. Verificación

| Qué                              | Estado                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Unitarios propios de M5          | ✅ 80 tests nuevos (`writeGate` 27, `ddlGenerators` 26, `production` 13, `changeSetFlow` 14) |
| Suite completa del repositorio   | ✅ 5081 + 205, 0 fallos                                                                      |
| Lote real contra SQL Server 2022 | ✅ arnés directo, 16/16 comprobaciones                                                       |
| Interfaz                         | ✅ `test/e2e/sqlworksAdminPanel.spec.ts`, 2 tests                                            |

El arnés de lote no usa Playwright: importa los módulos compilados del fork, construye el lote con
`buildTransactionalBatch` y ejecuta **el texto exacto** con `sqlcmd`, leyendo el informe con
`parseReport`. Lo que se comprueba es el artefacto real. Tres casos:

1. **Lote de 3 cambios que se aplica**: informe `aplicado`, `@@TRANCOUNT` final 0, y el catálogo
   cambiado en las tres cosas.
2. **Lote de 5 cambios que falla en el 3.º**: informe `revertido` con `paso = 3`, número de error
   del motor **15151**, la etiqueta del paso 3, y el catálogo **idéntico al de antes** — ni el paso 1
   ni el 2 quedaron aplicados, y el 4 y el 5 no se ejecutaron.
3. **Transacción heredada**: con una transacción ya abierta, el informe dice
   `transaccion_heredada` y no se ejecutó nada.

Al terminar no queda ningún objeto de prueba (`RESTOS_TOTALES = 0`).

El e2e **cancela en todas las barreras**, y lo comprueba releyendo del servidor: monta un cambio de
ámbito de servidor y otro de base desde dos secciones distintas, verifica que la vista previa lleva
`SET XACT_ABORT ON`, `BEGIN TRANSACTION` y **las dos rutas** (`EXEC [master].sys.sp_executesql` y
`EXEC [ParityDb].sys.sp_executesql`), cancela, y confirma que el catálogo no cambió. En el caso
destructivo **confirma el primer diálogo a propósito**, para comprobar que detrás hay una segunda
barrera, y cancela en la caja de texto; la última comprobación del bloque es que el usuario sigue
existiendo, así que si esa barrera no estuviera el test lo detectaría en lugar de dejarlo pasar. El
segundo `describe` levanta VS Code con `sqlworks.productionServers` sembrado y comprueba que la
insignia sale y que un cambio **reversible** también exige escribir el nombre del servidor.

### 22.10. Lo que M5 deliberadamente no hace

- **No crea logins, usuarios ni roles**, y por tanto no toca contraseñas. Es M6. La razón es de
  alcance, **no** que la regla 11.3 sea imposible: se cumple con marcador en el script y sustitución
  en el momento de ejecutar, y el diseño ya lo contempla. _(Hecho en M6; el diseño previsto era el
  correcto. Ver §23.2.)_
- **No borra bases de datos.** `DROP DATABASE` es de las tres sentencias no transaccionales
  (número 574, §22.1) y va por la ruta irreversible, que hoy solo entrega `KILL`.
- **No comprueba permisos de escritura antes de ejecutar**, por la medida 6.
- **No usa `objectManagement/save`, `/drop` ni `/rename`** (§22.5).

---

## 23. Creación de principales y contraseñas (M6)

M6 es el hito de las contraseñas, y por tanto el de la regla 11.3 del brief. También añade crear y
borrar logins, usuarios y roles, que son las operaciones que faltaban para administrar la seguridad
de verdad y no solo mirarla.

Igual que en M5, primero se midió el motor. Aquí las medidas no solo ajustaron el diseño: una de
ellas es un **fallo silencioso** que ningún informe del servidor puede detectar.

### 23.1. Las medidas

**1. La contraseña no puede ser un parámetro. Es la restricción que manda en todo lo demás.**

`CREATE LOGIN [x] WITH PASSWORD = @variable` es un **error de sintaxis (102)**. El DDL de SQL Server
no acepta parámetros ahí, así que la contraseña tiene que ser un **literal dentro del texto**. Y
`query/simpleexecute` del STS recibe una sola cadena: no hay canal de parámetros. Las dos cosas
juntas significan que **la contraseña viaja en el texto que se envía**, y no hay diseño que lo evite.

Lo que sí se puede controlar es quién la ve y cuándo, y eso es lo que hace §23.2.

**2. Una contraseña de 129 caracteres o más: `CREATE LOGIN` no crea nada y no da ningún error.**

Medido carácter a carácter: 127 crea, 128 crea, **129 no crea y no falla**, 130 tampoco. El lote
informaría `aplicado` y no habría login. El informe del motor no puede distinguirlo de un éxito, así
que la única barrera posible es el cliente: `validateSecret` rechaza por encima de 128 y **aborta
antes de enviar**. Es la medida más importante de M6, porque sin ella el panel mentiría.

**3. `QUOTENAME(@secreto, '''')` es el escapado correcto, y lo hace el motor.**

Con una contraseña que lleva comilla simple, corchete de cierre, punto y coma, `--`, salto de línea y
`GO`, el login se crea y `PWDCOMPARE` con la original devuelve **1**: se guarda exactamente lo que se
escribió. Por eso el lote **no** escapa la sentencia en TypeScript: arma el texto en el servidor con
`QUOTENAME`, que es la primitiva del propio motor. La regla 11.2 prohíbe escapar a mano, y aquí no
hace falta.

El anidamiento a mano sí se midió, y funciona (`REPLACE(@inner, '''', '''''')` con `PWDCOMPARE = 1`),
pero son cuatro niveles de comillas en algunos puntos. Se descartó a propósito: funcionar no es lo
mismo que ser mantenible.

**4. La contraseña no aparece en ningún mensaje de error.** Medido en cuatro caminos: error de
sintaxis después de la contraseña (el motor cita el token del error, no el literal), contraseña que
intenta romper la cadena, contraseña con caracteres de control, y error de ejecución por login
duplicado. En los cuatro, `ERROR_MESSAGE()` no la contiene.

**5. La contraseña no queda en la caché de planes.** Esta medida hubo que repetirla, porque la
primera estaba **contaminada**: el script de la sonda contenía el centinela como literal, así que lo
que aparecía en `sys.dm_exec_cached_plans` era el propio fichero de la sonda y no la sentencia.
Repetida construyendo la contraseña con `NCHAR()` para que la cadena no estuviera en el texto
enviado, y enviando además un lote con la forma exacta que usa el fork: **0 planes** en los dos
casos. Un lote de DDL con control de transacción no entra en la caché.

**6. Todo el DDL de principales es transaccional.** `CREATE LOGIN`, `CREATE SERVER ROLE`,
`CREATE USER`, `CREATE ROLE`, `DROP LOGIN` y `ALTER LOGIN ... WITH PASSWORD` se revierten con
`ROLLBACK`; en el caso del `ALTER`, la contraseña vieja vuelve a ser la válida (`PWDCOMPARE` pasa de
1 a 0). Así que M6 entra por el lote normal de M5 y no por la vía irreversible, donde solo quedan el
DDL de base de datos y `KILL`.

**7. Números de error que M6 necesita explicar**, medidos: **15025** el principal ya existe (login y
rol de servidor dan el mismo), **15099** `MUST_CHANGE` con `CHECK_EXPIRATION = OFF`, **15144** borrar
un rol que todavía tiene miembros. Los tres tienen mensaje propio en `Strings.writeGate.engineError`.

**8. `MUST_CHANGE` va pegado a `PASSWORD`**, antes de la coma, y exige `CHECK_EXPIRATION = ON` y
`CHECK_POLICY = ON`. El generador **aborta** la combinación inválida en lugar de dejar que el servidor
rechace el lote: el usuario se entera al montar el cambio, no al aplicarlo.

### 23.2. Cómo se cumple la 11.3 con la contraseña dentro del texto

Cuatro cosas, y ninguna depende de la buena voluntad de quien llame:

1. **La contraseña no entra en el estado del webview.** El formulario de creación **no tiene campo de
   contraseña** —lo dice en pantalla, donde el usuario lo buscaría— y la petición que el webview manda
   al host no lleva ninguno. `PendingChange` tampoco: hay un test que lo fija.
2. **La sentencia lleva una ranura, no un valor.** El generador pone `@@SECRETO@@` y declara
   `secret: { prompt, subject }`. El marcador **no tiene comillas**, así que `validateStatement` sigue
   valiendo tal cual, y hay dos comprobaciones nuevas: marcador sin ranura y ranura sin marcador son
   las dos un fallo del generador y se rechazan.
3. **El lote se construye dos veces con la misma función.** Sin secretos sale el marcador de posición
   `N'<contraseña>'`, que es lo que se publica y lo que se ve; con secretos sale el valor real, y solo
   en la llamada que ejecuta. Un test compara los dos textos línea a línea y exige que difieran en
   **exactamente una**: el `DECLARE`. Eso convierte «la vista previa no muestra la contraseña» en algo
   comprobable en lugar de una promesa.
4. **El host la pide al final**, con `showInputBox({ password: true })`, después del diálogo del
   script y después de escribir el nombre. Así no hay un secreto en memoria mientras alguien mira un
   diálogo, y quien cancela en una barrera anterior no ha tenido que escribirla. Se pide **dos veces**
   y se comparan: una errata en una contraseña que no se ve crearía un login al que nadie puede
   entrar, y solo se descubriría al intentar usarlo.

Y una red que no es la defensa principal pero cierra un agujero real: `redactSecrets` tacha el valor
de cualquier mensaje antes de devolverlo. Hacía falta porque `describeQueryError` **afirmaba** en su
comentario que nunca incluye la consulta, cuando en realidad devuelve el mensaje del controlador tal
cual. En M5 eso era inocuo; con una contraseña en el lote, no. La medida 4 dice que el motor no la
filtra, pero eso es una medida de una versión concreta: la garantía no debe depender de haberla hecho.

### 23.3. Qué se puede crear, y qué no

| Operación                                     | Ranura de contraseña | Destructiva (regla 11.5) |
| --------------------------------------------- | -------------------- | ------------------------ |
| `CREATE LOGIN`                                | Sí                   | No                       |
| `ALTER LOGIN ... WITH PASSWORD` (restablecer) | Sí                   | **Sí**                   |
| `CREATE USER` (con login o `WITHOUT LOGIN`)   | No                   | No                       |
| `CREATE SERVER ROLE` / `CREATE ROLE`          | No                   | No                       |
| `DROP LOGIN`                                  | No                   | Sí                       |
| `DROP SERVER ROLE` / `DROP ROLE`              | No                   | Sí                       |

Restablecer una contraseña se cuenta como destructiva a propósito: no borra nada, pero deja fuera a
quien estuviera usando la anterior, y eso merece la misma barrera que un borrado.

Dos avisos que el panel da porque el motor no los da:

- **Borrar un login no borra los usuarios de base que lo tenían asignado.** Medido: el usuario se
  queda huérfano. La acción lo dice antes de montarse.
- **Un rol con miembros no se borra** (15144). Hay que quitar los miembros **en el mismo conjunto de
  cambios**, y eso es justo lo que la transacción hace posible: medido, el lote «quitar miembro +
  borrar rol» se aplica entero. Sin transacción habría que hacerlo en dos pasos, con el riesgo de
  dejar el rol vacío y sin borrar.

Un usuario **contenido** (con su propia contraseña, en una base con `CONTAINMENT = PARTIAL`) no se
crea: es otro tipo de objeto y este panel no gestiona bases contenidas. Si se añade, será una función
aparte con su propia ranura, no un parámetro opcional en `buildCreateUserStatement`.

### 23.4. Bases de datos: no se reimplementan, y la transacción no aportaría nada

El brief pone crear, borrar y renombrar bases de datos en M6. **No se hace**, por dos razones que
apuntan en la misma dirección:

1. **El upstream ya las trae**, y no a medias: `createDatabaseWebviewController`,
   `dropDatabaseWebviewController` y el comando de renombrar, con sus tres entradas en el menú
   contextual del árbol (`mssql.createDatabase`, `mssql.dropDatabase`, `mssql.renameDatabase`).
   Reimplementarlas sería exactamente lo que la prohibición §16.2 del brief impide: un segundo stack
   de interfaz para algo que ya funciona.
2. **La garantía de M5 no se puede dar ahí de todas formas.** Medido: `CREATE DATABASE` dentro de una
   transacción da el error **226** y `DROP DATABASE` el **574**. No hay transacción posible, así que
   envolverlas en nuestro lote no añadiría ni atomicidad ni vuelta atrás. Lo único que aportaría el
   fork es la vista previa, y `objectManagement/script` ya la da para bases de datos, donde —a
   diferencia de los logins— **no hay contraseña que pueda salir en claro**.

Queda anotado como decisión, no como olvido. Si algún día se quiere unificar la vista previa de las
bases con la del panel, el sitio es la vía irreversible del ejecutor, que existe y está probada con
`KILL`.

### 23.5. Corrección a §11.6

§11.6 decía «Cambiar contraseña (`changePasswordWebviewController`) | M3», dando por hecho que el
upstream ya cubría el caso. **No lo cubre.** Ese controlador no tiene comando en `package.json` y
solo se invoca desde `connectionManager.ts:1984`, cuando una conexión falla con
`SqlConnectionErrorType.PasswordExpired`: es el flujo de recuperación de **tu propia** contraseña
caducada al conectar, no una operación de administrador sobre otro login. Restablecer la contraseña
de un tercero es de M6 y es propia.

### 23.6. Verificación

| Qué                                | Estado                                             |
| ---------------------------------- | -------------------------------------------------- |
| Unitarios propios de M6            | ✅ 41 nuevos (`secrets` 22, `createPrincipals` 19) |
| Suite completa del repositorio     | ✅ 5122 + 205, 0 fallos                            |
| Generadores contra SQL Server 2022 | ✅ arnés directo, 30/30                            |
| Interfaz                           | ✅ `test/e2e/sqlworksAdminPanel.spec.ts`, 2 tests  |

El arnés ejecuta **el T-SQL que generan las funciones del fork**, no una imitación: importa los
módulos compilados, construye el lote con `buildTransactionalBatch` y lo manda con `sqlcmd`. Lo que
comprueba, entre otras cosas:

1. Un login creado con la contraseña `a'b]]';--Xy9!` queda con **esa** contraseña: `PWDCOMPARE` = 1.
2. El lote de vista previa y el de ejecución difieren en **una línea**, y la de vista previa no
   contiene la contraseña.
3. Un lote mixto de cuatro creaciones (rol de servidor, pertenencia, usuario con esquema, rol de
   base) se aplica entero.
4. Un lote de dos `CREATE LOGIN` donde el segundo ya existe se **revierte entero** con el 15025, el
   primero no queda creado, y el mensaje del motor no contiene **ninguna** de las dos contraseñas.
5. Restablecer la contraseña deja válida la nueva.
6. El generador aborta `MUST_CHANGE` sin caducidad, y la combinación válida se aplica.
7. Una contraseña de 129 caracteres se rechaza antes de enviar, con un motivo que no la repite.
8. «Quitar miembro + borrar rol» en el mismo lote funciona, y borrar el rol a secas da 15144.
9. `DROP LOGIN` deja huérfano al usuario de base.

Sin restos al terminar. El e2e **cancela en la caja de la contraseña** y comprueba releyendo del
servidor que el login no se creó; antes verifica que el formulario no tiene ninguna caja de
contraseña, que el script muestra `N'<contraseña>'`, que el lote exacto lleva
`DECLARE @secreto1 ... = N'<contraseña>'` y `QUOTENAME(@secreto1, '''')`, y que la caja que aparece al
aplicar es de tipo `password` de verdad.

### 23.7. Lo que M6 deliberadamente no hace

- **No crea ni borra bases de datos** (§23.4).
- **No gestiona usuarios contenidos** (§23.3).
- **No guarda contraseñas en ningún sitio**, ni siquiera en el almacén de credenciales de VS Code:
  el panel administra logins ajenos, no perfiles de conexión propios, así que no hay nada que
  recordar.
- **No comprueba la política de contraseñas antes de enviar.** El contenedor Linux de pruebas no
  aplica complejidad (medido: aceptó `clave_secreta_123` con `CHECK_POLICY = ON`), así que cualquier
  validación propia sería una suposición sobre la política del servidor de destino. Si el motor la
  rechaza, la transacción se revierte y el panel muestra su mensaje.

---

## 24. Biblioteca de snippets (M7)

El punto 12 del brief pide una vista de snippets implementada como `WebviewViewProvider` y **no**
como `TreeDataProvider`. No hizo falta infraestructura: `WebviewViewController` del upstream ya
implementa esa interfaz (§3.1), así que la vista es una clase más del fork y entra por el router del
bundle único (§16.2), sin tocar `bundle-webviews.js`.

### 24.1. Lo que el upstream ya tenía, y el hueco que queda

El upstream ofrece snippets en el editor por **dos** caminos, y los dos son estáticos:

| Camino                                                | Cuántos | Editable por el usuario |
| ----------------------------------------------------- | ------- | ----------------------- |
| `contributes.snippets` → `snippets/mssql.json`        | 18      | No, va en el `.vsix`    |
| `TSQL_SNIPPETS` en `src/sqlLanguage/data/snippets.ts` | 23      | No, compilado           |

El hueco es justo ese: **ninguno crece con lo que escriba la persona**. M7 añade una biblioteca
propia, editable, y —porque es un fork de distribución interna— bibliotecas **compartidas** para un
equipo.

Los 18 de la extensión se leen también y se muestran en la vista, en solo lectura. Es una decisión
de usabilidad: sin eso habría que recordar cuáles salen en la autocompletación y cuáles están en la
lista, y la vista deja de ser «el sitio donde buscar un snippet».

### 24.2. Dónde vive cada cosa

| Origen          | Dónde                                                | Se puede editar |
| --------------- | ---------------------------------------------------- | --------------- |
| Propia          | `globalStorageUri/snippets.json`                     | Sí              |
| Compartidas     | Rutas del ajuste `sqlworks.snippets.sharedLibraries` | No              |
| De la extensión | `snippets/mssql.json` del `.vsix`                    | No              |

La propia es **global y no del espacio de trabajo**: es la biblioteca de la persona, y por proyecto
habría que reescribirla en cada repositorio. No va en `settings.json` porque un cuerpo de T-SQL de
veinte líneas dentro de un ajuste es incómodo de editar y ensucia un archivo que se comparte.

Las compartidas son de **solo lectura desde el panel**, a propósito: editar desde aquí el archivo
que usa un equipo entero sería una sorpresa desagradable. Quien las mantenga lo hace con su editor y
su control de versiones. Lo que sí se puede es **duplicar** uno de solo lectura a la biblioteca
propia, que es la forma de partir de algo ajeno sin pisarlo.

**Se aceptan dos formatos**, y no por generosidad: el propio (un array de objetos) y el de los
archivos de snippets de VS Code (un objeto con el nombre como clave). El segundo ya existe, así que
un equipo que tenga snippets de SQL en ese formato puede apuntar a ellos sin convertir nada — y los
18 de la extensión se leen con el mismo código en lugar de con un caso especial. El cuerpo se acepta
como cadena o como array de líneas, porque hay archivos reales con las dos formas.

### 24.3. Nada de esto puede dejar la vista inservible

Una biblioteca compartida vive en una ruta de red y la edita gente a mano. Así que `parseLibrary`
**no lanza**: devuelve lo que se pudo leer, el motivo de lo que no, y las entradas sueltas que se
descartaron. La vista muestra las tres cosas a la vez. Una ruta caída da su aviso y el resto de los
snippets siguen ahí.

Dos detalles que no son evidentes:

- **El motivo de un JSON roto no incluye el mensaje de `JSON.parse`.** Dice la posición, que no
  ayuda a nadie, y puede arrastrar un trozo del contenido del archivo a la interfaz. Hay un test que
  lo fija con un centinela.
- **Una biblioteca propia con el JSON roto no se sobrescribe.** El aviso dice que se abra y se
  arregle. Reescribirla con lo que se pudo leer perdería el trabajo de la persona.

### 24.4. El bug que encontró el e2e

Insertar desde la barra lateral obliga a **quitar el foco del editor**, así que el diseño no se fía
de `vscode.window.activeTextEditor` —que es «el activo o, si ninguno tiene el foco, el que cambió
más recientemente»— y `SnippetInserter` se acuerda del último editor de SQL.

La primera versión tenía un fallo que el e2e destapó: el aviso de «no hay ningún editor de SQL» se
quedaba puesto con un `.sql` abierto delante. El motivo es sutil y merece quedar escrito:

```ts
// MAL: `target` lee activeTextEditor en vivo, y cuando llega el evento ya refleja el cambio,
// así que `had` y el valor nuevo son siempre iguales y el evento no se dispara nunca.
const had = this.target !== undefined;
this.remember(editor);
if (had !== (this.target !== undefined)) {
    this.emitter.fire();
}
```

La corrección es guardar la última disponibilidad publicada en un campo y comparar contra eso. Hay
un test unitario que lo fija —«**avisa** cuando aparece un editor de SQL»— para que la próxima vez se
detecte en un segundo y no en una ejecución de Playwright.

### 24.5. Dos cosas que la suite obligó a arreglar

Ninguna es de snippets, y las dos son mejoras de verdad:

1. **La primera lectura es diferida.** Leer el disco en la activación rompía
   `test/unit/extension.test.ts`: `stubExtensionContext` del upstream no define `globalStorageUri`,
   y `Uri.joinPath(undefined, …)` lanzaba. Se movió a `resolveWebviewView`, que es cuando la vista
   se abre de verdad. Aparte del test, es lo correcto: la extensión no debe pagar E/S en el arranque
   por una vista que quizá nadie mire en toda la sesión.
2. **`registerCustom` es reentrante.** Un identificador de vista solo se puede registrar una vez por
   host de extensión, y `registerWebviewViewProvider` lanza «already registered» al segundo intento.
   Ese mismo test activa la extensión en cada caso, con un `subscriptions` nuevo que nadie libera.
   Ahora `registerCustom` suelta lo que registró la llamada anterior. Hasta M7 el fork solo
   registraba comandos y eso no se quejaba.

### 24.6. Los snippets propios en la autocompletación

Los propios y los compartidos se ofrecen también al escribir en un `.sql`, con un
`CompletionItemProvider`. Es **aditivo**: VS Code combina todos los proveedores registrados, así que
los dos caminos del upstream siguen funcionando igual y este añade los de la persona. No entra un
segundo motor de lenguaje ni se toca el del upstream, que es lo que prohíbe el §16 del brief.

Los de la extensión **se excluyen** de la autocompletación a propósito: ya los ofrece VS Code por
`contributes.snippets`, y volver a ofrecerlos daría dos entradas idénticas por snippet.

Dentro de una cadena o de un comentario no se sugiere nada. Se mira el texto de la línea hasta el
cursor: sin analizador de SQL, que el §16 prohíbe y que aquí no hace falta. Las comillas dobladas
(`''`) cuentan como escapada y no como dos delimitadores, igual que en T-SQL. El coste de
equivocarse es una sugerencia de más o de menos, nunca un error.

Un detalle que sí importa: **el prefijo no se valida con las reglas del 11.2.** Esas son para
identificadores que acaban dentro de una consulta; un prefijo es una palabra que dispara una
sugerencia en el editor. Lo que sí se exige es que no lleve espacios, porque VS Code filtra por la
palabra anterior al cursor y un prefijo con espacios nunca coincidiría.

### 24.7. Verificación

| Qué                            | Estado                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Unitarios propios de M7        | ✅ 38 nuevos (`snippetLibrary` 23, `snippetInsert` 8, `snippetCompletion` 7) |
| Suite completa del repositorio | ✅ 5160 + 205, 0 fallos                                                      |
| Interfaz                       | ✅ `test/e2e/sqlworksSnippets.spec.ts`                                       |

El e2e de snippets **no necesita servidor** —la vista no consulta nada—, así que va en su propio
archivo en lugar de en el del panel de administración, que sí exige una instancia alcanzable. Lo que
comprueba: que los de la extensión salen en solo lectura, que el aviso de «no hay editor de SQL» se
ve cuando no lo hay, que un prefijo con espacios se rechaza en el formulario, que un snippet propio
se crea y aparece **delante** de los de la extensión, que insertar desde la barra lateral **llega al
editor**, y que borrar pide confirmación y cancelar no borra.

### 24.8. Lo que M7 deliberadamente no hace

- **No sustituye ni toca los dos caminos de snippets del upstream** (§24.1).
- **No escribe en las bibliotecas compartidas** (§24.2).
- **No sincroniza nada.** La biblioteca propia es un archivo JSON; compartirla es ponerla en una ruta
  común y añadirla al ajuste, no un servicio.
- **No valida el T-SQL del cuerpo.** Un snippet es una plantilla con huecos y no tiene por qué ser
  una sentencia válida por sí sola; comprobarlo exigiría un analizador, que el §16 prohíbe.

---

## 25. Formato: perfiles sobre el formateador del upstream (M8)

La decisión 11.5 ya había dado por bueno **conservar el formateador del upstream** y construir solo
lo que falta. M8 va un paso más allá y **retira también el perfil XML**, por decisión del usuario
—que pidió expresamente valorar si no era mejor añadir lo que falta sobre el upstream— y por lo que
salió al medir.

El resultado: el fork **no sustituye el formateador, lo configura**. No hay proveedor de formato
propio, no entra ninguna librería de formateo, y el T-SQL lo sigue formateando el parser real
(ScriptDom) dentro del STS.

### 25.1. La medida que decide el diseño

Contra el STS real, hablando LSP por stdio:

| Cómo se pasan las opciones de formato                | Resultado       |
| ---------------------------------------------------- | --------------- |
| En la petición `textDocument/formatting` (`options`) | **se ignoran**  |
| Por `workspace/didChangeConfiguration`               | **se respetan** |

Se probó con tres formas de nombrar la opción dentro de la petición y ninguna tuvo efecto; por
configuración, `keywordCasing: lowercase` pasa las palabras clave a minúsculas y
`commaPlacement: leading` mueve las comas al principio de línea, de forma inconfundible.

**La primera versión de esta medida estaba mal hecha y decía que las dos vías se ignoraban.** El
error era de la prueba, no del motor: se pedía `keywordCasing: uppercase` cuando la salida por
omisión **ya venía en mayúsculas**, así que el cambio no se podía notar. Repetida con `lowercase`,
la respuesta fue clara. Vale la pena dejarlo escrito: una medida que sale «no pasa nada» hay que
mirarla dos veces antes de creérsela.

Consecuencia directa: **aplicar un perfil es escribir `mssql.format.options.*`**. No hay vía por
petición que controlemos sin interceptar la capacidad del LSP, que es el cambio caro que la regla de
oro evita (§8.1).

### 25.2. Por qué no hay perfil XML

1. **El esquema ya existe, y mejor.** El `package.json` del upstream declara **55 opciones de
   estilo** (56 ajustes `mssql.format.*` menos `showParseErrorNotification`, que es una preferencia
   de notificaciones) con su tipo, sus valores posibles, su valor por omisión y su descripción. Un
   XML sería una segunda descripción de lo mismo, escrita a mano.
2. **Y el upstream se mueve.** Las 55 opciones entraron de golpe en dos commits de hace unos días
   (§8). Cada opción nueva sería una línea que alguien tiene que acordarse de añadir al XML, y cada
   renombrado un fallo silencioso.
3. **El XML no podría ser la fuente de verdad**, por la medida de §25.1: el formateador solo lee de
   la configuración. Sería una capa sobre `settings.json`, y una capa que no es la fuente de verdad
   es un problema de sincronización esperando a ocurrir. FORK.md ya lo admitía como la contrapartida
   honesta de §11.5.
4. **Compartir en equipo ya está resuelto**: un `.vscode/settings.json` en el repositorio. Un XML
   añadiría importar y exportar para llegar al mismo sitio.

Lo que VS Code **no** da, y era lo valioso de la petición del brief, son **perfiles con nombre entre
los que cambiar de un clic**. Eso es lo que entrega M8, en un ajuste propio
(`sqlworks.format.profiles`), en el formato que el editor ya sabe leer, validar, editar y
sincronizar.

**Si aparecen perfiles XML de otra herramienta** (SSMS, dbForge, Visual Studio) que haya que
importar, el sitio es un lector de una sola dirección que rellene el borrador del panel. Es aditivo
y no cambia nada de lo anterior.

### 25.3. El esquema se lee en tiempo de ejecución

`format/schema.ts` lee `contributes.configuration.properties` del `package.json` de la extensión y
deduce de cada opción su control (casilla, desplegable, número), su valor por omisión y su
descripción. **No hay lista de opciones escrita a mano en el fork.** Cuando el upstream añada una,
aparece en el panel sola.

Lo que no se sabe pintar **se descarta en silencio**: es mejor no mostrar una opción que mostrar un
control que miente y escribir un valor que el formateador no entiende. Hoy no se descarta ninguna:
las 55 se leen, todas con descripción.

Los grupos de la interfaz se deducen del nombre (`newLineBefore…`, `multiline…`, `…Casing`), que en
el upstream son regulares. Un mapa de opción → grupo escrito a mano sería justo lo que este diseño
evita; lo que no encaje cae en «Otras» y no se pierde.

### 25.4. Un perfil guarda solo las desviaciones

Un perfil no guarda las 55 opciones: guarda **lo que se desvía** de lo que declara el upstream. Tres
razones, y las tres importan:

- Un perfil se lee de un vistazo: «este pone las comas al inicio y nada más».
- Un `git diff` de `settings.json` dice algo.
- Una opción nueva del upstream **no queda congelada** con su valor de hoy en todos los perfiles
  guardados.

Por lo mismo, aplicar un perfil **borra** del `settings.json` las opciones que quedan en su valor por
omisión, en lugar de escribirlas. Sin eso, aplicar dejaría 55 líneas en el archivo, la mayoría
repitiendo lo que ya dice el upstream.

Y al cargar un perfil, lo que el perfil no menciona vuelve **a fábrica**, no a lo que hubiera antes
en el panel. Si no, aplicar dos perfiles seguidos daría un híbrido de los dos.

### 25.5. La vista previa, y por qué tiene su propio proceso

La vista previa es lado a lado: el mismo SQL de muestra formateado con lo que está aplicado y con lo
que hay en el panel **sin aplicar**. Con 55 opciones, muchas oscuras (`asKeywordOnOwnLine`,
`clauseBodyAlignment`), ver el efecto es la diferencia entre un panel útil y una lista de 55
casillas.

Pero por §25.1 las opciones son **del proceso**, no de la petición ni del documento. Con el STS que
usa el editor no hay forma de formatear «como quedaría» sin cambiar de verdad cómo formatea todo lo
demás; y previsualizar escribiendo los ajustes y restaurándolos es intrusivo, tiene carreras con el
formateo al guardar, y si VS Code se cierra a media vista previa los deja cambiados.

Así que la vista previa habla con **su propio STS**, efímero:

- **No toca los ajustes ni la conexión del usuario.** De hecho no se conecta a ningún servidor:
  medido, el STS formatea sin conexión, porque el formateo es puramente sintáctico.
- Usa el binario que **ya va en el `.vsix`**, así que no entra ninguna dependencia y **no se toca el
  descargador ni el arranque del STS del upstream** (§16 del brief).

Coste medido: **785 ms** hasta que responde y **123 MB** residentes. No es gratis, así que arranca en
la primera vista previa y muere con el panel. Por eso el comando de aplicar un perfil está separado
del panel: cambiar de estilo a diario no debe costar un proceso.

Comprobado además que la configuración **no se queda pegada** entre llamadas: volver a las opciones
por omisión da exactamente el mismo texto que la primera vez.

### 25.6. El hallazgo de la suite: dos copias de la extensión en el mismo host

Al añadir M8, `test/unit/extension.test.ts` empezó a fallar con «View provider for
'sqlworksSnippets' already registered», y ni hacer `registerCustom` reentrante (M7) ni un guardia a
nivel de módulo lo arreglaban. El motivo, ya establecido:

**Bajo los tests unitarios hay dos copias del código de la extensión vivas en el mismo host.**
`package.json` apunta a `./dist/extension` —el bundle, que VS Code activa— y el test importa
`src/extension`, que se ejecuta desde `out/`. Son dos módulos distintos, con su propio estado, así
que ningún guardia a nivel de módulo puede coordinarlos.

En producción solo hay una copia. La solución es tolerar ese fallo concreto: si el id ya está
registrado, hay un proveedor para la vista y la vista funciona; lo que no puede es reventar el
registro de todo lo demás.

### 25.7. Desviaciones respecto a lo que §11.5 daba por entregado

| Lo que decía §11.5                                   | Lo que hace M8                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Perfil XML                                           | **No se hace** (§25.2). Perfiles en `sqlworks.format.profiles`         |
| Perfiles múltiples con selector                      | ✅ En el panel y en un selector rápido desde la paleta                 |
| Panel de opciones con vista previa lado a lado       | ✅ Con su propio STS, sin tocar los ajustes (§25.5)                    |
| Importación desde los ajustes actuales               | ✅ El panel arranca con lo aplicado; guardarlo como perfil es un botón |
| Un test por opción                                   | **No se hace**: ver abajo                                              |
| Opciones no soportadas deshabilitadas con su mensaje | **No aplica**: ver abajo                                               |

- **«Un test por opción»** tenía sentido cuando el fork iba a _implementar_ el formateo. No lo
  implementa: lo implementa ScriptDom dentro del STS, y probar sus 55 opciones sería probar código
  de Microsoft. Lo que sí se prueba es lo nuestro: que el esquema se lee, que los perfiles se
  mezclan y se guardan bien, y que la vista previa aplica opciones de verdad contra el STS real.
- **«Opciones no soportadas deshabilitadas»** venía de que el panel iba a estar guiado por la lista
  del XML, donde ~10 % de las opciones no tenían equivalente (§8.2). Guiado por el `package.json`,
  solo existen las que existen: mostrar siete controles permanentemente deshabilitados para
  funciones que el upstream no tiene sería ruido. Las que faltan siguen anotadas en §8.2, que es el
  sitio donde alguien las buscaría.

### 25.8. Verificación

| Qué                             | Estado                               |
| ------------------------------- | ------------------------------------ |
| Unitarios propios de M8         | ✅ 26 nuevos (`formatSchema`)        |
| Suite completa del repositorio  | ✅ 5186 + 205, 0 fallos              |
| Vista previa contra el STS real | ✅ arnés directo, 5/5                |
| Interfaz                        | ✅ los 3 e2e del fork siguen pasando |

Uno de los unitarios comprueba el esquema **contra el `package.json` de verdad**: 55 opciones, todas
pintables, todas con descripción. Es el test que avisa de que el upstream tocó el formateador.

El arnés de vista previa ejecuta `PreviewFormatter` del fork contra el STS real y comprueba que
respeta `keywordCasing` y `commaPlacement`, que volver a las opciones por omisión no arrastra la
configuración anterior, y que un SQL inválido devuelve un motivo en lugar de lanzar.

### 25.9. Lo que M8 deliberadamente no hace

- **No sustituye el proveedor de formato** ni intercepta la capacidad del LSP.
- **No define un formato de perfil propio** (§25.2).
- **No escribe los ajustes sin que se lo pidan**: nada sale del panel hasta pulsar «Aplicar», y se
  pregunta si va a los ajustes del usuario o a los del proyecto.
- **No añade las ~10 % de opciones del brief que el upstream no tiene** (§8.2): eso sería escribir un
  formateador.

---

## 26. Primer merge con el upstream (M9)

Este hito no añade función ninguna. Existe **para medir si el aislamiento de los §4 y §16 funcionó**,
y la forma de medirlo es traerse el upstream y ver qué se rompe. El criterio del brief es concreto:
terminado cuando el merge se resuelve **sin tocar código nuestro**, la lista de paridad pasa, y
`FORK.md` sigue siendo exacto.

Los tres se cumplen. Los dos primeros salieron mejor de lo esperado; el tercero costó, y es el que
ha dejado más trabajo hecho.

### 26.1. Lo que se trajo, y el resultado

| Dato                                   | Valor                                                |
| -------------------------------------- | ---------------------------------------------------- |
| Base común                             | `752692d7` (donde se separó el fork)                 |
| Punta del upstream traída              | `f9e632ea`                                           |
| Commits del upstream                   | 2                                                    |
| Archivos que tocó                      | 57 (21 nuevos), +9606 / −266                         |
| Nuestros commits por delante           | 13 (M0 a M8)                                         |
| Archivos tocados por **los dos** lados | **2**: `package.json` y `src/constants/constants.ts` |
| **Conflictos**                         | **0**                                                |
| Archivos de `src/custom/` tocados      | **0**                                                |

Los dos commits son la función **Data API Builder** (despliegues persistentes y un destino de CLI) y
una **guía de Kerberos** para el diálogo de conexión.

**El merge es determinista, y se comprobó tres veces.** Se resolvió, se deshizo para medir el árbol
anterior (§26.4) y se rehízo: el hash del árbol resultante fue idéntico las dos veces,
`c75f492ee16fe58555be2fef09cf29f6e09748b8`. La tercera fue una reconstrucción independiente, en solo
lectura y sin tocar el repositorio, que dio el mismo hash:

```bash
git merge-tree --write-tree HEAD upstream/main   # → c75f492e…, sin conflictos
```

### 26.2. Por qué no hubo ni un conflicto, medido y no supuesto

«Cero conflictos» no basta: git resuelve sin conflicto cuando los cambios caen en líneas distintas, y
eso puede dejar conviviendo dos cosas incoherentes. La comprobación fuerte es que **el archivo
mezclado se diferencie del upstream exactamente en lo nuestro, y nada más**:

```bash
# Lo que el upstream añadió, ¿sigue estando todo?
git diff 752692d77..upstream/main -- <archivo> | grep '^+' | ...   # 0 líneas perdidas
# Lo que nos separa del upstream, ¿es solo lo nuestro?
git diff upstream/main -- extensions/mssql/package.json            # 108 líneas, todas del fork
git diff upstream/main -- extensions/mssql/src/constants/constants.ts   # 3 líneas, las nuestras
```

- **`package.json`**: las cuatro tramas del upstream caen dentro del manifiesto de la herramienta
  `mssql_dab` (quitan `expectedVersion` de su esquema). Lo nuestro vive en la identidad, en
  `view/item/context`, en cuatro comandos y en tres ajustes. **Cero solape.** El JSON sigue siendo
  válido y sin claves duplicadas.
- **`constants.ts`**: el upstream añade una clase `Links` y dos claves de configuración a partir de
  la línea 233, y borra `integratedAuthHelpLink`. Nuestro `extensionId` está en la línea 10, a más de
  220 líneas. El borrado no deja nada colgando: `git grep integratedAuthHelpLink` no devuelve nada.

Los otros tres anclajes —`src/extension.ts`, `scripts/bundle-webviews.js` y los dos `tsconfig`— **el
upstream ni los tocó**. Tampoco `eslint.config.mjs`.

**Éste es el resultado que el hito buscaba.** El upstream metió 9606 líneas, una carpeta entera de
servicios y 10 componentes nuevos de webview, y el coste de integración del fork fue **leer dos
diffs**. La regla de oro del §4 —todo en `src/custom/`— es lo que lo compró.

### 26.3. Lo que el upstream añadió, y por qué no nos obliga a nada

| Qué                                        | ¿Nos afecta?                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| 6 archivos en `src/dab/` (CLI, feed NuGet) | No, salvo la decisión pendiente de §26.8                                |
| 10 componentes en `SchemaDesigner/dab/…`   | No: cuelgan de `dabPage.tsx`, que ya entra por el entry point existente |
| 3 acciones nuevas de telemetría            | No: quedan cortadas solas (§26.6)                                       |
| ~350 tests nuevos                          | No: pasan tal cual                                                      |
| Guía de Kerberos y tooltip                 | Inerte en Windows, que es a donde va este fork (§13.2)                  |

**No hace falta un quinto anclaje.** Comprobado, no supuesto: ningún archivo nuevo es un
`pages/*/index.tsx` (así que no hay entry point de esbuild que añadir), ninguno importa desde rutas
que obliguen a tocar los `tsconfig`, y ninguno codifica el identificador de la extensión.

**La versión del SQL Tools Service no se movió**: sigue pineada en `6.0.20260915.1`
(`src/configurations/config.ts`), archivo que el merge no toca. Por construcción, entonces, todo lo
que el fork habla con el motor —M3 a M6— no puede haber cambiado de contrato.

### 26.4. La lista de paridad, y la regresión que encontró

§13 dice que la lista se corre «después de cada merge». Se corrió, y **encontró un fallo de verdad**.

Los puntos 1 y 7 se apoyan en dos especificaciones e2e del upstream (`connection.spec.ts` y
`executionPlan.spec.ts`). Sobre el árbol mezclado, **2 de sus 13 tests fallaban**:

```
Error: locator.fill: strict mode violation: locator('.webview') resolved to 2 elements
```

La tentación era anotarlo como daño del merge. **No lo era**, y se midió: se deshizo el merge, se
reconstruyó el árbol de M8 y se volvieron a correr los dos specs. Fallaban **exactamente igual**.

La causa es nuestra, y es de M7: la vista `sqlworksSnippets` salía **visible por omisión**, así que
en cuanto se abre la barra lateral del explorador de objetos materializa un segundo `iframe.webview`.
El arnés del upstream (`test/e2e/utils/testHelpers.ts:98`) localiza los webviews con un
`frameLocator(".webview")` sin cualificar, y con dos deja de ser unívoco.

Se nos escapó porque **después de M7 solo se corrían los tres specs del fork**, que ya usan
`findSqlworksWebview` y no se enteran. La lista de paridad es lo que lo destapó, que es justo para lo
que está.

**El arreglo son dos palabras** en nuestra propia contribución del `package.json`:

```json
{ "id": "sqlworksSnippets", "type": "webview", "visibility": "collapsed" }
```

Se arregla en nuestro lado, no en el arnés del upstream: una vista del fork no tiene por qué abrirse
sola en la barra lateral de todo el mundo, y `resolveWebviewView` ya carga en diferido (§24.3), así
que colapsada no cuesta nada. Resultado: **13 de 13 del upstream** y **3 de 3 del fork**.

| #   | Comprobación                                                       | Tras el merge | Evidencia                                 |
| --- | ------------------------------------------------------------------ | ------------- | ----------------------------------------- |
| 1   | Autenticación SQL                                                  | ✅            | `connection.spec.ts`, 1/1                 |
| 1b  | Autenticación integrada                                            | ❌            | Sigue sin dominio Kerberos (§13.2)        |
| 2–6 | Explorador, IntelliSense, consultas, exportación, Script as Create | ✅            | arnés JSON-RPC contra el STS, 6/6         |
| 7   | Plan de ejecución estimado                                         | ✅            | `executionPlan.spec.ts`, 12/12            |
| 8   | Historial de consultas                                             | ✅            | Cerrado por el usuario en Windows (§13.2) |

### 26.5. `FORK.md` no era exacto, y ése era el hallazgo

El tercer criterio del hito resultó ser el más caro. Se auditó el documento entero contra el árbol
mezclado y **salieron nueve cosas falsas o incompletas**.

Solo **una** la causó el merge (el ancla de línea desplazada). Las otras ocho ya eran falsas antes, y
el merge se limitó a **destaparlas**: eso es la otra mitad de para qué sirve este hito. Un documento
de deuda de merge solo se comprueba cuando hay un merge.

| Qué decía                                        | Qué pasa de verdad                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| «971 archivos en **53 carpetas**»                | Eran **51** ya en la base; hoy 988 del upstream y 1069 con `src/custom/`   |
| «**56** ajustes `mssql.format.options.*`»        | **55** con ese prefijo; 56 contando `showParseErrorNotification`           |
| «**nueve** líneas de producto»                   | **8** líneas del upstream sustituidas; ahora medido y con el comando       |
| `formComponentHelpers.ts:299` (en dos sitios)    | El merge la desplazó a la **303**                                          |
| Fila de `launchVscodeWithMsSqlExt.ts`: «1 línea» | Son dos cambios; el segundo tiene **lógica** y no estaba en §0             |
| 1b: «requiere **Windows**»                       | Requiere un **dominio Kerberos**; el propio upstream documenta Linux       |
| `mssqlProtocolHandler.ts`                        | Estaba en §0 **sin marcador `// [FORK]`**: el grep de auditoría no lo veía |
| Tabla de archivos nuevos                         | Faltaba `images/sqlworksIcon.png`, que es a donde apunta el manifiesto     |
| «`Perf` pasa por el mismo reporter»              | **Falso**, y era la peor de las nueve: ver §26.6                           |

Todas corregidas en el sitio, con la medida al lado. Los marcadores `// [FORK]` **en código** pasan
de **21 en 16 archivos** a **22 en 17** (el que faltaba en `mssqlProtocolHandler.ts`):

```bash
# Los marcadores de verdad, sin contar las veces que esta documentación los menciona
git grep -n "\[FORK\]" -- . ':!FORK.md' ':!NOTICE.md'
```

**Lo que esto enseña sobre el propio método.** La disciplina del §0 —una fila por archivo, un
marcador por línea— funciona, pero solo se comprueba a sí misma cuando alguien la audita. Un archivo
sin marcador es invisible para `git grep "\[FORK\]"`, que es _el_ comando que §0 prescribe: el fork
se estaba auditando con una herramienta que no veía uno de sus propios cambios. Y una cifra de
inventario sin el comando que la produjo no se puede re-verificar, así que envejece sin que nadie se
entere. Las cifras nuevas de este documento van con su comando al lado.

### 26.6. El corte de telemetría aguantó, pero por una razón distinta de la escrita

**La buena noticia, medida:** el upstream trajo 9606 líneas y **tres `sendActionEvent` nuevos**, y
quedaron cortados **sin tocar una línea del fork**. Es el resultado de haber cortado en el
_reporter_ y no evento a evento: los puntos de entrada leen el enlace de módulo en cada llamada, así
que da igual cuántos emisores añada el upstream. Los webviews tampoco abren una vía nueva: su
telemetría desemboca en el mismo sitio a través de `webviewBaseController.ts`.

**La mala:** `FORK.md` decía, en dos sitios, que los **tres** emisores del upstream comparten ese
reporter, y que por tanto `disableTelemetry()` cortaba también `Perf`. **Es falso.** `Perf.marker`
acaba en `diag.emit`, y de ahí solo sale si hay un **sink** registrado; el único del árbol manda por
`http.request`, no por Application Insights:

```bash
git grep -n "sendActionEvent\|sendErrorEvent\|startActivity" -- extensions/mssql/src/perf   # vacío
git grep -n "addSink" -- extensions/mssql/src                          # solo perfTelemetry.ts:144
```

Lo que contiene `Perf` es su **propia** puerta: el sink solo se registra con `PERF_MODE=1` **y**
`PERF_MARKER_URL` **y** `PERF_CONTROL_TOKEN`. Es el arnés de `tools/perftest`. O sea: el camino está
cerrado, pero **no por lo que decíamos que lo cerraba**. Un documento que da por cortado un camino
que nadie está cortando es peor que no decir nada, porque desactiva la revisión: quien añadiera un
sink por omisión abriría una salida de red y nadie la relacionaría con la telemetría.

Se corrigió §6 y §15.3, se reescribió el comentario de `overrides/telemetry.ts`, y la invariante real
ya no depende de que alguien se acuerde: `telemetryOverride.test.ts` comprueba que **sin `PERF_MODE`
no hay ningún sink registrado**, y que `disableTelemetry()` no interviene en ese camino.

De paso se corrigió **cómo** queda muerto el reporter. No es que se quede en `undefined` con buenos
modales: `new VsCodeTelemetryReporter(undefined)` **lanza** un `TypeError` desde
`shouldUseOneDataSystemSDK` (hace `key.length` sobre `undefined`) y el `try/catch` del toolkit se lo
traga. Importa saberlo porque el aviso `Error initializing TelemetryReporter:` de la consola **es** el
corte, no ruido: quien lo silencie pasando una clave de relleno reabre el envío.

### 26.7. Dos archivos fuente del fork que git no podía leer

La auditoría encontró algo que no tiene que ver con el merge y que llevaba desde M4/M6 en el árbol:
**dos archivos del fork contenían un byte NUL crudo**, de modo que git los clasificaba como binarios.

```
extensions/mssql/src/custom/admin/sql/ddl/secrets.ts:73        if (secret.includes("<NUL>"))
extensions/mssql/src/custom/sharedInterfaces/permissionMatrix.ts:106   ].join("<NUL>")
```

Consecuencia real, no teórica: `git diff --numstat` devolvía `-` para esos dos archivos en lugar del
recuento de líneas, y **`git grep` no los miraba**. Dos fuentes del fork quedaban fuera de cualquier
revisión hecha con las herramientas que este mismo documento prescribe.

El origen ya se conocía a medias: `eslint --fix` convierte un escape `u0000` en el byte crudo. En M5
y M6 se arregló en los **tests** con `String.fromCharCode(0)`, y se dio por cerrado sin mirar los
fuentes. Ahora están los dos.

Y tiene una coda que vale la pena dejar escrita: **al documentar el problema en un comentario, se
volvió a caer en él**. Se escribió el escape dentro del comentario, `eslint --fix` lo convirtió en un
NUL crudo, y el archivo volvió a ser binario. La regla no es «no uses el escape en el código», es **no
lo escribas en el archivo, ni siquiera en un comentario**. Comprobado ejecutando `eslint --fix` dos
veces sobre los dos archivos: 0 bytes NUL y estable.

### 26.8. Lo que el merge deja sobre la mesa, y no decido yo

El merge trae **una salida de red nueva**. No se ha tocado nada: es una decisión del usuario, del
mismo tipo que las 11.4 y 11.5 que ya están en la tabla de §11.

Conviene ser preciso con qué choca exactamente, porque es fácil pasarse. **No contradice la decisión
11.4**: aquélla iba de _cómo empaquetar el SQL Tools Service_, y sus tres razones siguen siendo
ciertas del STS. Lo que sí choca es la **intención que esa decisión cita del brief** —«el brief
quiere que la extensión no hable con ningún servidor»— y que hasta ahora se cumplía de hecho, no solo
en el STS. Es una intención, no una regla del §11, así que no obliga a nada por sí sola; por eso esto
es una recomendación y no un arreglo.

**Lo medido:**

1. `src/dab/dabCliTool.ts` descarga la CLI de Data API Builder (un `.nupkg`) y **ejecuta lo que
   desempaqueta**, con `spawn(..., {detached: true})`: el proceso sobrevive a cerrar VS Code. No hay
   comprobación de firma ni de hash.
2. El feed **no es fijo**. `dabNuGetFeed.ts` recorre los `NuGet.Config` de la carpeta abierta y de
   todos sus padres, y gana la primera fuente que conteste; `api.nuget.org` es el último recurso. Es
   decir: **el repositorio que tengas abierto puede decidir de dónde sale el binario**. La extensión
   declara soportar espacios de trabajo no confiables.
3. Vuelve a hacer falta `ms-dotnettools.vscode-dotnet-runtime` (o un `dotnet` en el `PATH`), que es
   justo la dependencia que la razón 3 de §11.4 dice que quitamos.
4. **Hoy no se alcanza**: cuelga de `mssql.schemaDesigner.enableDeploymentsView`, y
   `isDeploymentsViewEnabled()` hace `!!get<boolean>(...)` sobre un ajuste **que el upstream no
   declara en su `package.json`**. Sin declarar vale `undefined`, y la función queda apagada.

**Por qué no lo doy por resuelto.** El punto 4 no es una decisión nuestra: es un **descuido del
upstream**. El día que lo declaren —o que alguien escriba la clave a mano en un `settings.json` de
repositorio, que nada se lo impide— se enciende sola una función que descarga y ejecuta un binario
elegido por el repositorio abierto.

**Las opciones, con su coste:**

| Opción                                                                                                      | Coste                                                | Contrapartida                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **(a)** Dejarlo como está y documentarlo                                                                    | Cero                                                 | La política de «sin red» depende de un descuido ajeno                                                                                  |
| **(b)** Declarar `mssql.schemaDesigner.enableDeploymentsView` con `default: false` y `scope: "application"` | Dos líneas en `package.json`, que ya es anclaje nº 1 | Convierte el apagado en decisión nuestra, y un repositorio no lo puede encender. Al declararlo, además, sale en la interfaz de ajustes |
| **(c)** Fijar también `mssql.dab.cliPackageFeedUrl` a un espejo NuGet interno                               | Una línea más, pero hace falta la URL de la empresa  | Cierra el punto 2 incluso si algún día se enciende                                                                                     |

Lo que **no** hay que hacer es la tercera vía: parchear `src/dab/*` o `src/services/dabService.ts`.
Serían archivos del upstream fuera de §0 y un quinto anclaje, justo lo que este hito acaba de
demostrar que sale barato no tener.

> **Resuelto. El usuario eligió (d) y (e)**, no (b) ni (c). Lo hecho está en **§27**, y con ello esta
> sección queda corregida en tres puntos que se daban por buenos aquí:
>
> 1. **El mapa de esta sección estaba incompleto.** La salida de red **no es nueva del merge**: el
>    destino de contenedor, que descarga de MCR, ya estaba antes de M9 y **no está detrás de ningún
>    ajuste**. El punto 4 de arriba («hoy no se alcanza») solo vale para la rama de la CLI. Con el
>    ajuste apagado, la barra de DAB sigue ofreciendo un botón **«Deploy»** que va a esa rama.
> 2. **El riesgo de la 11.3 estaba señalado al revés.** El camino de la CLI —el nuevo— **no** escribe
>    la contraseña en disco: su configuración lleva `@env('DAB_CONNECTION_STRING')`. El que sí la
>    escribe, completa y en un temporal, es el camino de **contenedor**, que es el viejo (§27.3).
> 3. **(b) tenía un coste que no se contabilizó:** sería la primera clave `mssql.*` que el fork añade
>    al manifiesto, y la regla de auditoría del §0 —`git grep '"sqlworks\.'`— dejaría de bastar.
>
> Y la creencia sobre la que se apoyaba la recomendación —que `scope: "application"` impide que un
> repositorio escriba la clave— **ya no es una creencia: está medida** (§27.1). Resultó ser cierta.

### 26.9. Verificación

| Qué                                  | Estado                                                     |
| ------------------------------------ | ---------------------------------------------------------- |
| Conflictos del merge                 | ✅ 0                                                       |
| Archivos de `src/custom/` tocados    | ✅ 0                                                       |
| Determinismo del merge               | ✅ mismo árbol `c75f492e` en tres reconstrucciones         |
| `npm run build -- --target mssql`    | ✅                                                         |
| Typecheck de extensión y de webviews | ✅ los dos, con `tsgo`                                     |
| Lint                                 | ✅                                                         |
| Suite completa                       | ✅ **5540 pasan, 0 fallan**, 17 omitidos (312 archivos)    |
| Unitarios propios del fork           | ✅ 290 (2 nuevos en M9, la invariante de `Perf`)           |
| e2e del fork                         | ✅ 3/3                                                     |
| e2e del upstream (paridad 1 y 7)     | ✅ **13/13**, tras arreglar la regresión de §26.4          |
| Arnés JSON-RPC de paridad            | ✅ 6/6 contra SQL Server 2022 real                         |
| Lista de paridad                     | ✅ ocho de nueve; 1b sigue necesitando un dominio Kerberos |

El aumento respecto a M8 es del upstream, y está medido: solo sus archivos nuevos de
`test/unit/dab/` aportan **312 tests**, y pasan todos sin tocar nada. (No se compara contra la cifra
de §25.8, «5186 + 205», porque aquélla salió de contar los dos ejecutores por separado y no es
homogénea con ésta.)

### 26.10. Lo que M9 deliberadamente no hace

- **No actualiza el inventario de §1 a §10 a la punta del upstream.** El inventario describe el
  terreno sobre el que se construyó el fork; reescribirlo en cada merge perdería esa foto. Lo que el
  merge dejó falso está corregido en el sitio y señalado; lo nuevo, en §26.3.
- **No toca `src/dab/` ni nada de la función nueva del upstream.** Ver §26.8.
- **No cierra la paridad 1b.** Sigue haciendo falta un dominio Kerberos, que este entorno no tiene.
- **No renumera las secciones ni reordena el documento**, aunque nueve correcciones invitaban a ello:
  las referencias cruzadas `§N` de este archivo y de los comentarios del código dejarían de valer.

---

## 27. Lo que el usuario decidió sobre §26.8: medir y avisar

De las cinco opciones de §26.8 el usuario eligió **(e)** y **(d)**, y descartó declarar la clave
(b) y fijar el feed (c). Es decir: **nada de prevención, sí de medición y visibilidad**. Esta sección
cuenta las dos, y lo que se aprendió al hacerlas, que fue más de lo previsto.

### 27.1. (e) `scope: "application"` protege de verdad — ahora medido

**El resultado:** un `.vscode/settings.json` de repositorio **no puede** tocar
`sqlworks.productionServers`. La afirmación de §22.7 y la de la descripción del ajuste en el
`package.json` son ciertas.

Importa más de lo que parece. Esa frase no adorna nada: sostiene la regla 11.4 del brief, que es la
barrera que obliga a escribir el nombre del objeto antes de tocar un servidor marcado. Desde M5
estaba escrita como un hecho, y **era conocimiento del API de VS Code, no una medida de este
repositorio**. Se descubrió al estudiar la opción (b) de §26.8, que se apoyaba en la misma creencia:
al ir a comprobar si la recomendación era sólida, resultó que ya había un control en producción
colgando de ella.

El test es `test/e2e/sqlworksSettingScope.spec.ts`, y es **un experimento controlado, no una
comprobación**. Una sola prueba no mediría nada: si se siembra el ajuste en la carpeta y la marca no
aparece, eso no distingue «lo filtró el `scope`» de «el ajuste está mal escrito» o «el panel no llegó
a leerlo». Así que son dos arranques con **una sola variable, el ámbito**:

|             | Dónde se escribe el ajuste                | Resultado esperado      | Medido |
| ----------- | ----------------------------------------- | ----------------------- | ------ |
| **Control** | `settings.json` de **usuario**            | La marca aparece        | ✅     |
| **Prueba**  | `.vscode/settings.json` de la **carpeta** | La marca **no** aparece | ✅     |

Los dos abren la misma carpeta, para que lo único distinto sea dónde está escrito.

**Si este test se pone rojo algún día no es un test frágil que relajar**: significaría que un
repositorio clonado puede desmarcar un servidor de producción. El arreglo sería cambiar el `scope`
(`machine` es el equivalente, y además queda fuera de Settings Sync), no ablandar la aserción.

### 27.2. Dos formas de que el test se pusiera verde sin medir nada

Las dos ocurrieron. Se dejan escritas porque son el tipo de fallo que no se ve en el resultado.

**La primera: no había carpeta.** La primera versión del test **pasaba, y no medía nada**. VS Code
se tragaba sin avisar la ruta pasada como argumento suelto y arrancaba con la ventana vacía; sin
espacio de trabajo no hay ajustes de espacio de trabajo, así que la marca no aparecía y el test se
ponía verde. Se descubrió mirando la captura de un test **vecino** que había fallado: el editor
mostraba «Open Folder». Dos arreglos:

- `--folder-uri=<uri>` en lugar del argumento posicional, que sí abre la carpeta.
- **Asertar la premisa**: los tres tests comprueban ahora, contra el título de la ventana, que la
  carpeta está abierta **antes** de medir nada. Es la lección de verdad de esta sección: un test cuya
  premisa no se comprueba puede pasar por el motivo equivocado, y éste lo hizo.

**La segunda: la confianza del espacio de trabajo.** VS Code abre una carpeta desconocida en modo
restringido y **descarta por su cuenta parte de los ajustes de espacio de trabajo**. En ese estado la
marca tampoco habría aparecido, pero por un motivo distinto del que se quería medir, y el test no
habría podido distinguirlos. Por eso los tres arranques llevan
`"security.workspace.trust.enabled": false`: con la confianza fuera de la ecuación, lo único que
puede descartar el ajuste es su ámbito.

### 27.3. (d) El control detectivo, y qué no hace

Vive en `src/custom/overrides/networkWatch.ts` y lo arranca `registerCustom`, que ya es el anclaje
nº 2. **Cero anclajes nuevos, cero archivos del upstream tocados**, que es justo lo que lo hacía
preferible a (b).

Vigila las dos claves de Data API Builder y **avisa si alguien las ha encendido, diciendo en qué
ámbito**. Nada más. Conviene ser explícito sobre lo que **no** hace:

- **No apaga la función** ni bloquea la descarga.
- **No cierra el camino del contenedor**, que es el que está abierto (§26.8, corrección 1).
- **No sustituye a (b)**: si el upstream declara la clave algún día, un repositorio seguirá pudiendo
  encenderla. Lo que cambia es que se notará.

Lo que sí cubre y (b) no cubriría: **la propia persona encendiéndola en sus ajustes**. Un `scope` no
protege de eso.

Tres decisiones de diseño que se tomaron a propósito:

1. **`inspect()`, no `get()`.** `get()` da el valor efectivo y se traga de dónde viene; aquí el
   origen es justo lo que importa. Que `inspect()` devuelva algo para una clave **sin declarar** era
   otra suposición —si devolviera `undefined`, el control no se dispararía jamás— así que hay un
   test que lo mide dentro de un VS Code real.
2. **Gana el ámbito más específico definido, y solo entonces se mira si está encendida.** No es lo
   mismo que «el primer ámbito encendido»: si los ajustes de usuario la encienden pero el espacio de
   trabajo la apaga a propósito, el valor efectivo es «apagada» y avisar sería mentir. Un aviso que a
   veces miente deja de leerse.
3. **Se exige `=== true`**, aunque el upstream lea la clave con `!!`. Avisar por la cadena `"false"`
   sería un falso positivo. Se acepta el hueco a cambio de que el aviso, cuando salga, sea cierto.

### 27.4. Lo que el e2e de (d) midió de paso

El tercer test de `sqlworksSettingScope.spec.ts` comprueba el aviso, y al hacerlo **mide la premisa
de §26.8**, que también estaba sin comprobar: que una clave **sin declarar** sí la puede encender un
repositorio.

Lo es. Con `mssql.schemaDesigner.enableDeploymentsView: true` en el `.vscode/settings.json` de la
carpeta, el fork avisa y dice «espacio de trabajo». O sea que la preocupación de §26.8 era real, y el
aviso la hace visible.

### 27.5. Verificación

| Qué                                | Estado                                                      |
| ---------------------------------- | ----------------------------------------------------------- |
| Unitarios nuevos                   | ✅ 14 (`networkWatch`), uno de ellos contra el VS Code real |
| Suite completa                     | ✅ **5554 pasan, 0 fallan**                                 |
| e2e nuevo (`sqlworksSettingScope`) | ✅ 3/3, con la premisa asertada                             |
| e2e del fork                       | ✅ 3/3                                                      |
| e2e del upstream (paridad 1 y 7)   | ✅ 13/13                                                    |
| Build, lint, los dos typechecks    | ✅                                                          |

En total, **19 tests e2e en verde**: 3 del fork, 3 nuevos y 13 del upstream.

> **Sobre un fallo de entorno que conviene no confundir con una regresión.** En este contenedor, el
> arnés e2e falla a veces antes de ejecutar ningún test, al instalar
> `ms-dotnettools.vscode-dotnet-runtime` desde el marketplace (`ECONNRESET`). No tiene que ver con el
> fork ni con estos cambios: muere en el paso de instalación. Las cifras de arriba son de una
> ejecución con `SKIP_DOTNET_RUNTIME_EXTENSION_INSTALL=true`, que en este fork es legítimo saltarse:
> M1 sacó esa extensión del `extensionPack` justamente porque el SQL Tools Service va empaquetado
> (§11.4). Si alguien ve ese fallo, es la red del entorno, no el código.

Coste en deuda de merge: **5 líneas de código** (16 con sus comentarios) en
`test/e2e/utils/launchVscodeWithMsSqlExt.ts` —un campo opcional en la configuración de lanzamiento,
su `--folder-uri` y el `import` de `pathToFileURL`—, en un archivo de arnés que ya estaba en §0.
**Ni una línea de producto del upstream.**

### 27.6. Lo que esto deliberadamente no hace

- **No declara `mssql.schemaDesigner.enableDeploymentsView`** (opción (b)): descartada por el usuario.
  Sigue disponible en §26.8 si algún día se quiere prevención y no solo visibilidad.
- **No fija `mssql.dab.cliPackageFeedUrl`** (opción (c)): haría falta la URL de un espejo interno, y
  `default: ""` no serviría de nada porque el upstream la lee con `?.trim() || undefined`.
- **No toca el camino del contenedor**, que sigue abierto y sigue escribiendo la cadena de conexión
  —con contraseña— en un temporal con permisos `0600` que borra después. Está en §26.8 como lo que
  es: un hecho conocido y aceptado, no un descuido.

---

## 28. IntelliSense y las mayúsculas: una hipótesis medida y descartada

Petición del usuario, después de probar el fork. Con una tabla `DSHB_Navigation` en la base:
escribir `DSHB` la propone, escribir `dshb` no, y `navigation` tampoco aunque esté dentro del
nombre.

**Esta sección documenta un cambio que se escribió, se midió y se retiró.** Está aquí porque la
medición es el resultado útil: descarta dos explicaciones enteras y deja el problema acotado.

### 28.1. La hipótesis

Que el SQL Tools Service filtrara las sugerencias por el texto ya escrito **antes** de responder, con
un filtro sensible a mayúsculas. Encajaba con todo lo que se veía, y tenía a su favor un argumento
por descarte que parecía sólido:

- El comparador de VS Code no distingue mayúsculas ni exige que el encaje empiece en la primera
  letra.
- El motor nativo del upstream (`src/sqlLanguage/`) dobla a minúsculas antes de comparar, y además
  **no está enchufado**: `LanguageFeatureRouter` solo lo usa bajo la preferencia `nativeTypeScript`, y
  nadie lo construye fuera de sus tests (`git grep -n "LanguageFeatureRouter" -- extensions/mssql/src | grep -v /test/`).

Si no era ninguno de los dos, tenía que ser el STS. Sobre esa hipótesis se escribió un middleware que
pedía las sugerencias **dos veces** —en el cursor y en el inicio de la palabra, donde el servidor no
tendría nada por lo que filtrar— y fusionaba. Iba con 23 tests unitarios y con una nota honesta de
que contra un servidor de verdad estaba sin medir.

### 28.2. El entorno de medida

Lo que faltaba para medir, montado entero aquí:

```bash
docker run -d --name mssql-dshb -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='<contraseña>' \
  -e MSSQL_PID=Developer -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest
```

Base `SqlWorksPrueba`, **colación `SQL_Latin1_General_CP1_CI_AS`** —insensible a mayúsculas, para que
la colación no sea la explicación— con `dbo.DSHB_Navigation`, `dbo.DSHB_Widget`, una vista, un
procedimiento y una función con el mismo prefijo. Y luego **3.000 tablas más**, con nombres en
minúsculas, mayúsculas y mixtos, porque un catálogo de juguete no descarta un truncado.

El binario del STS es el mismo artefacto que la extensión se baja sola (la URL está en
`src/configurations/config.ts`). La sonda es
`extensions/mssql/test/harness/stsCompletionProbe.mjs`, ahora en el repositorio: es el arnés nº 2 del
§13.1, que hasta ahora se mencionaba sin estar.

### 28.3. Lo que dijo el servidor

Con 3.119 sugerencias en juego y el mismo documento en los cinco casos:

| Escrito                     | Sugerencias | ¿Está `DSHB_Navigation`? | Rango del `textEdit` |
| --------------------------- | ----------- | ------------------------ | -------------------- |
| `DSHB` (mayúsculas)         | 3119        | **SÍ**                   | 14→18                |
| `dshb` (minúsculas)         | 3119        | **SÍ**                   | 14→18                |
| `navigation`                | 3119        | **SÍ**                   | 14→24                |
| nada (Ctrl+Espacio)         | 3119        | **SÍ**                   | 14→14                |
| `dshb`, cursor en el inicio | 3119        | **SÍ**                   | 14→18                |

**El STS no filtra nada.** Devuelve la misma lista escribas lo que escribas, y la tabla está siempre.
La hipótesis del §28.1 es falsa, y con ella el cambio entero: la segunda petición traía exactamente
lo mismo que la primera, así que la fusión no añadía una sola sugerencia. Sobraba una petición por
pulsación a cambio de nada.

De paso cae el otro motivo que tenía el cambio: el `textEdit` **ya viene anclado a la palabra
escrita** (14→18, no un rango vacío en el cursor), incluso preguntando en el inicio de la palabra. No
había ningún rango que arreglar.

### 28.4. Lo que dijo el editor

El filtro del widget de sugerencias es `fuzzyScoreGracefulAggressive` con
`FuzzyScoreOptions.default`. Está en `monaco-editor`, que ya está en `node_modules`, así que se puede
ejecutar con los mismos parámetros que usa `CompletionModel`:

| Escrito      | `DSHB_Navigation` | `vDSHB_NavigationWidgets` | `NavigationId` |
| ------------ | ----------------- | ------------------------- | -------------- |
| `DSHB`       | sí (23)           | sí (1)                    | no             |
| `dshb`       | **sí (15)**       | sí (−1)                   | no             |
| `navigation` | **sí (10)**       | sí (9)                    | sí (72)        |
| `nav`        | sí (−4)           | sí (−5)                   | sí (16)        |

Encaja las minúsculas y encaja por el medio del nombre. Las mayúsculas solo suben la **puntuación**
—23 frente a 15—, que cambia el orden, no la visibilidad.

### 28.5. Qué queda en pie

Ni el servidor esconde la tabla ni el editor la descarta. **En este stack, escribir `dshb` propone
`DSHB_Navigation`.** Lo que el usuario ve no está explicado por ninguna de las dos piezas, así que el
cambio se retira entero y el problema sigue abierto, pero mucho más acotado:

- Si la tabla **aparece pero muy abajo** en la lista, es lo de §28.4: la diferencia de puntuación
  entre 15 y 23 con miles de candidatos. Eso no se arregla filtrando, se arregla ordenando, y es un
  cambio distinto (y pequeño): darle a las sugerencias un `sortText` propio, que el STS deja a
  `null`.
- Si la lista sale **vacía o sin objetos**, no es un problema de comparación de texto sino de la
  caché de IntelliSense del STS contra esa base concreta —permisos, tamaño, o que no ha terminado de
  montarse—, y lo que hay que mirar es otro sitio.

Lo que hace falta para decidir entre las dos es información de la máquina del usuario, no más
conjeturas desde aquí. Está anotado en §28.7.

### 28.6. Dos formas de medir mal, las dos vividas

Van en la cabecera de la sonda y aquí, porque las dos producían resultados creíbles:

1. **Mandar el documento entero en `textDocument/didChange`.** El STS declara
   `textDocumentSync: 2` (incremental) y no aplicaba esos cambios: el documento que tenía seguía
   siendo el del `didOpen`. Las respuestas salían idénticas en los seis casos, que era **justo lo que
   se quería demostrar**. Una medición equivocada que confirma la hipótesis es la peor clase de
   medición, y estuvo a punto de pasar por hallazgo.
2. **Un documento y una conexión por caso.** Medía bien, pero a partir del quinto el STS dejaba de
   mandar `intelliSenseReady` y la sonda se colgaba, porque cada caso dejaba una conexión viva.

La sonda hace ahora lo que hace VS Code —una conexión, un documento, cambios incrementales con su
rango— y **se autocomprueba**: si el rango del `textEdit` no varía entre casos, los cambios no se
están aplicando, lo dice y sale con error en lugar de imprimir una tabla redonda que no mide nada.

### 28.7. Lo que hace falta para cerrarlo

Con `DSHB_Navigation` en su base, escribiendo `SELECT * FROM dshb`:

1. ¿Sale la lista de sugerencias, aunque sea sin la tabla? ¿Cuántas entradas trae?
2. Si se baja por la lista hasta el final, ¿está `DSHB_Navigation` en alguna parte?
3. Lo mismo pulsando **Ctrl+Espacio** sobre el hueco, sin escribir nada: ¿aparece?
4. `Ayuda → Alternar herramientas de desarrollo`, o el canal de salida «MSSQL», por si el
   `Completion count=` del middleware de `serviceclient.ts` ya dice que llegan cero.

La 3 es la que más separa: si con Ctrl+Espacio tampoco aparece, el problema es la caché del STS
contra esa base y no tiene nada que ver con mayúsculas.

### 28.8. Lo que esto deliberadamente no hace

- **No deja el middleware «por si acaso».** No arreglaba nada medible y costaba una petición por
  pulsación. Un cambio que no se puede justificar con una medida no se queda.
- **No toca el `sortText`** todavía. Es la hipótesis viva del §28.5, pero antes de escribirla hay que
  saber si la tabla aparece o no aparece.

---

## 29. Las sugerencias no se abrían solas: `offWhenInlineCompletions`

El §28 dejó el problema acotado y abierto: ni el servidor escondía la tabla ni el filtro del editor la
descartaba. Las capturas del usuario cerraron la parte que faltaba, y el problema **era otro**.

### 29.1. Lo que se veía de verdad

Escribiendo `SELECT * FROM navigation` la lista **sí** aparece, y `DSHB_NavigationNodes`,
`DSHB_NavigationNodes_Favorites` y `DSHB_NavigationNodes_Layout` salen con la parte coincidente en
negrita. O sea que el filtro encaja las minúsculas y encaja por el medio del nombre, exactamente como
midió el §28.4.

Lo que no pasaba es que la lista **se abriera sola**. Solo salía pulsando Ctrl+Espacio. El síntoma
«no me sale si escribo en minúsculas» era en realidad «no me sale sin pulsar nada», y la parte de las
mayúsculas era una casualidad de cómo se probó.

### 29.2. La causa

`editor.quickSuggestions.other` viene de fábrica en **`offWhenInlineCompletions`**: mientras haya una
sugerencia en línea visible, VS Code no abre el widget solo. Con Copilot instalado, en un editor de
SQL hay texto fantasma casi todo el rato. Ctrl+Espacio es un disparo explícito y se salta la regla,
de ahí que fuera lo único que funcionaba.

Medido dentro del VS Code real, escribiendo con el comando `type` —el mismo camino que el teclado— y
contando cuántas veces se pide autocompletado:

| Escenario                                                    | Peticiones |
| ------------------------------------------------------------ | ---------- |
| SQL, escribiendo `nav`                                       | 3          |
| SQL, escribiendo `nav`, **con sugerencias en línea activas** | **0**      |
| Lo mismo, con `quickSuggestions.other` en `on`               | 3          |

El cero del medio es el fallo. La tercera fila es el arreglo, verificado en la misma pasada.

### 29.3. El arreglo

Una entrada en `contributes.configurationDefaults` del `package.json`, junto al
`editor.wordSeparators` que el upstream ya pone para `[sql]`:

```json
"[sql]": {
    "editor.wordSeparators": "...",
    "editor.quickSuggestions": { "other": "on", "comments": "off", "strings": "off" }
}
```

Tres cosas de por qué así:

- **Es un valor de fábrica, no un ajuste impuesto.** `configurationDefaults` va **por debajo** de los
  ajustes del usuario: quien prefiera el comportamiento de VS Code solo tiene que escribirlo en su
  `settings.json` y gana el suyo.
- **Solo para `[sql]`.** No se toca el comportamiento en ningún otro lenguaje.
- **`comments` y `strings` se quedan en `off`**, que es lo de VS Code. Proponer nombres de tabla
  dentro de un comentario o de un literal es ruido, y el §24.6 ya tomó esa misma decisión para los
  snippets del fork por su cuenta.

Para un editor de SQL la elección es clara: el texto fantasma de Copilot es una conjetura, y la lista
de objetos es el catálogo real de la base a la que estás conectado.

### 29.4. Lo que sigue necesitando Ctrl+Espacio, y por qué se deja así

Con el hueco vacío —`SELECT * FROM ` y nada escrito— la lista no se abre sola, y **es correcto**: sin
palabra que completar VS Code no dispara, y el STS no declara el espacio como carácter de disparo
(los suyos son `.`, `:`, `\`, `[` y `"`, leídos de sus capacidades). Se podría forzar registrando un
proveedor propio con el espacio entre sus caracteres de disparo, pero eso abriría el widget después
de **cada** espacio del archivo. Es peor que el gesto que ya existe, así que se documenta en lugar de
forzarlo: en el hueco, Ctrl+Espacio; en cuanto escribes una letra, sale sola.

### 29.5. Verificación

| Qué                                           | Estado                       |
| --------------------------------------------- | ---------------------------- |
| Unitarios nuevos (`quickSuggestions.test.ts`) | ✅ 4, contra el VS Code real |
| Suite completa                                | ✅ sin regresiones           |
| `lint` y typecheck                            | ✅                           |

Los cuatro no miran el ajuste, miran la consecuencia: que al escribir se pida autocompletado, que se
siga pidiendo con un proveedor de sugerencias en línea delante —el test que sin el arreglo da cero—,
que el valor de fábrica llegue al editor, y que en el hueco vacío siga sin dispararse, que es lo
correcto y conviene que nadie lo «arregle» sin querer.

Coste en deuda de merge: **ninguna línea del upstream sustituida**. Una clave nueva dentro de un
objeto que ya existía.

### 29.6. Lo que esto deliberadamente no hace

- **No toca `editor.inlineSuggest`** ni nada de Copilot. Las dos cosas conviven: el arreglo es que la
  lista pueda abrirse, no que la otra se calle.
- **No fuerza el disparo por espacio** (§29.4).
- **No cambia el orden de las sugerencias.** La hipótesis del `sortText` del §28.5 sigue sin
  escribirse, y ahora además sin motivo: si la lista se abre sola y el filtro encaja, el orden que
  hay ya sirve. Si algún día molesta, ahí está anotada.

---

## 30. El selector de conexión: servidor y base, siempre a la vista

Petición del usuario: «la forma en como se ve la conexión actual quisiera cambiarla, que sea algo más
como un selector, igual que en dbForge Studio, que solo se cambia el servidor en un combobox y en
otro la bd. Actualmente sale como si fuera una línea 0 en el editor y si me desplazo se deja de ver,
por lo que no puedo cambiar de server o bd sin irme hasta arriba».

### 30.1. Lo que había, medido

El upstream pinta la conexión activa como un **CodeLens en la línea 0**
(`src/queryResult/sqlCodeLensProvider.ts`, `connectionCodeLensRange = new vscode.Range(0, 0, 0, 0)`),
con tres entradas: perfil, servidor y base. Un CodeLens vive en el texto, así que se desplaza con él.

Comprobado levantando el VS Code real contra la instancia de §28.2: arriba del todo se ve
`★IRMA-PRODRPT | localhost,1433 | IRMA_PRODRPT`; al bajar a la línea 87, **no queda nada**.

Y había una segunda mitad que el usuario no había encontrado: el upstream **ya** ponía servidor y
base en la barra de estado (`statusConnection` y `statusChangeDatabase` de `src/views/statusView.ts`),
con los comandos `mssql.connect` y `mssql.changeDatabase` detrás. O sea que el selector existía;
estaba al fondo de la derecha, detrás de `SQLCMD: Off`, `MSSQL`, el indicador de lenguaje, el fin de
línea, la codificación, la sangría y la posición del cursor —y de lo que añada cada extensión
instalada—, que es un sitio donde no se encuentra.

### 30.2. Lo que hace el fork

`src/custom/connection/connectionSelector.ts`: dos elementos de barra de estado **a la izquierda**,
con prioridades 1000 y 999 para que caigan juntos y siempre en el mismo orden.

- `$(server) <servidor>` → `mssql.connect`, con la lista de conexiones.
- `$(database) <base>` → `mssql.changeDatabase`, con la lista de bases del servidor.

Se repintan con el editor activo y con `onConnectionsChanged`, y se esconden fuera de un editor de
SQL, donde no significarían nada. Sin conexión, el primero pasa a `$(plug) Sin conexión` y es el
punto de entrada para conectar; el de la base desaparece, porque no hay ninguna que elegir.

Tres decisiones que no son de estilo:

- **La izquierda, no la derecha.** Es el único sitio de la barra que está casi vacío, así que el par
  cae donde el usuario lo dejó, no donde lo empujen las extensiones que tenga instaladas ese día.
- **Se apaga el CodeLens.** `mssql.query.showActiveConnectionAsCodeLensSuggestion` pasa a `false` de
  fábrica. Es un ajuste declarado: quien lo quiera de vuelta lo enciende y conviven los dos.
- **Se esconde el par del upstream.** Un guardia en `showStatusBarItem` de `statusView.ts`. Sin él,
  servidor y base salen **dos veces** en la misma barra, que fue justo lo que se vio al probarlo.

### 30.3. Por qué la barra de estado y no un panel flotante

Porque no hay otra cosa. Un widget anclado arriba del editor —el sitio donde dbForge pone sus
desplegables— no está en la API de extensiones: lo más cercano es la barra de título del editor, y
ahí solo caben iconos, sin texto que pueda decir a qué servidor estás conectado. Una vista de barra
lateral sí admitiría dos `<select>` de verdad, pero se ve solo si la barra lateral está abierta, que
es justo lo que no pasa mientras se escribe SQL.

La barra de estado es la única parte de la ventana que **siempre** está visible, y un clic abre una
lista filtrable. No es un combobox, pero hace lo que el usuario pedía: cambiar de servidor o de base
desde donde estés, sin subir a ninguna parte.

### 30.4. Verificación

Con el VS Code real, la extensión y la instancia de §28.2, un script de 87 líneas y la base
`IRMA_PRODRPT`:

| Qué                                    | Antes              | Ahora                           |
| -------------------------------------- | ------------------ | ------------------------------- |
| Conexión visible arriba del archivo    | CodeLens línea 0   | —                               |
| Conexión visible en la línea 87        | **nada**           | `localhost,1433`+`IRMA_PRODRPT` |
| Servidor y base duplicados en la barra | —                  | no (guardia de §30.2)           |
| Cambiar de base desde la línea 87      | subir hasta arriba | un clic                         |

Las capturas de las dos columnas están hechas con el mismo guion, cambiando solo el código.

Coste en deuda de merge: **ninguna línea del upstream sustituida**. Un guardia de 6 líneas al
principio de `showStatusBarItem` y el `default` de un ajuste que ya estaba declarado.

### 30.5. Lo que esto deliberadamente no hace

- **No borra el CodeLens del upstream**, solo lo apaga de fábrica. El proveedor sigue ahí y el ajuste
  también, así que un merge no tiene nada que resolver y quien lo prefiera lo recupera.
- **No abre su propia conexión** ni duplica el gestor del upstream (regla 16.2 del brief): los dos
  elementos lanzan los comandos que ya existen.
- **No toca el explorador de objetos**, que es el otro sitio donde se cambia de servidor.

---

## 31. El registro al que apunta una clave ajena

Petición del usuario: «en dbForge, en los resultados, cuando una columna es una FK, puedo abrir un
popup que muestra el registro de esa FK en la tabla dueña».

Clic derecho sobre la celda → **Ver registro referenciado** → un globo encima de la celda con la fila
de la tabla a la que apunta.

### 31.1. Dónde se engancha, y por qué ahí

La rejilla de resultados nueva (`mssql.preview.betaResultsGrid`, **`true` de fábrica**) está escrita
para que le añadan comandos: sus ids son cadenas y su propia documentación dice que los de terceros
lleven prefijo («Consumer-contributed command ids should also be namespaced»). Así que el comando del
fork es `sqlworks.showReferencedRow` y **no hace falta tocar el componente de la rejilla** para que
salga en el menú: se declara una contribución más en la configuración que arma el consumidor.

La rejilla vieja (con el ajuste apagado) se queda fuera **a propósito**. Se llegó a enganchar —el
menú del `GridContextMenu.tsx` y su plugin— y se revirtió: el globo tiene que vivir dentro del
webview, y montarlo también allí era duplicar la mitad de esto por un camino que de fábrica nadie
usa. Si algún día la rejilla vieja vuelve a ser la de serie, esto se añade; mientras tanto, mejor una
cosa entera que dos a medias.

### 31.2. El hallazgo que cambió el diseño

`columnInfo` de cada conjunto de resultados trae `baseSchemaName`, `baseTableName` y
`baseColumnName`. Son exactamente lo que hace falta para saber de qué tabla sale una columna, así
que la primera versión los usó.

**Medido contra el STS 6.0.20260915.1, con `query/executeString` sobre `SELECT * FROM dbo.DSHB_Widget`:**

```
WidgetId      baseSchema=null baseTable=null baseColumn=null isKey=null
NavigationId  baseSchema=null baseTable=null baseColumn=null isKey=null
WidgetTitle   baseSchema=null baseTable=null baseColumn=null isKey=null
```

Los tres a `null` en todas las columnas. La función estaba escrita, compilaba, y el globo decía
siempre «esta columna no participa en ninguna clave ajena» porque nunca sabía de qué tabla venía.

Lo que sí funciona es preguntárselo al servidor:

```
sys.dm_exec_describe_first_result_set(N'SELECT * FROM dbo.DSHB_Widget;', NULL, 1)
  WidgetId     | dbo | DSHB_Widget | WidgetId
  NavigationId | dbo | DSHB_Widget | NavigationId
  WidgetTitle  | dbo | DSHB_Widget | WidgetTitle
```

**No ejecuta nada**: describe el primer conjunto de un lote. El tercer argumento a 1 pide la
información de exploración, que es la que trae `source_schema`, `source_table` y `source_column`.

El texto se saca del documento del resultado. Si es un script con varios lotes se prueban los lotes
separados por `GO`, del último al primero —en un script de migración lo que se acaba de ejecutar
suele estar al final—. Si aun así no encaja, el globo lo **dice**, en lugar de enseñar la fila de una
tabla adivinada.

### 31.3. Las tres consultas, y qué protege cada una

1. **De qué tabla sale la columna** (`describeResultColumnsQuery`): el texto de la consulta va como
   literal escapado.
2. **Qué clave ajena es** (`foreignKeyForColumnQuery`): esquema, tabla y columna pasan por
   `quoteIdentifier` de `util/identifiers.ts`, que valida contra el patrón cerrado del §19.2 y
   **aborta** si no encaja. Regla 11.2 del brief.
3. **La fila** (`referencedRowQuery`): la sentencia que lee va con `sp_executesql` y el valor entra
   como **`@valor`**, no pegado al `WHERE`.

El valor de la celda es el único dato que no es un identificador: puede ser cualquier texto. Se
escribe como literal Unicode con las comillas simples dobladas, que es **el** escape de un literal de
cadena en T-SQL —no hay otro—, así que con `QUOTED_IDENTIFIER ON` no puede salirse de sus comillas.
Hay un test que lo fija con el intento clásico: `x'; DROP TABLE t; --` sale como
`N'x''; DROP TABLE t; --'`, un literal y nada más.

`TOP (2)` y no `TOP (1)`: si la columna referenciada no fuera única, quien llama tiene que poder
notarlo en vez de enseñar la primera fila como si fuera la única.

### 31.4. Un globo, no un panel

La primera versión abría un panel de editor al lado. Funcionaba y estaba mal: no es lo que hace
dbForge ni lo que se pidió. Un panel roba espacio, se queda abierto y hay que ir a cerrarlo; lo que
se quiere es mirar una fila y seguir.

El globo vive **dentro del webview de resultados**, que es lo que permite anclarlo a la celda: desde
el host no hay forma de poner nada flotando sobre un webview. Se ancla en el punto del clic derecho,
que se recuerda con un escucha de `contextmenu` en captura, porque el evento de comando de la rejilla
no lleva coordenadas.

Eso obligó a un cambio pequeño en la rejilla: `commandContext.cell` **solo lo rellenaba el doble
clic** (`OpenCell`), así que un comando del menú de celda no sabía sobre qué celda se había pulsado.
Ahora el menú lo lleva. Son seis líneas y un helper, y es un arreglo del componente, no un parche: un
menú _de celda_ que no sabe su celda es un hueco suyo.

### 31.5. El registro va en horizontal, no en vertical

La primera versión listaba los campos uno por línea, como una hoja de propiedades. Con la tabla de
prueba —tres columnas— se veía bien; con una tabla real no.

Una tabla de treinta columnas convierte esa lista en una columna larguísima que tapa los resultados y
obliga a desplazarse hacia abajo dentro del globo para llegar al final. Y las tablas de un tablero
tienen treinta columnas.

Así que el registro se pinta **como una fila de rejilla**: nombre arriba, valor debajo, campos uno al
lado del otro, y desplazamiento lateral. La altura es siempre la misma, dos líneas, tenga la tabla
tres columnas o cuarenta; lo que crece es el ancho, acotado a `min(720px, 92vw)` para que el globo no
se salga de la ventana.

Dos detalles que hacen falta para que eso se lea:

- **Cada campo se recorta con puntos suspensivos** y lleva el valor entero en el `title`, así que un
  `NVARCHAR(400)` no ensancha el globo pero se puede ver pasando el ratón.
- **`minWidth: 0` en el contenedor.** Sin eso, un flex dentro de un contenedor con ancho máximo no se
  deja encoger: el contenido se desborda hacia fuera en lugar de convertirse en desplazamiento, que
  es exactamente el fallo que se quería evitar.

Comprobado con la tabla referenciada ampliada a 13 columnas: el globo mantiene su altura, aparece la
barra lateral, y a la derecha se llega a `Descripcion`, `CreadoPor` y `ModificadoEn`.

### 31.6. Cuando no hay registro que enseñar

Nunca se queda en blanco ni «no hace nada». Cada final dice qué pasó:

| Situación                                  | Qué se ve                                        |
| ------------------------------------------ | ------------------------------------------------ |
| La columna no es clave ajena               | Se dice, con el nombre de la columna             |
| La clave ajena es de varias columnas       | Se dice, con el nombre de la restricción         |
| El valor de la celda es `NULL`             | Se dice: no apunta a ninguna fila                |
| La fila no está                            | Se dice, con la tabla: borrada, o sin integridad |
| No se pudo saber de qué tabla sale (§31.2) | Se dice, y se sugiere ejecutar solo el `SELECT`  |

Con una clave compuesta **no se consulta nada**: adivinar las otras columnas sería enseñar una fila
que quizá no es la que apunta.

### 31.7. Verificación

| Qué                                        | Estado                                         |
| ------------------------------------------ | ---------------------------------------------- |
| Unitarios nuevos (`referencedRow.test.ts`) | ✅ 16, sobre el texto que se manda al servidor |
| Suite completa                             | ✅ sin regresiones                             |
| Contra SQL Server real, en el VS Code real | ✅ ver abajo                                   |
| `lint` y los dos typechecks                | ✅                                             |

Probado de punta a punta contra la instancia de §28.2, con
`dbo.DSHB_Widget.NavigationId → dbo.DSHB_NavigationNodes.NavigationId`: clic derecho sobre la celda
con valor 2, «Ver registro referenciado», y el globo sale sobre la celda con `NavigationId 2`,
`DSHB_Title Informes de ventas`, `NavigationOrder 2`, con la columna de enlace destacada.

Coste en deuda de merge: **ninguna línea del upstream sustituida**. Cuatro archivos suyos con
añadidos marcados con `// [FORK]`.

### 31.8. Lo que esto deliberadamente no hace

- **No navega en cadena.** El globo enseña la fila y se cierra; no permite saltar desde ahí a la
  siguiente clave ajena. Es lo siguiente que pediría cualquiera, pero ata el diseño a un historial y
  conviene ver antes si esto se usa.
- **No enseña las filas que apuntan _hacia_ esta** (el camino inverso, de padre a hijos). Es otra
  función, y con otro coste: son muchas filas, no una.
- **No toca la rejilla vieja** (§31.1).
- **No cachea nada.** Cada apertura son tres consultas de catálogo, que contra el servidor de la
  conexión son inmediatas. Si algún día molesta, se cachea el resultado de §31.2 por documento.

## 32. Confirmar en verde y descartar en rojo: el par del editor de datos

Se pidió «el inline editor de dbForge: poder editar varias celdas a la vez, y luego con un botón de
una flechita en verde confirmar los cambios, o con una equis en rojo rechazarlo».

### 32.1. Qué había ya, medido

**La edición de varias celdas ya estaba**, y funciona. Es el Table Explorer del upstream («Edit
Table Data…» en el menú de una tabla): abre una sesión de edición contra el STS (`edit/initialize`),
cada celda que se toca se manda como `edit/updateCell`, se queda marcada en la rejilla, y **nada
llega a la tabla** hasta que se pulsa guardar, que es un `edit/commit`. Comprobado contra el
servidor de §28.2: dos celdas editadas, la tabla sin tocar hasta el final.

Lo que no estaba es la mitad de descartar. Había revertido —`edit/revertRow` y `edit/revertCell`,
con su reducer y su llamada— pero solo se llegaba a él **fila por fila**: el botón de deshacer de la
fila, o su menú contextual. Con quince celdas tocadas en cinco filas, dejarlo eran cinco viajes.

Y el botón que sí había, «Save Changes», era un icono de disquete gris entre otros nueve iconos
grises. No decía cuántos cambios había ni se distinguía de «Export» de un vistazo.

### 32.2. Lo que hace el fork

Dos botones al principio de la barra, con la cuenta de cambios pendientes en los dos:

| Botón                | Qué hace                                               | Toca el servidor |
| -------------------- | ------------------------------------------------------ | ---------------- |
| ✅ **Confirmar (n)** | `edit/commit`: aplica todo lo montado                  | Sí               |
| ❌ **Descartar (n)** | Revierte todo lo pendiente y deja la tabla como estaba | No               |

Sin cambios pendientes los dos salen deshabilitados, pero **siguen ahí**: un botón que aparece y
desaparece mueve el resto de la barra de sitio, y entonces se pulsa lo que no es.

El verde y el rojo salen del tema (`--vscode-testing-iconPassed`, `--vscode-errorForeground`), no
fijados a mano: hay temas claros, oscuros y de alto contraste, y un `#3fb950` a pelo se pierde en
alguno.

### 32.3. Por qué descartar vive en la rejilla y no en el botón

La primera versión hacía lo obvio: leer del estado qué filas tenían algo pendiente y llamar al
reducer `revertRow` de cada una. **Contra el servidor real se vio que no bastaba**, en dos pasos:

1. Miraba `row.isDirty`, pero el reducer `updateCell` del upstream marca `isDirty` en la **celda**,
   no en la fila. El botón no encontraba nada que descartar y se quedaba sin hacer nada. Compilaba
   igual, porque `EditRow` declara las dos banderas.
2. Arreglado eso, los valores **sí** volvían a su sitio… y la barra seguía diciendo «Descartar (2)»
   con las dos celdas resaltadas. La cuenta y el resaltado no salen del estado: son de la rejilla,
   que los lleva en refs propias (`cellChangesRef`, `deletedRowsRef`, `newRowIdsRef`). Un revertido
   hecho desde fuera no las toca.

La segunda versión recargaba el subconjunto después de revertir, para forzar el refresco. Funcionaba
a medias y era un rodeo: reiniciaba la sesión de edición para arreglar un contador.

Lo que hay ahora no da ese rodeo. La rejilla **ya tenía** un `revertRow(rowId)` interno —el del
botón de deshacer de la fila— que hace las cuatro cosas en orden: llama al STS, limpia el
seguimiento de esa fila, avisa de la nueva cuenta e invalida el pintado. Descartar es ese mismo
camino, una vez por fila pendiente, expuesto en el ref de la rejilla como `revertAllPendingRows()`.
Así la cuenta llega a cero **porque cada revertido la fue bajando**, no porque nadie la ponga a
cero; y el resaltado se va por donde se va siempre.

Qué filas entran y en qué orden lo decide `pendingRowIds()`, en el fork y aparte de React para que
lo alcancen los unitarios. Tres orígenes —celdas editadas, filas marcadas para borrar, filas nuevas—
y **orden descendente**, que no es cosmético: revertir una fila nueva la saca del conjunto, así que
ir de abajo arriba deja quietos los identificadores de las que faltan.

### 32.4. Por qué descartar no pregunta

Porque no toca el servidor. La regla del §22 —vista previa, confirmación y transacción— es para lo
que **escribe**. Descartar es lo contrario: tira lo que aún no se ha escrito, y lo que queda es lo
que hay en la tabla. Un diálogo ahí sería fricción en la acción segura. Confirmar sí escribe, y para
eso está el otro botón.

### 32.5. Verificación

| Qué                                         | Estado                                            |
| ------------------------------------------- | ------------------------------------------------- |
| Unitarios nuevos (`pendingChanges.test.ts`) | ✅ 6, sobre qué filas se revierten y en qué orden |
| Suite completa                              | ✅ sin regresiones                                |
| Contra SQL Server real, en el VS Code real  | ✅ los dos caminos, ver abajo                     |
| `lint` y los dos typechecks                 | ✅                                                |

De punta a punta contra la instancia de §28.2, sobre `dbo.DSHB_NavigationNodes`:

- **Descartar**: se editan dos celdas (`Informes de ventas` → `Informes de ventas (2026)` y
  `Indicadores` → `Indicadores clave`), la barra pasa a «Confirmar (2) / Descartar (2)» con las dos
  celdas resaltadas; se pulsa descartar y vuelven los valores, la cuenta desaparece de los dos
  botones, el resaltado se va y los botones quedan deshabilitados.
- **Confirmar**: las mismas dos ediciones, se pulsa confirmar, sale «Changes saved successfully» y
  `SELECT` directo contra la tabla —desde fuera de VS Code— devuelve los valores nuevos.

Coste en deuda de merge: el botón «Save Changes» del upstream **sustituido** por el par (es
exactamente lo que se pidió cambiar), y tres archivos suyos con añadidos marcados con `// [FORK]`.

### 32.6. Lo que esto deliberadamente no hace

- **No descarta media edición.** Es todo o nada. Para una sola fila ya está el botón de deshacer de
  la fila, que es de donde sale este.
- **No pregunta antes de descartar** (§32.4).
- **No cambia la rejilla de resultados de consulta**, que no tiene sesión de edición detrás: allí
  editar en línea es otro problema, no un botón. Ver §33.

## 33. Editar en línea los resultados de una consulta

Del §32: «pero solo funciona para el table explorer; si hago un query y lo ejecuto, no funciona el
inline editor».

Cierto, y esa era la mitad que faltaba. El editor en línea existía solo colgando del árbol de
objetos, sobre una tabla entera. Quien ejecuta `SELECT … WHERE …` y quiere corregir tres celdas de
lo que está mirando no tenía camino: copiar los valores, escribir un `UPDATE` y ejecutarlo.

### 33.1. Lo que hace el fork

Clic derecho en la rejilla de resultados → **«Editar estos resultados»**. Se abre el editor de datos
—el mismo del §32, con su par confirmar/descartar— **atado a la consulta que se ejecutó**.

No a la tabla entera: a la consulta. Si se ejecutó
`SELECT NavigationId, DSHB_Title, Icono FROM dbo.DSHB_NavigationNodes WHERE NavigationId >= 2`, el
editor abre esas tres columnas y esas dos filas. El filtro y el orden que escribió el usuario siguen
puestos, que es de lo que se trata: abrir `SELECT TOP 100 *` de la tabla sería otro conjunto de
filas y habría que volver a filtrar a mano.

### 33.2. Por qué esto no fue rehacer la rejilla de resultados

La opción obvia —hacer editable la rejilla de resultados en su sitio, sin abrir nada— es mucho más
cara de lo que parece, y la razón es de fondo: **la rejilla de resultados no tiene detrás una sesión
de edición**. Se llena con `query/subset`, que devuelve filas de una ejecución ya terminada, sin
identidad de fila ni forma de volver a escribirlas. El editor de datos se llena con `edit/subset`,
que es otra cosa: una sesión abierta contra una tabla, con identificadores de fila, `edit/updateCell`
y `edit/commit`.

Hacer editable la rejilla es montar la segunda debajo de la primera y casar fila a fila dos
conjuntos que el servidor devolvió por caminos distintos, con su paginación, su orden y sus filtros
propios. Es un proyecto, y con un modo de fallar especialmente malo: escribir en la fila equivocada.

Lo que sí ofrece el STS es un `queryString` en `edit/initialize`: **una sesión de edición atada a
una consulta**. Y el Table Explorer ya lo usa —es como aplica sus propios filtros—. Así que el
camino corto no es un apaño: es el mecanismo que ya existe, abierto desde donde faltaba.

### 33.3. De dónde sale el texto exacto de la consulta

Del documento, por el rango del lote. El `QueryRunner` del upstream guarda en cada `BatchSummary` la
`selection` —línea y columna de inicio y fin— del lote que ejecutó, así que el texto es **el que se
ejecutó**, no una reconstrucción ni una adivinanza. Es una mejora sobre lo que hace §31, que prueba
los lotes del último al primero porque el globo no sabe de qué lote venía la celda.

Si no hay rango se usa el documento entero, que es lo correcto cuando el documento es una sola
sentencia.

### 33.4. Qué se comprueba antes de abrir

Una sesión de edición es **de una tabla**. Antes de abrir nada se le pregunta al servidor de qué
tablas salen las columnas, con el mismo `sys.dm_exec_describe_first_result_set` del §31.2:

| Lo que devuelve el servidor           | Qué pasa                                          |
| ------------------------------------- | ------------------------------------------------- |
| Todas las columnas de una misma tabla | Se abre el editor sobre ella, atado a la consulta |
| Columnas de varias tablas (una unión) | No se abre nada y se dice de qué tablas salen     |
| Ninguna columna sale de una tabla     | No se abre nada: agregados, literales, calculadas |
| El servidor no pudo describir el lote | No se abre nada y se da su mensaje                |

**Las columnas sin tabla no cuentan como «otra tabla»**, y esto importa más de lo que parece:
`SELECT id, nombre, GETDATE() AS ahora FROM cliente` es perfectamente editable, y contar la columna
calculada como una segunda tabla dejaría fuera media docena de consultas corrientes.

Se podría abrir siempre y dejar que fallara el STS. Pero entonces el usuario ve una pestaña vacía
con un error del servidor en inglés, en lugar de una frase que dice por qué su consulta no se puede
editar.

### 33.5. El nodo que no existe

El controlador del Table Explorer del upstream espera un nodo del árbol de objetos. Aquí no hay
ninguno: el resultado viene de una consulta escrita a mano, y esa tabla puede estar sin desplegar en
el árbol, o el árbol cerrado. Así que el nodo se arma con lo único que el controlador le pide —el
nombre, el esquema, el tipo, el perfil de conexión y un padre que diga la base—, en lugar de buscar
en el árbol algo que puede no estar cargado.

### 33.6. Verificación

| Qué                                           | Estado                                         |
| --------------------------------------------- | ---------------------------------------------- |
| Unitarios nuevos (`editQueryResults.test.ts`) | ✅ 6, sobre de qué tabla salen unos resultados |
| Suite completa                                | ✅ sin regresiones                             |
| Contra SQL Server real, en el VS Code real    | ✅ los dos caminos, ver abajo                  |
| `lint` y los dos typechecks                   | ✅                                             |

De punta a punta contra la instancia de §28.2:

- **Se puede editar**: ejecutada
  `SELECT NavigationId, DSHB_Title, Icono FROM dbo.DSHB_NavigationNodes WHERE NavigationId >= 2`,
  clic derecho → «Editar estos resultados» abre el editor con **esas tres columnas y esas dos
  filas** («1 - 2 of 2»). Se edita una celda, se pulsa confirmar, sale «Changes saved successfully»
  y un `SELECT` desde fuera de VS Code devuelve el valor nuevo.
- **No se puede editar**: ejecutada una unión de `DSHB_Widget` con `DSHB_NavigationNodes`, el mismo
  menú no abre nada y avisa: «Estos resultados salen de varias tablas (dbo.DSHB_Widget,
  dbo.DSHB_NavigationNodes) y el editor trabaja sobre una».

Coste en deuda de merge: **ninguna línea del upstream sustituida**. Cuatro archivos suyos con
añadidos marcados con `// [FORK]`, y de ellos el único con lógica es un parámetro opcional en el
constructor del Table Explorer: sin él, todo sigue exactamente como estaba.

### 33.7. Lo que esto deliberadamente no hace

- **No hace editable la rejilla de resultados en su sitio** (§33.2). Se abre el editor, que es una
  pestaña más. Si algún día se quiere en el mismo panel, el trabajo está en casar las dos sesiones,
  no en este comando.
- **No intenta editar uniones** partiendo el resultado por tablas. Se dice que no y ya.
- **No trae más filas de las que trae el editor**: las primeras 100, como al abrirlo desde el árbol.
  El desplegable de la barra sigue mandando.
- **No aparece deshabilitado cuando el conjunto no es editable.** Saberlo de antemano es una consulta
  al servidor por cada menú que se abre; se prefiere abrir el menú al instante y explicar al pulsar.
