/**
 * @description Configuración de Sentry para el runtime Node.js (Server
 * Components, Server Actions y Route Handlers).
 *
 * Se importa desde `register()` en src/instrumentation.ts. Captura errores
 * no manejados del servidor y habilita performance tracing basado en OTel.
 */
import * as Sentry from "@sentry/nextjs";
import {
  sanitizeSentryEvent,
  sanitizeSentryTransaction,
} from "@/lib/observability/sentry-event-sanitizer";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSendLog: (log) => {
    if (process.env.SENTRY_ENABLE_LOGS !== "true") return null;
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

  // Tracing remains off until its privacy and OTel delivery are verified.
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),

  // Activar solo para depurar la integracion (loguea cada evento en consola)
  debug: false,

  // No enviar datos potencialmente sensibles (headers, cookies, usuario completo).
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
});
