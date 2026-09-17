# SQLWorks

Cliente de SQL Server para Visual Studio Code, de distribución interna.

SQLWorks es un fork de la extensión [MSSQL for Visual Studio Code](https://github.com/microsoft/vscode-mssql)
de Microsoft. Conserva todo lo que hace la extensión oficial y le añade tres cosas:

1. **Administración** de servidores, bases de datos y usuarios.
2. Una **biblioteca de snippets** de consultas, con carpeta configurable y compartible por red.
3. Un **formateador de T-SQL** configurable por perfil XML, con vista previa.

> **No instales SQLWorks y la extensión MSSQL oficial a la vez.** Las dos declaran los mismos
> identificadores de comandos (`mssql.*`), y VS Code no sabría a cuál llamar. Desinstala la
> oficial antes.

## Qué conserva del upstream

Todo el motor viene del [SQL Tools Service](https://github.com/microsoft/sqltoolsservice), así que
sigue funcionando igual:

- Conexiones con autenticación SQL, integrada y Microsoft Entra ID.
- Explorador de objetos, IntelliSense de T-SQL y ejecución de consultas.
- Rejilla de resultados, exportación a CSV, JSON, Excel e INSERT.
- Scripting de objetos, planes de ejecución e historial de consultas.
- Diseñador de tablas, comparación de esquemas, diseñador de esquemas y proyectos de base de datos.

## Diferencias frente a la extensión oficial

|                   | Oficial                                         | SQLWorks                                            |
| ----------------- | ----------------------------------------------- | --------------------------------------------------- |
| Telemetría        | Application Insights                            | **Eliminada.** Sin ninguna vía de red de telemetría |
| SQL Tools Service | Se descarga en el primer arranque               | **Incluido en el `.vsix`**, autocontenido           |
| Runtime de .NET   | Requiere `ms-dotnettools.vscode-dotnet-runtime` | No hace falta                                       |
| Distribución      | Marketplace público                             | Archivo `.vsix` interno                             |

## Requisitos

- Visual Studio Code 1.105.0 o superior.
- Nada más. El servicio de fondo va dentro del paquete.

## Instalación

Desde la interfaz de VS Code: **Extensiones** → menú `...` → **Install from VSIX...** y elige el
archivo.

O desde la línea de comandos:

```bash
code --install-extension sqlworks-0.1.0-win-x64.vsix
```

Cada `.vsix` es específico de una plataforma, porque lleva el servicio de fondo dentro. Elige el
que corresponda a tu sistema.

## Desarrollo

Requiere **Node.js 24 o superior**. Desde la raíz del repositorio:

```bash
npm install
npm run build -- --target mssql
npm test    -- --target mssql
```

Para depurar, `npm run watch -- --target mssql` y después **Run All Extensions** en la vista de
ejecución y depuración de VS Code.

Para generar el paquete, con el proyecto ya construido:

```bash
cd extensions/mssql
node scripts/package-fork.js --platform win-x64
```

[DEVELOPMENT.md](https://github.com/AlfredC1403/vscode-mssql/blob/main/DEVELOPMENT.md) tiene el
detalle de los comandos del monorepo, y
[FORK.md](https://github.com/AlfredC1403/vscode-mssql/blob/main/FORK.md) documenta la estructura
del upstream, las reglas de aislamiento del código propio y la lista de verificación de paridad.

## Licencia y atribución

SQLWorks deriva de `microsoft/vscode-mssql`, publicado bajo licencia MIT. Se conservan intactos
el aviso de copyright de Microsoft en [LICENSE.txt](LICENSE.txt) y las atribuciones de terceros en
[ThirdPartyNotices.txt](ThirdPartyNotices.txt). El aviso de copyright propio del fork está en
[NOTICE.md](https://github.com/AlfredC1403/vscode-mssql/blob/main/NOTICE.md).

Ni el nombre ni los logotipos de Microsoft están cubiertos por la licencia MIT: SQLWorks no los
usa ni los redistribuye. No es un producto de Microsoft y Microsoft no lo respalda.
