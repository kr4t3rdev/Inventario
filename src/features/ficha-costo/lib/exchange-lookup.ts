import { prisma } from '@/lib/prisma'
import type { TasaCambioLookup } from './cost-calculator'

/**
 * @description Cache de tasas de cambio precargada para usar dentro de un
 *   mismo cálculo de ficha de costo. El lookup se inyecta en la función
 *   pura `normalizarMoneda` (sin acoplar a Prisma).
 */
export interface TasaCambioCache {
  obtener(fecha: Date, monedaOrigen: string, monedaDestino: string):
    | { tasa: number; fechaTasa: Date }
    | null
}

/**
 * @description Precarga las tasas más recientes para un conjunto de
 *   monedas origen y un único destino, ordenadas por fecha. Si se
 *   solicita una moneda origen que no tiene tasa, se omite.
 */
export async function precargarTasas(
  monedasOrigen: string[],
  monedaDestino: string,
  fechaMax: Date = new Date(),
): Promise<TasaCambioCache> {
  const unicas = Array.from(new Set(monedasOrigen))
  const tasas = await prisma.tasaCambio.findMany({
    where: {
      monedaOrigenId: { in: unicas },
      monedaDestino,
      fechaVigencia: { lte: fechaMax },
    },
    orderBy: { fechaVigencia: 'desc' },
  })

  // Por cada moneda origen, la primera entrada es la más reciente.
  const porMoneda = new Map<string, (typeof tasas)[number]>()
  for (const t of tasas) {
    if (!porMoneda.has(t.monedaOrigenId)) {
      porMoneda.set(t.monedaOrigenId, t)
    }
  }

  return {
    obtener(fecha: Date, monedaOrigen: string, monedaDestino: string) {
      if (monedaOrigen === monedaDestino) {
        return { tasa: 1, fechaTasa: fecha }
      }
      const t = porMoneda.get(monedaOrigen)
      if (!t) return null
      return { tasa: Number(t.tasa), fechaTasa: t.fechaVigencia }
    },
  }
}

/**
 * @description Lookup síncrono a partir de un cache pre-cargado.
 *   Útil para inyectar en `normalizarMoneda`.
 */
export function lookupFromCache(cache: TasaCambioCache): TasaCambioLookup {
  return (fecha: Date, origen: string, destino: string) =>
    cache.obtener(fecha, origen, destino)
}
