/**
 * @description Cliente de reporte de errores del navegador hacia el log del servidor.
 *
 * Los boundaries de error de la App Router (`src/app/error.tsx` y
 * `src/app/global-error.tsx`) son Client Components: cuando atrapan un fallo
 * de render, ese fallo solo existe en el navegador. Este helper lo reenvía al
 * endpoint interno `POST /api/errors`, que lo escribe en el log del servidor
 * (visible en Railway) para que el equipo pueda diagnosticslo.
 *
 * @module lib/error-reporting-client
 */

/** @description Datos mínimos de un error de render reportable. */
export interface ErrorReportPayload {
  /** Mensaje del error. */
  message: string;
  /** Digest de Next.js; lo asigna el servidor para errores de Server Components. */
  digest?: string;
  /** Traza del error en el navegador. */
  stack?: string;
  /** Ruta del navegador donde ocurrió el fallo. */
  path?: string;
  /** User agent del navegador. */
  userAgent?: string;
}

/**
 * @description Envía un reporte de error al endpoint interno `/api/errors`.
 * Es best-effort: nunca lanza, para no interferir con el manejo del error
 * original que ya está a cargo del boundary.
 * @param {ErrorReportPayload} payload - Datos del error a reportar.
 * @returns {Promise<boolean>} `true` si el servidor aceptó el reporte.
 */
export async function reportClientError(payload: ErrorReportPayload): Promise<boolean> {
  try {
    const response = await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: payload.message,
        digest: payload.digest,
        stack: payload.stack,
        path:
          payload.path ??
          (typeof window !== 'undefined' ? window.location.pathname : undefined),
        userAgent:
          payload.userAgent ??
          (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
      }),
      keepalive: true,
    });
    return response.ok;
  } catch {
    // Fallo de red o servidor no disponible: el error original ya se muestra
    // en pantalla, así que no hay nada más que hacer aquí.
    return false;
  }
}
