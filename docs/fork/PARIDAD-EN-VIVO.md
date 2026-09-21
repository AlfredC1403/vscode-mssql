# La lista de paridad contra un servidor de verdad

Este documento es el recorrido que hace **el usuario, en su máquina Windows, contra su SQL Server**.
No lo puede correr nadie más: todo lo que hay medido hasta ahora salió de un contenedor Linux con
SQL Server 2022 en Docker y de la suite e2e bajo `xvfb` (FORK.md §13), y quedan dos huecos que ese
entorno no puede tapar —la **autenticación integrada**, que necesita un dominio Kerberos (§13.2,
fila 1b), y el **comportamiento del `.vsix` instalado en Windows de verdad**—.

Además, el §28 dejó una condición escrita para dar por cerrado el segundo merge con el upstream:

> **Queda pendiente, y es la condición para dar este merge por cerrado del todo:** correr la lista
> de paridad contra un servidor de verdad, con atención a M3–M6, que son los que hablan con el motor.

Eso es lo que cierra este recorrido.

## 1. Antes de empezar

1. **Instala el `.vsix`.** Es el de `win-x64`, con el SQL Tools Service dentro: no descarga nada al
   arrancar y no necesita el runtime de .NET en la máquina.

    ```powershell
    code --install-extension sqlworks-0.1.0-win-x64.vsix
    ```

    o en VS Code: `Extensiones` → `…` → `Install from VSIX…`.

2. **Desactiva la extensión oficial de Microsoft (`ms-mssql.mssql`) mientras dure el recorrido**, si
   la tienes instalada. Las dos registran el mismo lenguaje y los mismos menús del explorador de
   objetos, y si están las dos no se sabe cuál contestó. No hace falta desinstalarla: `Deshabilitar`
   y recargar la ventana basta.

3. **Siembra la base de prueba** con `scripts/fork/paridad-en-vivo/01-sembrar.sql`. Crea `ParityDb`
   con el mismo juego de datos que se usó en el contenedor, que es lo que esperan las filas de abajo:
   el esquema `ventas`, el login `parity_user`, el usuario sin login `analista`, la cadena
   `analista → ventas_supervisores → ventas_lectores` y el `DENY` sobre la columna `Email`. Hace
   falta ser sysadmin y hay que editar la contraseña de la primera línea.

    Si el servidor donde vas a probar **no** admite que se siembre nada, se puede recorrer casi
    todo igual contra una base que ya exista; las filas que dependen del sembrado van marcadas con
    **(sembrado)** y hay que saltarlas o adaptarlas.

4. **Apunta lo que dice el servidor** antes de nada, que es la referencia de todo lo demás:

    ```sql
    SELECT @@VERSION AS version,
           SERVERPROPERTY('Edition') AS edicion,
           SERVERPROPERTY('Collation') AS intercalacion,
           SERVERPROPERTY('IsIntegratedSecurityOnly') AS solo_windows;
    ```

## 2. Cómo se anota

Cada fila lleva una columna **Estado** vacía. Se rellena con:

- **✅** hizo lo que dice la columna «Qué tiene que salir».
- **❌** no lo hizo. Entonces lo que importa es **qué salió en su lugar**: el texto del error tal cual,
  y si se puede, el canal de salida de VS Code (`Ver` → `Salida`, canal `MSSQL`).
- **⚠️** lo hizo a medias, o hubo que hacer algo que el documento no dice.
- **—** no se pudo probar aquí (por ejemplo, no hay dominio, o el servidor no deja escribir).

Lo que se devuelve no tiene que ser este archivo rellenado: vale con contar por el hilo qué filas
fallaron y qué salió. De pasarlo a `FORK.md` (§13.2 y §28) se encarga Claude.

## 3. Parte A — la lista de paridad del §13

Son las nueve filas del §13.2. Ocho estaban verificadas contra el contenedor; lo que este recorrido
añade es que se verifiquen **en Windows, contra un servidor de verdad y sobre el `.vsix` instalado**,
y que se pueda cerrar la única que nadie ha ejercitado nunca (1b).

