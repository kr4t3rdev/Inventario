/**
 * @description Utilidad de tracing para crear spans personalizados
 * con OpenTelemetry. Diseñada para Server Actions, Route Handlers
 * y lógica de negocio que requiera observabilidad adicional.
 *
 * Uso:
 * ```ts
 * import { traceSpan } from "@/lib/tracing"
 *
 * const result = await traceSpan("productos.crear", async (span) => {
 *   span.setAttribute("producto.id", nuevoProducto.id)
 *   span.setAttribute("producto.nombre", nuevoProducto.nombre)
 *
 *   // ... lógica de negocio
 *   return nuevoProducto
 * })
 * ```
 *
 * Safe to use even when OpenTelemetry is not initialized (no-op fallback
 * using the dummy tracer).
 */

import { trace, type Span, type SpanOptions, type Tracer } from "@opentelemetry/api"

const TRACER_NAME = "invent-sys"

let tracer: Tracer | null = null

/**
 * @description Obtiene el tracer de la aplicación. Lazy-initialized para
 * no forzar la carga de @opentelemetry/api en entornos donde OTel no esté
 * disponible (ej: Edge Runtime).
 */
function getTracer(): Tracer {
  if (!tracer) {
    tracer = trace.getTracer(TRACER_NAME)
  }
  return tracer
}

/**
 * @description Crea un span activo alrededor de una operación async.
 * El span se cierra automáticamente cuando la callback termina (o
 * falla). Atributos opcionales pueden pasarse en options.
 *
 * @param name - Nombre del span (convención: dominio.subdominio.accion)
 * @param fn - Callback que recibe el span y retorna un Promise<T>
 * @param options - SpanOptions de OpenTelemetry + atributos iniciales
 * @returns El valor que retorna fn
 *
 * @example
 * const user = await traceSpan("auth.login", async (span) => {
 *   span.setAttribute("user.id", user.id)
 *   return user
 * })
 */
export async function traceSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: SpanOptions & { attributes?: Record<string, string | number | boolean> }
): Promise<T> {
  const activeTracer = getTracer()

  return activeTracer.startActiveSpan(name, async (span: Span) => {
    try {
      if (options?.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
          span.setAttribute(key, value)
        }
      }

      const result = await fn(span)
      return result
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: 2, message: (error as Error).message })
      throw error
    } finally {
      span.end()
    }
  })
}
