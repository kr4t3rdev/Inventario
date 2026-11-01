/**
 * @description Instrumentación del cliente (browser) para Next.js.
 *
 * Next.js ejecuta este archivo automáticamente en el navegador antes de
 * cualquier componente. Inicializa Sentry para capturar errores de
 * React, interacciones y navegaciones del lado cliente.
 */
import * as Sentry from "@sentry/nextjs";
import {
  sanitizeSentryEvent,
  sanitizeSentryTransaction,
} from "@/lib/observability/sentry-event-sanitizer";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSendLog: (log) => {
    if (process.env.NEXT_PUBLIC_SENTRY_ENABLE_LOGS !== "true") return null;
    const message = log.message;
    if (message !== "tcp.operation.completed" && message !== "tcp.operation.failed") {
      return null;
    }
    const runtime = log.attributes?.runtime;
    const result = log.attributes?.result;
    if (
      !["server", "browser", "edge"].includes(String(runtime)) ||
      !["success", "failure"].includes(String(result))
    ) {
      return null;
    }
    return { ...log, attributes: { runtime, result } };
  },

  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
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
  beforeSend: (event) => sanitizeSentryEvent(event),
  beforeSendTransaction: (event) => sanitizeSentryTransaction(event),

  // Agrupar sesiones para métricas de usuarios afectados por issue
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

/**
 * Captura los cambios de ruta del App Router como spans de navegación,
 * para ver la transacción correspondiente en el dashboard de Sentry.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
