# Distribución de SQLWorks

Cómo se empaqueta, se publica, se instala y se actualiza el `.vsix` del fork (M10).

Esto es el proceso; el **porqué** de cada decisión técnica que hay detrás está en FORK.md: el
empaquetado de una sola plataforma en §15.4, el modo autocontenido del SQL Tools Service en §11.4 y
§2.1, y el hueco que este documento cierra en §29.

---

## 1. Versión

La extensión **no hereda la versión del upstream**. Tiene la suya, que hoy es la `0.1.0` de
`extensions/mssql/package.json`, y sube así:

| Cuándo                                                  | Qué sube     |
| ------------------------------------------------------- | ------------ |
| Un hito nuevo (M10, M11…)                               | El **minor** |
| Un arreglo sobre un hito ya distribuido                 | El **patch** |
| Un merge con el upstream que no cambia nada nuestro     | El **patch** |
| La paridad completa (incluida la 1b) y alguien usándolo | `1.0.0`      |

Es deliberado que no sea la del upstream. Dos razones:

1. **Las versiones del upstream no dicen nada de este fork.** Entre `1.42.2` y `1.46.0` el upstream
   cambió el motor de lenguaje SQL y la rejilla; el fork, mientras tanto, iba por su cuenta. Un
   número que se mueve solo cuando alguien de Microsoft publica no informa de nada de lo nuestro.
2. **Un `.vsix` se instala por número de versión.** Si el fork llevara la del upstream, dos compilados
   distintos del fork podrían llevar el mismo número, y VS Code no instalaría el segundo.

**Qué upstream lleva cada versión** se anota en las notas de la publicación, copiándolo de la fila
«Último merge con el upstream» de FORK.md. Ahí está el commit exacto, que es más preciso que un
número de versión.

---

## 2. Empaquetar

Desde la raíz del monorepo, con Node 24:

```bash
npm ci
npm run build -- --target mssql
cd extensions/mssql
node scripts/package-fork.js --platform win-x64
```

Sale un `sqlworks-<versión>.vsix` en `extensions/mssql/`, con el SQL Tools Service **dentro**. Eso es
lo que hace que la extensión no descargue nada la primera vez que arranca y que no haga falta
instalar `ms-dotnettools.vscode-dotnet-runtime` en la máquina de destino (FORK.md §11.4).

Cada plataforma necesita su propio `.vsix`: el servicio va compilado dentro. `--platform` acepta
`win-x64`, `win-arm64`, `osx-x64`, `osx-arm64`, `linux-x64` y `linux-arm64`, y se puede repetir. Para
este equipo, **`win-x64` es la que se distribuye**.

No hace falta empaquetar a mano para una publicación: lo hace el workflow del §3.

---

## 3. Publicar

Dos caminos, y hacen cosas distintas:

| Camino                                | Qué produce                                  | Cuánto dura  |
| ------------------------------------- | -------------------------------------------- | ------------ |
| Cada empujón a `main` (`fork-ci.yml`) | Un artefacto `sqlworks-win-x64` del workflow | 30 días      |
| Una etiqueta `sqlworks-v*`            | Una **publicación** de GitHub con el `.vsix` | Para siempre |

El primero es para probar: siempre hay un `.vsix` del último `main` sin que nadie se acuerde de
generarlo. El segundo es el que se reparte, y es el único que no caduca.

Para publicar una versión:

```bash
# 1. Sube la versión en extensions/mssql/package.json (ver §1) y haz commit.
# 2. Etiqueta ese commit con el mismo número.
git tag sqlworks-v0.2.0
git push origin sqlworks-v0.2.0
```

`.github/workflows/fork-release.yml` construye, empaqueta y crea la publicación con el `.vsix`
adjunto. **Comprueba que la etiqueta y la versión del manifiesto coinciden** y se para si no, porque
una publicación `v0.2.0` que contenga un `.vsix` `0.1.0` es peor que no publicar.

---

## 4. Instalar

En la máquina de destino, con el `.vsix` descargado de la publicación:

```powershell
code --install-extension sqlworks-0.2.0.vsix
```

O desde la interfaz: **Extensiones → … (menú) → Instalar desde VSIX**.

La primera vez conviene comprobar tres cosas, que son las que distinguen este fork del original:

1. En **Extensiones** aparece **SQLWorks**, de `alfredc1403`, y **no** «SQL Server (mssql)».
2. La barra de actividad tiene el icono de SQLWorks, y al abrirlo está el árbol de conexiones.
3. Con el botón derecho sobre un servidor del árbol sale **Abrir el panel de administración**, que
   es lo que añade el fork.

Si además está instalada la extensión original de Microsoft, **las dos conviven**: son
identificadores distintos (`alfredc1403.sqlworks` y `ms-mssql.mssql`). Funcionan, pero las dos
registran sus proveedores de lenguaje para `.sql` y las dos levantan su propio SQL Tools Service, así
que se recomienda dejar solo una.

---

## 5. Actualizar

**Un `.vsix` instalado a mano no se actualiza solo.** VS Code solo busca actualizaciones de lo que
viene del marketplace, y este fork no está ahí a propósito. Es la contrapartida de distribuir
internamente, y conviene decirla antes de que alguien se quede seis meses atrás sin saberlo.

Actualizar es instalar encima:

```powershell
code --install-extension sqlworks-0.3.0.vsix --force
```

`--force` es necesario cuando VS Code ya tiene una versión instalada. Después hay que **recargar la
ventana** (`Developer: Reload Window`), porque el host de extensiones tiene cargada la vieja.

Lo que **no** se pierde al actualizar, porque vive fuera del `.vsix`:

- Las conexiones guardadas y sus contraseñas, que están en el almacén de credenciales de VS Code.
- Los snippets propios y las bibliotecas compartidas (FORK.md §24.2).
- Los perfiles de formato, que son un ajuste (`sqlworks.format.profiles`).
- Los servidores marcados como de producción (`sqlworks.productionServers`).

---

## 6. Lista de comprobación de una publicación

1. `main` en verde: `fork-ci.yml` pasa (auditoría, build, lint, formato y unitarios).
2. La lista de paridad del §13 de FORK.md corrida contra un servidor de verdad, si el merge
   anterior tocó algo del upstream.
3. Versión subida en `extensions/mssql/package.json` según el §1, con su commit.
4. Etiqueta `sqlworks-v<versión>` empujada.
5. Notas de la publicación con: qué cambia, y el commit del upstream que lleva (fila «Último merge
   con el upstream» de FORK.md).
6. El `.vsix` de la publicación instalado en una máquina limpia y abierto una vez, comprobando los
   tres puntos del §4.
