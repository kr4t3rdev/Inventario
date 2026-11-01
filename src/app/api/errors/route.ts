import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * @description Endpoint interno para registrar errores de render que ocurren en el
 * navegador. Los boundaries `src/app/error.tsx` y `src/app/global-error.tsx`
 * son Client Components: cuando atrapan un fallo de render, ese fallo solo
 * existe en el cliente. Este endpoint lo escribe en el log del servidor
 * (visible en Railway) para que el equipo pueda diagnosticarlo.
 *
 * Deliberadamente NO exige autenticación: un fallo de render puede ocurrir
 * antes de iniciar sesión (por ejemplo, en `/login`) o después de perder la
 * sesión. A cambio, el payload es mínimo (sin cookies, sin tokens, sin datos
 * del tenant) y está limitado por un rate limit por IP.
 *
 * @module app/api/errors/route
 */

const errorReportSchema = z.object({
  message: z.string().min(1).max(500),
  digest: z.string().max(64).optional(),
  stack: z.string().max(2000).optional(),
  path: z.string().max(255).optional(),
  userAgent: z.string().max(255).optional(),
});

/** @description Eventos máximos por IP dentro de la ventana de rate limit. */
const RATE_LIMIT_MAX_EVENTS = 10;
/** @description Ventana del rate limit en milisegundos. */
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * @description Contadores de rate limit en memoria por IP.
 * Es aproximado en despliegues con varias instancias (Railway), pero evita que
 * un único origen inunde el log del servidor.
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * @description Extrae la IP del cliente usando los headers de proxy.
 * @param {Request} request - Petición entrante.
 * @returns {string} IP del cliente o `'desconocida'`.
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'desconocida';
  return request.headers.get('x-real-ip') ?? 'desconocida';
}

/**
 * @description Indica si la IP puede enviar otro reporte dentro de la ventana.
 * @param {string} ip - IP del cliente.
 * @returns {boolean} `true` si el reporte está permitido.
 */
function isWithinRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_EVENTS) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * @description Registra un error de render informado por el navegador.
 * @param {Request} request - Petición con el reporte del error.
 * @returns {Promise<NextResponse>} `204` si se registró, `400` si el payload
 * es inválido y `429` si se excedió el rate limit.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);

  if (!isWithinRateLimit(ip)) {
    return new NextResponse(null, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const parsed = errorReportSchema.safeParse(body);
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  console.error('[client-error]', {
    ...parsed.data,
    ip,
    origen: 'client',
    receivedAt: new Date().toISOString(),
  });

  return new NextResponse(null, { status: 204 });
}
