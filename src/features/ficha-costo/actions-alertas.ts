'use server'

import { withAction } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

// ─── Tipos ─────────────────────────────────────────────────

export interface GetProductosMargenBajoInput {
  limit?: number
}

export interface ProductoMargenBajoItem {
  id: string
  nombre: string
  codigoInterno: string | null
  precioCosto: number
  precioVenta: number
  margenPorcentaje: number
  estado: 'SALUDABLE' | 'BAJO' | 'PERDIDA'
}

// ─── Constante ────────────────────────────────────────────

const MARGEN_UMBRAL = 10 // porcentaje
const DEFAULT_LIMIT = 10

// ─── getProductosMargenBajoAction ──────────────────────────

/**
 * @description Retorna los productos del tenant cuyo margen simple
 *   ((precioVenta - precioCosto) / precioVenta * 100) está por
 *   debajo del umbral del 10%. Ordenados por margen ascendente
 *   (los peores primero). Excluye productos sin precio de venta
 *   o sin costo registrado.
 */
export const getProductosMargenBajoAction = withAction(
  async (
    input: GetProductosMargenBajoInput,
    user: AuthenticatedUser,
  ): Promise<ProductoMargenBajoItem[]> => {
    const tenantId = requireTenant(user)
    const limit = input.limit ?? DEFAULT_LIMIT

    const productos = await prisma.producto.findMany({
      where: {
        tenantId,
        precioVenta: { gt: 0 },
        precioCosto: { gt: 0 },
      },
      select: {
        id: true,
        nombre: true,
        codigoInterno: true,
        precioCosto: true,
        precioVenta: true,
      },
      orderBy: { nombre: 'asc' },
    })

    // Calcular margen y filtrar en memoria
    const conMargen: ProductoMargenBajoItem[] = productos
      .map((p) => {
        const margen = ((p.precioVenta - p.precioCosto) / p.precioVenta) * 100
        return {
          id: p.id,
          nombre: p.nombre,
          codigoInterno: p.codigoInterno,
          precioCosto: p.precioCosto,
          precioVenta: p.precioVenta,
          margenPorcentaje: Math.round(margen * 100) / 100,
          estado: margen >= MARGEN_UMBRAL
            ? 'SALUDABLE'
            : margen >= 0
              ? 'BAJO'
              : 'PERDIDA',
        } as ProductoMargenBajoItem
      })
      .filter((p) => p.margenPorcentaje < MARGEN_UMBRAL)
      .sort((a, b) => a.margenPorcentaje - b.margenPorcentaje)
      .slice(0, limit)

    return conMargen
  },
)