| #   | Qué hacer                                                                                          | Qué tiene que salir                                                                                                                    | Estado |
| --- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Conectar con **autenticación SQL** (por ejemplo, con `parity_user`)                                | Conecta y el nodo del servidor se expande                                                                                              |        |
| 1b  | Conectar con **autenticación integrada** (Windows) contra un servidor del dominio                  | Conecta sin pedir contraseña. **Esta es la fila que nunca se ha probado**: si falla, el error completo es lo más valioso del recorrido |        |
| 2   | Explorador de objetos: abrir servidor → `ParityDb` → Tablas, Vistas, Procedimientos, Seguridad     | Salen `ventas.Cliente`, `ventas.Pedido`, `ventas.vPedidoCliente`, `ventas.ObtenerPedidos`, y las columnas con su tipo y la PK          |        |
| 3   | En una ventana de consulta sobre `ParityDb`, escribir `SELECT * FROM ventas.` y esperar a la lista | IntelliSense propone `Cliente`, `Pedido` y `vPedidoCliente` (objetos de verdad, no una lista fija)                                     |        |
| 4   | Ejecutar `SELECT * FROM ventas.Cliente; PRINT 'hola'; SELECT * FROM ventas.Pedido;`                | Dos rejillas de resultados y los mensajes, incluidos el `PRINT` y los «rows affected»                                                  |        |
| 5   | Sobre esos resultados, exportar a **CSV** y a **JSON**                                             | Los dos archivos se escriben y el contenido se corresponde con la rejilla                                                              |        |
| 6   | Clic derecho sobre `ventas.Cliente` → `Script as Create`, y lo mismo sobre `ventas.ObtenerPedidos` | Sale `CREATE TABLE [ventas].[Cliente]` y `CREATE PROCEDURE [ventas].[ObtenerPedidos]`                                                  |        |
| 7   | Con la consulta de la fila 4, pedir el **plan de ejecución estimado**                              | Se dibuja el plan y responde al zoom y a las propiedades de un nodo                                                                    |        |
| 8   | Abrir el **historial de consultas** después de ejecutar unas cuantas                               | Están las consultas ejecutadas, y al pulsar una se vuelve a abrir                                                                      |        |

> La fila 8 ya la cerraste tú una vez en Windows sobre el `.vsix` renombrado (§13.2). Aquí se repite
> porque el `.vsix` es otro: lleva el segundo merge con el upstream encima.

## 4. Parte B — lo que añade el fork

Esto es lo que el §28 pedía mirar con atención: M3–M6 son los que hablan con el motor, y el motor de
verdad no es el del contenedor.

### B.1. Que la extensión es la nuestra (M1)

| #   | Qué hacer                                                         | Qué tiene que salir                                                                        | Estado |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ |
| B1  | Mirar la extensión instalada en la lista de VS Code               | **SQLWorks**, versión `0.1.0`, editor `alfredc1403`. Nada que diga Microsoft ni `ms-mssql` |        |
| B2  | Conectar por primera vez **sin `dotnet` instalado** en la máquina | Conecta igual: el SQL Tools Service va dentro del paquete y no se descarga nada            |        |
| B3  | `Ver` → `Salida`, canal `MSSQL`, desde el arranque                | No aparece ninguna descarga del servicio, ni nada de telemetría                            |        |

### B.2. El panel de administración (M2, M3)

Se abre desde la paleta de comandos (`Ctrl+Shift+P`) con **`SQLWorks: Administración`**, con un
servidor seleccionado en el explorador de objetos. Las pestañas van en dos grupos: **Servidor**
(Resumen, Logins, Roles de servidor, Permisos, Instancia, Sesiones) y **Base de datos** (Usuarios,
Roles, Esquemas, Permisos).

