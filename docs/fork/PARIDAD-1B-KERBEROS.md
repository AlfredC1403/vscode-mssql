# Paridad 1b: autenticación integrada

Qué hay que probar, por qué no se ha podido probar todavía, y qué se anota cuando alguien lo pruebe.

La fila 1b de la lista de paridad (FORK.md §13.2) es **la única de las nueve que nadie ha
ejercitado**. Este documento existe para que cerrarla sea una tarde de trabajo de quien tenga acceso
a un dominio, y no una investigación desde cero.

---

## 1. Por qué es la primera de la lista

El fork se distribuye a máquinas Windows de dominio. En una máquina así, **la autenticación
integrada es el modo normal de conectarse**: nadie escribe usuario y contraseña de SQL Server si el
servidor confía en el dominio. O sea que la fila sin verificar es la del camino que más se va a usar.

Lo que hace falta **no es una máquina Windows**, y esto estaba mal escrito hasta M9: hace falta un
**dominio Kerberos** —un KDC alcanzable, un SPN registrado para la instancia y un ticket—. El propio
upstream documenta cómo usar autenticación integrada desde macOS y Linux en
`extensions/mssql/KERBEROS_HELP.md`. Lo que falta en el contenedor donde se construyó el fork es el
dominio, no el sistema operativo.

---

## 2. Qué podría haber roto el fork, en concreto

La pregunta no es «¿funciona Kerberos?», que es cosa del upstream y de Microsoft. Es **«¿ha roto
algo el fork en ese camino?»**, y para eso hay dos candidatos, con un peso muy distinto.

### 2.1. El identificador de la extensión: revisado, y no está en ese camino

El renombrado de M1 cambió `ms-mssql.mssql` por `alfredc1403.sqlworks` en cuatro archivos, y el §15.6
cuenta lo caro que salió: la extensión **se busca a sí misma** por ese identificador, y una
referencia sin actualizar tumba el host de extensiones al cargar.

Revisado para este documento: de los sitios que llaman a `vscode.extensions.getExtension(...)` con
el identificador propio, **ninguno está en el camino de conexión**. Son el changelog, el controlador
de proyectos, la encuesta de satisfacción y el ayudante de compilación de proyectos de base de
datos. La autenticación integrada no pasa por ninguno: viaja como un parámetro de la conexión hasta
el SQL Tools Service.

```bash
# Los sitios que se autolocalizan, para volver a mirarlos después de cada merge:
git grep -n "getExtension(constants.extensionId)" -- extensions/mssql/src
# Y el que no puede devolver nada nunca (§15.6):
git grep -n '"ms-mssql\.mssql"' -- extensions/mssql/src
```

El segundo tiene que devolver **cero resultados**, y desde M10 lo comprueba también
`scripts/fork/audit-merge-debt.mjs` en cada build.

Esto **no cierra la fila**: un repaso de código dice dónde no está el riesgo, no que la conexión
funcione. Pero acota lo que hay que mirar si falla.

### 2.2. El SQL Tools Service autocontenido: éste sí es una variable del fork

Es el candidato de verdad, y es consecuencia directa de la decisión 11.4.

El fork se empaqueta con `--offline`, que mete **un SQL Tools Service autocontenido** dentro del
`.vsix` en lugar del portable que baja el runtime de .NET aparte. Quien habla Kerberos con el
servidor es ese servicio, no la extensión, así que cambiar cómo está compilado el servicio es
cambiar justo la pieza que interviene.

Qué esperar, y por qué:

- **En Windows**, la autenticación integrada va por SSPI, que es del sistema operativo y no del
  runtime empaquetado. No hay motivo para que un servicio autocontenido se comporte distinto, y es
  la plataforma a la que va este fork. **Riesgo bajo, pero sin medir.**
- **En Linux y macOS**, el ticket sale de las bibliotecas de Kerberos del sistema (`libkrb5`). Un
  compilado autocontenido sigue necesitándolas instaladas; lo que no necesita es el runtime de .NET.
  Si alguna vez se distribuye a esas plataformas, **esto es lo primero que hay que probar**.

---

## 3. Qué hace falta para probarlo

| Pieza                       | Detalle                                                                      |
| --------------------------- | ---------------------------------------------------------------------------- |
| Un dominio                  | Un KDC alcanzable desde la máquina de pruebas                                |
| Una instancia de SQL Server | Configurada para aceptar autenticación de Windows, con su **SPN registrado** |
| Una cuenta de dominio       | Con permiso para conectarse a esa instancia                                  |
| El `.vsix` del fork         | El de la publicación, no una compilación suelta (ver `DISTRIBUCION.md`)      |

Para comprobar que el SPN está bien registrado, desde una máquina del dominio:

```powershell
setspn -L <cuenta-de-servicio-de-sql-server>
```

Tiene que aparecer un `MSSQLSvc/<host>:<puerto>` o `MSSQLSvc/<host>:<instancia>`. Sin SPN, el
cliente cae a NTLM y la prueba no mide Kerberos aunque la conexión funcione.

---

## 4. El procedimiento

1. Instalar el `.vsix` en una máquina del dominio, siguiendo `DISTRIBUCION.md` §4, con la sesión
   iniciada con la cuenta de dominio.
2. **Nueva conexión** desde el árbol de SQLWorks, con el tipo de autenticación
   **Windows Authentication / Integrated**.
3. Conectar. Tiene que abrirse el árbol de objetos del servidor.
4. Comprobar que la conexión es **de verdad Kerberos**, y no NTLM, ejecutando en un editor de
   consultas:

    ```sql
    SELECT auth_scheme, net_transport, client_net_address
    FROM sys.dm_exec_connections
    WHERE session_id = @@SPID;
    ```

    `auth_scheme` tiene que decir **`KERBEROS`**. Si dice `NTLM`, la conexión funcionó pero **la
    fila no se cierra**: falta el SPN, y lo que se ha probado es otra cosa.

5. Abrir el **panel de administración** del fork con el botón derecho sobre el servidor. Es lo que
   distingue esta prueba de la del upstream: el panel reutiliza la conexión del gestor del upstream
   (FORK.md §16.4), así que es donde se vería si una conexión integrada no llega igual a nuestro
   código.
6. Expandir una base de datos en el árbol y ejecutar una consulta cualquiera, para cubrir los puntos
   2 y 4 de la lista de paridad sobre esta conexión.

---

## 5. Qué se anota

En FORK.md §13.2, la fila 1b, con el mismo criterio que las demás: **qué se midió y dónde**, no
«funciona». Como mínimo:

- La salida de `auth_scheme` del paso 4.
- La versión del `.vsix` probado y la plataforma.
- Quién lo probó y en qué fecha.

Y arriba, en el párrafo que dice «la paridad del fork es de ocho sobre nueve», el número pasa a
nueve. Ese párrafo es el que hay que cambiar: mientras siga diciendo ocho, la fila sigue abierta.

Si falla, lo que hay que capturar antes de tocar nada:

- El mensaje de error exacto del diálogo de conexión.
- El registro del canal **MSSQL** de la vista de salida, que es donde el cliente del lenguaje
  escribe lo que le dijo el servicio.
- Si la misma máquina, con la misma cuenta, conecta con `sqlcmd -E` contra la misma instancia. Si
  `sqlcmd` conecta y la extensión no, el problema está en el fork o en el servicio empaquetado, que
  es el §2.2 de este documento. Si tampoco conecta `sqlcmd`, es el dominio.
