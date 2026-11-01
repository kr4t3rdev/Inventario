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
    process.env.SENTRY_DSN ??
    "https://60104f06aac562e15aec147354ee6aa5@o4512346323091456.ingest.us.sentry.io/4512346464518144",

  // Muestreo de trazas. Por defecto 10% (suficiente para el diagnostico y
  // sustainable con la cuota del plan); se ajusta con SENTRY_TRACES_SAMPLE_RATE
  // (1.0 = 100%) segun volumen de trafico.
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),

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
});
