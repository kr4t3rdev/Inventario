'use server'

import { withAction } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

// ─── Constantes ────────────────────────────────────────────

const MARGEN_UMBRAL = 10
const DEFAULT_LIMIT = 10

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

export interface VerificarMargenBajoInput {
  dryRun?: boolean
}

export interface VerificarMargenBajoResult {
  productosMargenBajo: number
  notificacionesCreadas: number
}

export interface DashboardRentabilidadInput {
  tipo?: 'SIMPLE' | 'COMPUESTO'
}

export interface CategoriaMargen {
  categoriaId: string
  nombre: string
  margenPromedio: number
  cantidadProductos: number
}

export interface ProductoRentabilidad {
  id: string
  nombre: string
  precioVenta: number
  precioCosto: number
  margenPorcentaje: number
  categoria: string
  tipo: string
}

export interface DashboardRentabilidadData {
  porCategoria: CategoriaMargen[]
  topProductos: ProductoRentabilidad[]
  bottomProductos: ProductoRentabilidad[]
}

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

// ─── verificarMargenBajoAction ─────────────────────────────

/**
 * @description Verifica productos con margen bajo y crea notificaciones
 *   para los usuarios del tenant. Dedup 24h: no notifica el mismo
 *   producto dos veces en 24 horas. Soporta dryRun para solo contar.
 */
export const verificarMargenBajoAction = withAction(
  async (
    input: VerificarMargenBajoInput,
    user: AuthenticatedUser,
  ): Promise<VerificarMargenBajoResult> => {
    const tenantId = requireTenant(user)
    const { dryRun = false } = input

    const productos = await prisma.producto.findMany({
      where: {
        tenantId,
        precioVenta: { gt: 0 },
        precioCosto: { gt: 0 },
      },
      select: {
        id: true,
        nombre: true,
        precioCosto: true,
        precioVenta: true,
      },
    })

    const margenBajo = productos.filter((p) => {
      const margen = ((p.precioVenta - p.precioCosto) / p.precioVenta) * 100
      return margen < MARGEN_UMBRAL
    })

    if (dryRun || margenBajo.length === 0) {
      return { productosMargenBajo: margenBajo.length, notificacionesCreadas: 0 }
    }

    const now = new Date()
    const hace24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    let notificacionesCreadas = 0

    for (const producto of margenBajo) {
      const existente = await prisma.notification.findFirst({
        where: {
          type: 'margen_bajo',
          message: { contains: producto.nombre },
          createdAt: { gte: hace24h },
        },
      })

      if (existente) continue

      const margen = ((producto.precioVenta - producto.precioCosto) / producto.precioVenta) * 100

      await prisma.notification.createMany({
        data: [{
          title: 'Margen Bajo',
          message: `El producto "${producto.nombre}" tiene margen bajo (${margen.toFixed(1)}%)`,
          link: '/busy/ficha-costo',
          type: 'margen_bajo',
          prioridad: 'alta',
          userId: user.userId,
        }],
      })

      notificacionesCreadas++
    }

    return { productosMargenBajo: margenBajo.length, notificacionesCreadas }
  },
)

// ─── getDashboardRentabilidadAction ────────────────────────

/**
 * @description Dashboard de rentabilidad: margen promedio por categoría,
 *   top 5 y bottom 5 productos por margen. Soporta filtro por tipo de
 *   producto (SIMPLE o COMPUESTO).
 */
export const getDashboardRentabilidadAction = withAction(
  async (
    input: DashboardRentabilidadInput,
    user: AuthenticatedUser,
  ): Promise<DashboardRentabilidadData> => {
    const tenantId = requireTenant(user)
    const where: any = {
      tenantId,
      precioVenta: { gt: 0 },
      precioCosto: { gt: 0 },
    }
    if (input.tipo) where.esCompuesto = input.tipo === "COMPUESTO"

    const productos = await prisma.producto.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        precioCosto: true,
        precioVenta: true,
        esCompuesto: true,
        categoria: { select: { id: true, nombre: true } },
      },
    })

    // Calcular margen por producto
    const conMargen: ProductoRentabilidad[] = productos.map((p) => {
      const margen = ((p.precioVenta - p.precioCosto) / p.precioVenta) * 100
      const categoria = p.categoria?.nombre ?? 'Sin categoría'
      return {
        id: p.id,
        nombre: p.nombre,
        precioVenta: p.precioVenta,
        precioCosto: p.precioCosto,
        margenPorcentaje: Math.round(margen * 100) / 100,
        categoria,
        tipo: p.esCompuesto ? "COMPUESTO" : "SIMPLE",
      }
    })

    // Agrupar por categoría
    const catMap = new Map<string, { total: number; count: number }>()
    for (const p of conMargen) {
      const c = catMap.get(p.categoria) ?? { total: 0, count: 0 }
      c.total += p.margenPorcentaje
      c.count++
      catMap.set(p.categoria, c)
    }
    const porCategoria: CategoriaMargen[] = [...catMap.entries()]
      .map(([nombre, { total, count }]) => ({
        categoriaId: nombre,
        nombre,
        margenPromedio: Math.round((total / count) * 100) / 100,
        cantidadProductos: count,
      }))
      .sort((a, b) => b.margenPromedio - a.margenPromedio)

    // Top y bottom 5
    const sorted = [...conMargen].sort((a, b) => b.margenPorcentaje - a.margenPorcentaje)
    const topProductos = sorted.slice(0, 5)
    const bottomProductos = sorted.slice(-5).reverse()

    return { porCategoria, topProductos, bottomProductos }
  },
)
