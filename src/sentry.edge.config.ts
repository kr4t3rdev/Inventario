/**
 * @description Configuración de Sentry para el runtime Edge (middleware).
 *
 * Se importa desde `register()` en src/instrumentation.ts cuando
 * NEXT_RUNTIME es "edge".
 */
import * as Sentry from "@sentry/nextjs";
import {
  sanitizeSentryEvent,
  sanitizeSentryTransaction,
} from "@/lib/observability/sentry-event-sanitizer";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Tracing remains off until its privacy and OTel delivery are verified.
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
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
});
