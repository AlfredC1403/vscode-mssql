/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *
 *  Empaqueta el .vsix para UNA plataforma con el SQL Tools Service autocontenido dentro.
 *
 *  `npm run package -- --target mssql` usa scripts/package-extension.js del upstream, cuyo modo
 *  --offline recorre las seis plataformas y tarda mucho. Para distribución interna solo hacen
 *  falta las que usa el equipo, así que este envoltorio reutiliza sus funciones exportadas y
 *  empaqueta una sola.
 *
 *  Uso, desde extensions/mssql y con el proyecto ya construido:
 *
 *      node scripts/build.js            # o: npm run build -- --target mssql, desde la raíz
 *      node scripts/package-fork.js                  # win-x64 por defecto
 *      node scripts/package-fork.js --platform linux-x64
 *      node scripts/package-fork.js --platform win-x64 --platform linux-x64
 *
 *  A diferencia del modo --offline del upstream, no hace falta quitar
 *  ms-dotnettools.vscode-dotnet-runtime del manifiesto al empaquetar: este fork ya no lo declara
 *  en extensionPack, porque el servicio va autocontenido y no necesita el runtime de .NET.
 *--------------------------------------------------------------------------------------------*/

const fs = require("fs");
const path = require("path");
const logger = require("../../../scripts/terminal-logger");
const {
    installSqlToolsService,
    cleanServiceInstallFolder,
    cleanMcpInstallFolder,
    packageExtension,
} = require("./package-extension");

/** Identificador de plataforma → nombre del runtime en src/models/platform.ts */
const PLATFORMS = {
    "win-x64": "Windows_64",
    "win-arm64": "Windows_ARM64",
    "osx-x64": "OSX",
    "osx-arm64": "OSX_ARM64",
    "linux-x64": "Linux",
    "linux-arm64": "Linux_ARM64",
};

function parseArgs(argv) {
    const requested = [];
    let preRelease = false;

    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--platform") {
            const value = argv[++i];
            if (!value) {
                throw new Error("--platform necesita un valor");
            }
            if (!PLATFORMS[value]) {
                throw new Error(
                    `Plataforma desconocida: ${value}. Válidas: ${Object.keys(PLATFORMS).join(", ")}`,
                );
            }
            requested.push(value);
        } else if (argv[i] === "--pre-release") {
            preRelease = true;
        } else if (argv[i] === "--help" || argv[i] === "-h") {
            console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
            process.exit(0);
        } else {
            throw new Error(`Argumento no reconocido: ${argv[i]}`);
        }
    }

    return { platforms: requested.length > 0 ? requested : ["win-x64"], preRelease };
}

async function main() {
    const { platforms, preRelease } = parseArgs(process.argv.slice(2));
    const manifest = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8"),
    );

    if (manifest.aiKey) {
        throw new Error(
            "package.json declara aiKey. Este fork no envía telemetría: quítalo antes de empaquetar.",
        );
    }

    logger.header(`Empaquetar ${manifest.name} v${manifest.version}`);
    logger.info(`Plataformas: ${platforms.join(", ")}`);

    // Requiere el build previo: package-extension.js carga dist/ y out/ para resolver runtimes.
    const { Runtime } = require("../out/src/models/platform");
    const generated = [];

    await cleanMcpInstallFolder();

    for (const [index, id] of platforms.entries()) {
        logger.info(`[${index + 1}/${platforms.length}] ${id}`);
        await cleanServiceInstallFolder();
        await installSqlToolsService(Runtime[PLATFORMS[id]]);

        const output = `${manifest.name}-${manifest.version}-${id}.vsix`;
        packageExtension(output, preRelease);
        generated.push(output);
    }

    logger.success(`Listo: ${generated.join(", ")}`);
}

main().catch((error) => {
    logger.error(error.message);
    process.exit(1);
});
