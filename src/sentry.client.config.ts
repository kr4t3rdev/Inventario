/**
 * @description Configuración de Sentry para el runtime del navegador.
 *
 * Next.js carga este archivo automáticamente (ver la convención
 * `sentry.client.config.ts`) para capturar errores del cliente, errores de
 * handlers `onClick`/`onError` y errores no manejados de React.
 *
 * La captura de cliente no envía datos personales: `sendDefaultPii` está
 * desactivado y la DSN es pública por diseño (solo permite enviar eventos).
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
import * as Sentry from "@sentry/nextjs";
import {
  sanitizeSentryEvent,
  sanitizeSentryTransaction,
} from "@/lib/observability/sentry-event-sanitizer";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Tracing remains off until its privacy and OTel delivery are verified.
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),

  debug: false,

  // Sin datos personales ni cookies del navegador.
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

  // Replays desactivados: capturan el DOM y pueden exponer datos del usuario.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