| #   | Qué hacer                                                                 | Qué tiene que salir                                                                                                                 | Estado |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| B4  | Abrir el panel con el servidor seleccionado                               | Se abre con el título `Administración · <servidor>` y el resumen dice a qué conexión apunta                                         |        |
| B5  | Pestaña **Instancia**                                                     | Versión, edición e intercalación **coinciden con la consulta del paso 1.4**, y el modo de autenticación es el que tiene el servidor |        |
| B6  | Pestaña **Logins** **(sembrado)**                                         | Sale `parity_user` como «Login SQL» con el rol `dbcreator`, y los logins de Windows salen como grupo o usuario de Windows           |        |
| B7  | Pestaña **Roles de servidor**                                             | Están `sysadmin` y `public`; **no** aparece ninguna fila `##MS_…`                                                                   |        |
| B8  | Pestaña **Permisos** (servidor)                                           | `CONNECT SQL` sale como «Concedido», con el objeto resuelto y no como un número                                                     |        |
| B9  | Buscador de cualquier sección: escribir `parity` **(sembrado)**           | Queda `parity_user` y desaparecen los demás                                                                                         |        |
| B10 | Conectar con un login **sin permisos de administración** y abrir el panel | Las secciones que ese login no puede leer salen con su aviso; **el panel no se queda en blanco** ni tira la pestaña entera          |        |

### B.3. Sesiones (M3)

| #   | Qué hacer                                                                                              | Qué tiene que salir                                                                                                                              | Estado |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| B11 | Pestaña **Sesiones**                                                                                   | Sale la lista real del servidor y **la del propio panel va marcada como «Esta sesión»**, con su botón de terminar deshabilitado                  |        |
| B12 | Abrir en SSMS una consulta con `BEGIN TRAN; UPDATE ventas.Cliente SET Nombre = Nombre;` y no confirmar | Esa sesión sale con el **tiempo** de transacción abierta corriendo (`4 s`, `1 min`…), no con un número de transacciones                          |        |
| B13 | Pulsar terminar sobre **esa** sesión                                                                   | Sale el diálogo con la identidad de la sesión, la sentencia `KILL <n>;`, la palabra «irreversible» y el aviso de que se revertirá la transacción |        |
| B14 | Confirmar                                                                                              | La sesión desaparece de la lista y SSMS dice que la conexión se cerró; la transacción quedó revertida                                            |        |

> **Solo sobre una sesión que hayas abierto tú.** `KILL` no tiene vuelta atrás y no se puede meter en
> una transacción.

### B.4. Seguridad de la base de datos y la matriz de permisos (M4) **(sembrado)**

Con el panel abierto, en el grupo **Base de datos**, y el selector apuntando a `ParityDb`.

| #   | Qué hacer                                   | Qué tiene que salir                                                                                                                                             | Estado |
| --- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| B15 | Pestaña **Usuarios**                        | `parity_user` con su login del servidor, `analista` **sin login** y con `ventas_supervisores`, y los usuarios del sistema marcados como tales                   |        |
| B16 | Pestaña **Roles**                           | `ventas_lectores` con dos miembros, y uno de ellos es **otro rol** (`ventas_supervisores`)                                                                      |        |
| B17 | Pestaña **Esquemas**                        | `ventas`, con propietario `dbo`                                                                                                                                 |        |
| B18 | Pestaña **Permisos**, usuario `analista`    | `INSERT` sobre el esquema `ventas` dice **«Hereda de ventas_supervisores»**, y `SELECT` dice **«Hereda de ventas_supervisores, que hereda de ventas_lectores»** |        |
| B19 | Pestaña **Permisos**, usuario `parity_user` | `CONNECT` dice **«Propio»**, y sobre `ventas.Cliente` aparece el **`DENY` de la columna `Email`**, no un `DENY` de la tabla entera                              |        |
| B20 | Cambiar el selector a `master`              | La sección se recarga y `ventas` ya no está en los esquemas                                                                                                     |        |

Esta parte es la que más depende del motor: la herencia la calcula el fork, no el servidor (§21.3).
Si tu servidor tiene cadenas de roles más largas o más raras que la sembrada, **merece la pena
mirarlas aquí**: es exactamente el caso que el contenedor no podía inventar.

### B.5. La puerta de escritura (M5)

**Nada de esto contra un servidor que importe.** Si el servidor está marcado en
`sqlworks.productionServers`, el panel lo dice y exige escribir su nombre antes de aplicar; esa es
la fila B24.

