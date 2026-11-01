/**
 * @description Instrumentación del cliente (browser) para Next.js.
 *
 * Next.js ejecuta este archivo automáticamente en el navegador antes de
 * cualquier componente. Inicializa Sentry para capturar errores de
 * React, interacciones y navegaciones del lado cliente.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn:
    "https://60104f06aac562e15aec147354ee6aa5@o4512346323091456.ingest.us.sentry.io/4512346464518144",

  tracesSampleRate: 1.0,
  debug: false,
  // No enviar datos potencialmente sensibles (headers, cookies, usuario, query params).
  // Sentry v11 reemplazo `sendDefaultPii` por `dataCollection`.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },

  // Agrupar sesiones para métricas de usuarios afectados por issue
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

/**
 * Captura los cambios de ruta del App Router como spans de navegación,
 * para ver la transacción correspondiente en el dashboard de Sentry.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
