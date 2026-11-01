/**
 * @description Configuración de Sentry para el runtime Node.js (Server
 * Components, Server Actions y Route Handlers).
 *
 * Se importa desde `register()` en src/instrumentation.ts. Captura errores
 * no manejados del servidor y habilita performance tracing basado en OTel.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn:
    "https://60104f06aac562e15aec147354ee6aa5@o4512346323091456.ingest.us.sentry.io/4512346464518144",

  // 100% de transacciones. En producción se puede bajar (p. ej. 0.2)
  // según el volumen de tráfico y la cuota del plan de Sentry.
  tracesSampleRate: 1.0,

  // Activar solo para depurar la integración (loguea cada evento en consola)
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
});
