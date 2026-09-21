<!-- [FORK] Reescrito entero. El README del upstream es material de marca de Microsoft y describe
     la extensión publicada en el marketplace, no este repositorio. Ver FORK.md §15.5 y §0. -->

# SQLWorks

Fork interno de [`microsoft/vscode-mssql`](https://github.com/microsoft/vscode-mssql): la extensión
de SQL Server para VS Code, renombrada, sin telemetría, empaquetada para distribución interna y con
un panel de administración propio encima.

Este repositorio es un monorepo de npm workspaces. Todo el trabajo del fork vive en
`extensions/mssql/`, y dentro de ella en `src/custom/`.

## Por dónde empezar

| Si quieres…                                  | Lee                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Entender qué cambia este fork y por qué      | [FORK.md](FORK.md)                                                   |
| Compilar, probar o depurar                   | [DEVELOPMENT.md](DEVELOPMENT.md)                                     |
| Empaquetar, publicar o instalar el `.vsix`   | [docs/fork/DISTRIBUCION.md](docs/fork/DISTRIBUCION.md)               |
| Cerrar la última fila de la lista de paridad | [docs/fork/PARIDAD-1B-KERBEROS.md](docs/fork/PARIDAD-1B-KERBEROS.md) |
| Trabajar en el código con un agente          | [AGENTS.md](AGENTS.md)                                               |

## Qué añade el fork

- **Panel de administración** de seguridad del servidor y de la base de datos, en solo lectura, con
  una única puerta de escritura: vista previa del script, confirmación y transacción explícita.
- **Biblioteca de snippets** propia y compartible, que se suma a los dos caminos del upstream.
- **Perfiles de formato** sobre el formateador del upstream, con vista previa lado a lado.
- **Sin telemetría**: el envío se corta en el arranque, y hay un test que lo fija.
- **Un `.vsix` autocontenido**: el SQL Tools Service va dentro, así que no descarga nada al arrancar
  ni necesita el runtime de .NET instalado.

## Reglas de la casa

1. El código propio vive en `extensions/mssql/src/custom/`. Fuera de ahí, cada línea es deuda de
   merge.
2. Cada línea nuestra dentro de un archivo del upstream lleva un comentario `// [FORK]` y una fila
   en la tabla del §0 de FORK.md, **en el mismo commit**.
3. `node scripts/fork/audit-merge-debt.mjs` comprueba que esas dos cosas siguen siendo verdad. Lo
   corre la integración continua en cada empujón.
4. `node scripts/fork/upstream-distance.mjs --fetch` dice cuánto se ha movido el upstream y cuántos
   de esos commits tocan archivos nuestros.

## Licencia

Obra original de Microsoft Corporation bajo licencia MIT; [LICENSE.txt](LICENSE.txt) y
[ThirdPartyNotices.txt](ThirdPartyNotices.txt) se conservan sin modificar. Las modificaciones de
este fork se publican en los mismos términos. Ver [NOTICE.md](NOTICE.md).
