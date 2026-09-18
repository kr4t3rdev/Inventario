'use server'

import { prisma } from '@/lib/prisma'
import { ActionError, withAction } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

export interface MastersHealthMetrics {
  productos: number
  categorias: number
  unidades: number
  proveedores: number
  puntosDeVenta: number
  listasPrecio: number
}

/**
 * @description Obtiene los indicadores de datos maestros del tenant activo.
 * @param {void} _input - La acción no requiere parámetros de entrada.
 * @param {AuthenticatedUser} user - Usuario autenticado con contexto de tenant.
 * @returns {Promise<{ metrics: MastersHealthMetrics }>} Métricas del tenant activo.
 */
export const getMastersHealthAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)

    if (user.role !== 'admin') {
      throw new ActionError(
        'No tienes permisos para consultar la salud operativa.',
        'FORBIDDEN',
      )
    }

    const [productos, categorias, unidades, proveedores, puntosDeVenta, listasPrecio] =
      await Promise.all([
        prisma.producto.count({ where: { tenantId } }),
        prisma.categoria.count({ where: { tenantId } }),
        prisma.unidad.count({ where: { tenantId } }),
        prisma.vendor.count({ where: { tenantId } }),
        prisma.puntoDeVenta.count({ where: { tenantId } }),
        prisma.listaPrecio.count({ where: { tenantId } }),
      ])

    return {
      metrics: {
        productos,
        categorias,
        unidades,
        proveedores,
        puntosDeVenta,
        listasPrecio,
      },
    }
  },
)
