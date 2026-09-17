/*---------------------------------------------------------------------------------------------
 *  Fork interno (SQLWorks). Código propio, no del upstream.
 *--------------------------------------------------------------------------------------------*/

/**
 * Textos de los webviews del fork.
 *
 * Constantes planas y no `l10n.t()`, por lo mismo que en `src/custom/strings.ts`: la interfaz
 * nueva es solo en español. Los textos del upstream siguen su propia tubería y no se tocan.
 */
export const WebviewStrings = {
    adminPanel: {
        title: "Administración",
        subtitleEmpty: "Sin conexión resuelta",
        refresh: "Actualizar",
        refreshAriaLabel: "Volver a leer los datos de la conexión",
        fields: {
            server: "Servidor",
            database: "Base de datos",
            authentication: "Autenticación",
            profile: "Perfil",
            user: "Usuario",
            version: "Versión del motor",
            edition: "Edición",
            hosting: "Alojamiento",
        },
        hosting: {
            cloud: "Nube",
            onPremises: "Local",
        },
        readAt: (moment: string) => `Leído a las ${moment}`,
        placeholderTitle: "Panel vacío, a propósito",
        placeholderBody:
            "Este panel es el punto de anclaje del fork (hito M2). Ya abre desde el explorador de objetos, reutiliza la conexión activa de la extensión y toma sus colores del tema. El contenido de administración llega en los hitos siguientes.",
        placeholderNext: [
            "M3 — Seguridad del servidor en solo lectura: logins, roles, permisos, propiedades de la instancia y sesiones activas.",
            "M4 — Usuarios y permisos en solo lectura, con la matriz de heredados.",
            "M5 — Edición y ejecución, con vista previa del script y transacción explícita.",
            "M6 — Bases de datos: listado con tamaños, propiedades, archivos, creación y eliminación.",
        ],
        unknown: "Desconocido",
    },
} as const;
