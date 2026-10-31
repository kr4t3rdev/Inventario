import { NextRequest, NextResponse } from 'next/server'

import prisma from '@/lib/prisma'
import { withAuthGet, type AuthenticatedUser } from '@/lib/auth-middleware'
import { ActionError } from '@/lib/server-actions'
import { requirePermission, requireTenant } from '@/lib/services/tenant-scope'

/**
 * @description Verifica si el módulo de préstamos cash está habilitado
 * @returns {boolean} true si está habilitado
 */
function prestamosCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false'
}

/**
 * @description Obtiene estadísticas resumidas del módulo de préstamos cash agrupadas por moneda
 * @param {NextRequest} _request - Request (no utilizado)
 * @returns {NextResponse} Estadísticas: totalActivos, totalPagados, totalVencidos, montoTotalPrestado, montoPendienteCobro por moneda
 */
export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
    }

    const tenantId = requireTenant(user)
    requirePermission(user, 'financiero.contabilidad.acceder', 'consultar estadísticas de préstamos cash')

    const [totalActivos, totalPagados, totalVencidos, montosPorMoneda, cuentasPendientes, resumenMovimientos] = await Promise.all([
      prisma.prestamoCash.count({
        where: { tenantId, estado: 'ACTIVO', deletedAt: null }
      }),
      prisma.prestamoCash.count({
        where: { tenantId, estado: 'PAGADO', deletedAt: null }
      }),
      prisma.prestamoCash.count({
        where: { tenantId, estado: 'VENCIDO', deletedAt: null }
      }),
      prisma.prestamoCash.groupBy({
        by: ['moneda'],
        where: {
          tenantId,
          estado: { not: 'CANCELADO' },
          deletedAt: null
        },
        _sum: { montoCapital: true }
      }),
      prisma.cuentaPorCobrar.findMany({
        where: {
          tenantId,
          tipoCuenta: 'PRESTAMO_CASH',
          estado: { not: 'PAGADA' }
        },
        select: {
          montoDeuda: true,
          montoPagado: true,
          prestamoCash: {
            select: { moneda: true }
          }
        }
      }),
      prisma.reconciliacionVenta.aggregate({
        where: {
          tenantId,
          tipoReconciliacion: 'PRESTAMO_CASH'
        },
        _sum: {
          monto: true
        },
        _avg: {
          monto: true
        }
      })
    ])

    const pendienteCobro: Record<string, number> = {}
    for (const cuenta of cuentasPendientes) {
      const moneda = cuenta.prestamoCash?.moneda ?? 'CUP'
      const pendiente = Number(cuenta.montoDeuda) - Number(cuenta.montoPagado)
      pendienteCobro[moneda] = (pendienteCobro[moneda] ?? 0) + pendiente
    }

    const montoTotalPrestado: Record<string, number> = {}
    for (const grupo of montosPorMoneda) {
      montoTotalPrestado[grupo.moneda] = Number(grupo._sum.montoCapital ?? 0)
    }

    return NextResponse.json({
      totalActivos,
      totalPagados,
      totalVencidos,
      montoTotalPrestado,
      montoPendienteCobro: pendienteCobro,
      resumenMovimientos: {
        totalPagos: Number(resumenMovimientos._sum.monto ?? 0),
        promedioPago: Number(resumenMovimientos._avg.monto ?? 0),
      }
    })
  } catch (error) {
    if (error instanceof ActionError && ['FORBIDDEN', 'TENANT_REQUIRED'].includes(error.code)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 })
    }
    console.error('Error obteniendo estadísticas de préstamos:', error)
    return NextResponse.json({ error: 'Error obteniendo estadísticas de préstamos' }, { status: 500 })
  }
})
