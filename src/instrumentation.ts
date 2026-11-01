/**
 * @description Instrumentación de Next.js 16: Sentry + OpenTelemetry.
 *
 * Next.js detecta automáticamente este archivo y lo ejecuta antes que cualquier
 * otro código en Server Components, Route Handlers y Server Actions.
 *
 * Sentry (vía @sentry/nextjs) captura errores no manejados y envía
 * performance tracing al dashboard de sentry.io. El SDK de Sentry es
 * OTel-based: registra su tracer provider global, por eso se inicializa
 * ANTES que registerOTel — así los spans de Prisma/OpenTelemetry quedan
 * dentro de las transacciones de Sentry.
 *
 * Dependencias:
 *   - @sentry/nextjs: captura de errores y tracing
 *   - @vercel/otel: wrapper Edge-compatible sobre el SDK de OpenTelemetry
 *   - @prisma/instrumentation: tracing automático de queries Prisma
 *   - @opentelemetry/api: API para custom spans
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

import * as Sentry from "@sentry/nextjs";
import { registerOTel } from "@vercel/otel";

/**
 * @description Hook de Next.js: registra instrumentaciones antes de que
 * la aplicación atienda su primer request.
 * @returns {Promise<void>} Resuelve cuando Sentry y OTel están listos
 */
export async function register(): Promise<void> {
  // 1) Sentry primero: su init registra el tracer provider global de OTel
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }

  // 2) OpenTelemetry: tracing de queries Prisma
  registerOTel({
    serviceName: "invent-sys",

    // Instrumentaciones adicionales
    instrumentations: [
      // Prisma: tracing de queries (findMany, create, update, delete, etc.)
      // Se registra condicionalmente porque el módulo es Node.js-only.
      ...(process.env.NEXT_RUNTIME === "nodejs"
        ? [getPrismaInstrumentation()]
        : []),
    ],
  });
}

/**
 * @description Crea y retorna la instancia de PrismaInstrumentation,
 * configurada para no registrar queries de middleware interno (como
 * aceleración de Prisma).
 */
function getPrismaInstrumentation() {
   
  const { PrismaInstrumentation } = require("@prisma/instrumentation");
  return new PrismaInstrumentation({
    middleware: false,
  });
}

/**
 * @description Hook de Next.js para reportar errores no manejados en
 * Server Components, Route Handlers y Server Actions.
 *
 * Se ejecuta cuando un error cruza el límite del componente/servicio
 * sin ser capturado. Hace dos cosas:
 *   1. Adjunta la excepción al span activo de OpenTelemetry (comportamiento previo).
 *   2. Reporta el error a Sentry (dashboard en sentry.io).
 *
 * @param {Error} err - Error no manejado
 * @param {object} request - Datos del request (path, method, headers)
 * @param {object} context - Contexto de la ruta (router, path, tipo)
 * @returns {Promise<void>} Resuelve cuando el error fue reportado
 */
export async function onRequestError(
  err: Error,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: {
    routerKind: "App Router" | "Pages Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
    revalidateReason: "build" | "stale" | "on-demand";
  }
): Promise<void> {
  // 1) OTel: registrar la excepción en el span activo (si existe)
  try {
    const { trace } = await import("@opentelemetry/api");
    const span = trace.getActiveSpan();

    if (span) {
      span.recordException(err);
      span.setStatus({ code: 2, message: err.message });
    }
  } catch {
    // Si OpenTelemetry no está disponible, continuar con Sentry
  }

  // 2) Sentry: enviar el error al dashboard
  return Sentry.captureRequestError(err, request, context);
}