| #   | Qué hacer                                                                                                       | Qué tiene que salir                                                                                                          | Estado |
| --- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| B21 | Montar un cambio cualquiera (por ejemplo, quitar a `analista` de `ventas_supervisores`) y abrir la vista previa | El cajón de cambios pendientes muestra la sentencia exacta, envuelta en `SET XACT_ABORT ON` y `BEGIN TRANSACTION`            |        |
| B22 | **Cancelar** en el diálogo de confirmación                                                                      | No se ejecuta nada: al recargar la sección, la pertenencia sigue como estaba                                                 |        |
| B23 | Montar un cambio **destructivo** (borrar un rol de prueba) y confirmar el primer diálogo                        | Detrás hay una **segunda** barrera que pide escribir algo a mano; cancelando ahí tampoco se ejecuta nada                     |        |
| B24 | Añadir el servidor a `sqlworks.productionServers` en los ajustes y volver a montar un cambio                    | Sale la insignia de producción, y **hasta un cambio reversible** pide escribir el nombre del servidor                        |        |
| B25 | Aplicar de verdad un cambio inocuo en `ParityDb`                                                                | El informe dice **aplicado**, y al recargar la sección el catálogo lo refleja                                                |        |
| B26 | Montar **dos** cambios donde el segundo falle seguro (crear un rol que ya existe) y aplicar                     | El informe dice **revertido**, con el paso que falló y el número de error del motor, y **el primero tampoco queda aplicado** |        |

### B.6. Crear principales y contraseñas (M6)

| #   | Qué hacer                                                         | Qué tiene que salir                                                                                                      | Estado |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| B27 | Crear un login desde el panel                                     | El formulario **no tiene caja de contraseña**; el script de la vista previa muestra `N'<contraseña>'` y no la contraseña |        |
| B28 | Aplicar, y escribir la contraseña en la caja que aparece entonces | La caja es de tipo contraseña de verdad (se ve en puntos), y el login se crea                                            |        |
| B29 | Conectar con ese login nuevo                                      | Conecta con **esa** contraseña, incluidos los caracteres raros si le pusiste alguno                                      |        |
| B30 | Repetir el alta con un login que **ya exista**                    | Falla y **el mensaje del error no contiene la contraseña**                                                               |        |
| B31 | Borrar lo que hayas creado, desde el panel                        | Se borra, y si el rol tiene miembros el motor lo dice en lugar de dejarlo a medias                                       |        |

### B.7. Snippets (M7) y formato (M8)

Ninguno de los dos habla con el servidor, así que aquí lo que se mide es que **el `.vsix` los trae y
funcionan en Windows**.

| #   | Qué hacer                                                                                   | Qué tiene que salir                                                                   | Estado |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| B32 | Abrir la vista **Snippets** del explorador de objetos                                       | Salen los de la extensión, en solo lectura                                            |        |
| B33 | Crear uno propio y insertarlo con una ventana de SQL abierta                                | Sale **delante** de los de la extensión y el texto llega al editor                    |        |
| B34 | `SQLWorks: Formato de T-SQL: abrir el panel`, tocar `keywordCasing` y mirar la vista previa | La vista previa se actualiza con el SQL formateado                                    |        |
| B35 | Guardar un perfil y aplicarlo con `SQLWorks: Formato de T-SQL: aplicar un perfil`           | Los ajustes del formateador quedan escritos, y al formatear un archivo `.sql` se nota |        |

## 5. Reglas del recorrido

- **El servidor de pruebas no es producción.** Las partes B.5 y B.6 escriben en el catálogo. Si el
  único servidor disponible es uno que importa, se recorre la parte A y las partes B.2 a B.4 —que
  solo leen— y las demás se marcan con **—**.
- **`KILL` solo sobre sesiones propias** (B.3).
- **Al terminar**, `scripts/fork/paridad-en-vivo/02-limpiar.sql` borra `ParityDb` y el login
  `parity_user`. Los logins de servidor que hayas creado en B.6 los borra el propio panel, que es la
  fila B31.

## 6. Qué se hace con esto después

Con las filas contestadas se actualizan dos sitios de `FORK.md`:

- **§13.2**, la tabla de la lista de paridad, y en particular la fila **1b**, que es la única que
  sigue sin que nadie la haya ejercitado.
- **§28**, donde queda escrito que el segundo merge con el upstream está cerrado —o qué lo impide—.
