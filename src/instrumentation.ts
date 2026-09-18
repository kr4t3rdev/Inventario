/**
 * @description OpenTelemetry instrumentation para Next.js 16.
 *
 * Next.js detecta automáticamente este archivo y lo ejecuta antes que cualquier
 * otro código en Server Components, Route Handlers y Server Actions.
 *
 * Dependencias:
 *   - @vercel/otel: wrapper Edge-compatible sobre el SDK de OpenTelemetry
 *   - @prisma/instrumentation: tracing automático de queries Prisma
 *   - @opentelemetry/api: API para custom spans
 *
 * @see https://nextjs.org/docs/app/api-reference/next-config-js/instrumentation
 */

import { registerOTel } from "@vercel/otel"

export function register() {
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
  })
}

/**
 * @description Crea y retorna la instancia de PrismaInstrumentation,
 * configurada para no registrar queries de middleware interno (como
 * aceleración de Prisma).
 */
function getPrismaInstrumentation() {
   
  const { PrismaInstrumentation } = require("@prisma/instrumentation")
  return new PrismaInstrumentation({
    middleware: false,
  })
}

/**
 * @description Hook de Next.js para reportar errores no manejados en
 * Server Components, Route Handlers y Server Actions.
 *
 * Se ejecuta cuando un error cruza el límite del componente/servicio
 * sin ser capturado. Adjunta la excepción al span activo de OTel.
 */
export async function onRequestError(
  err: Error,
  request: { path: string; method: string },
  _context: { routerKind: string; routePath: string }
): Promise<void> {
  try {
    const { trace } = await import("@opentelemetry/api")
    const span = trace.getActiveSpan()

    if (span) {
      span.recordException(err)
      span.setStatus({ code: 2, message: err.message })
    }
  } catch {
    // Si OpenTelemetry no está disponible, no hay nada que hacer
  }
}
