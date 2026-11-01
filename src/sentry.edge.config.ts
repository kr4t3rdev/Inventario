/**
 * @description Configuración de Sentry para el runtime Edge (middleware).
 *
 * Se importa desde `register()` en src/instrumentation.ts cuando
 * NEXT_RUNTIME es "edge".
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
});
