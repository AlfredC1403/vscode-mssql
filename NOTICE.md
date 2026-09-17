# Avisos de copyright

Este repositorio es **SQLWorks**, un fork interno de
[`microsoft/vscode-mssql`](https://github.com/microsoft/vscode-mssql).

## Obra original

Copyright (c) Microsoft Corporation. Todos los derechos reservados.
Publicada bajo licencia MIT, cuyo texto completo está en [LICENSE.txt](LICENSE.txt).

Ese archivo y [ThirdPartyNotices.txt](ThirdPartyNotices.txt) se conservan **sin modificar**, tal
como exige la licencia MIT.

## Modificaciones de este fork

Copyright (c) 2026 Alfred C.

Las modificaciones y las adiciones propias se publican también bajo licencia MIT, en los mismos
términos que la obra original.

El código propio vive en `extensions/mssql/src/custom/`. Los cambios sobre archivos del upstream
están marcados con un comentario `// [FORK]` y catalogados en [FORK.md](FORK.md) §0:

```bash
git grep -n "\[FORK\]"
```

## Marcas

La licencia MIT cubre el código, **no** los nombres ni los logotipos. SQLWorks no usa ni
redistribuye el nombre, la marca ni los logotipos de Microsoft:

- El icono de la extensión (`extensions/mssql/images/sqlworksIcon.png`, y la copia en
  `extensionIcon.png` que consume el webview del historial de cambios) y el avatar del
  participante de chat (`mssql-chat-avatar.jpg`) son obra propia.
- Los recursos de marketing de Microsoft que traía el upstream (`mssql-demo.gif`,
  `yt-thumbnail.png`) se han eliminado.
- El README de la extensión se ha reescrito.

SQLWorks no es un producto de Microsoft y Microsoft no lo respalda.

## SQL Tools Service

Los paquetes generados incluyen binarios de
[`microsoft/sqltoolsservice`](https://github.com/microsoft/sqltoolsservice), también bajo licencia
MIT. Se redistribuyen sin modificar.
