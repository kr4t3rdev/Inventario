import { NextRequest, NextResponse } from 'next/server'

import prisma from '@/lib/prisma'
import { withAuthGet, type AuthenticatedUser } from '@/lib/auth-middleware'
import { hasPermission, requireTenant } from '@/lib/services/tenant-scope'

/**
 * @description Verifica si el módulo de deudas cash está habilitado
 * @returns {boolean} true si está habilitado
 */
function deudasCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false'
}

/**
 * @description Obtiene estadísticas resumidas del módulo de deudas cash agrupadas por moneda
 * @param {NextRequest} _request - Request (no utilizado)
 * @returns {NextResponse} Estadísticas: totalActivas, totalPagadas, totalVencidas, montoTotalDeuda, montoPendientePago por moneda
 */
export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    if (!deudasCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const tenantId = requireTenant(user)
    if (!hasPermission(user, 'financiero.contabilidad.acceder')) {
      return NextResponse.json(
        { error: 'No tienes permiso para consultar estadísticas contables', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }

    const [totalActivas, totalPagadas, totalVencidas, montosPorMoneda] = await Promise.all([
      prisma.deudaCash.count({
        where: { tenantId, estado: 'ACTIVO', deletedAt: null }
      }),
      prisma.deudaCash.count({
        where: { tenantId, estado: 'PAGADO', deletedAt: null }
      }),
      prisma.deudaCash.count({
        where: { tenantId, estado: 'VENCIDO', deletedAt: null }
      }),
      prisma.deudaCash.groupBy({
        by: ['moneda'],
        where: {
          tenantId,
          estado: { not: 'CANCELADO' },
          deletedAt: null
        },
        _sum: { montoCapital: true }
      }),
    ])

    // Calcular monto pendiente agrupado por moneda de la deuda
    const cuentasPendientes = await prisma.cuentaPorPagar.findMany({
      where: {
        tenantId,
        tipoDeuda: 'DEUDA_CASH',
        estado: { not: 'PAGADA' }
      },
      select: {
        montoDeuda: true,
        montoPagado: true,
        deudaCash: {
          select: { moneda: true }
        }
      }
    })

    const montoPendientePago: Record<string, number> = {}
    for (const cuenta of cuentasPendientes) {
      const moneda = cuenta.deudaCash?.moneda ?? 'CUP'
      const pendiente = Number(cuenta.montoDeuda) - Number(cuenta.montoPagado)
      montoPendientePago[moneda] = (montoPendientePago[moneda] ?? 0) + pendiente
    }

    const montoTotalDeuda: Record<string, number> = {}
    for (const grupo of montosPorMoneda) {
      montoTotalDeuda[grupo.moneda] = Number(grupo._sum.montoCapital ?? 0)
    }

    return NextResponse.json({
      totalActivas,
      totalPagadas,
      totalVencidas,
      montoTotalDeuda,
      montoPendientePago,
    })
  } catch (error) {
    console.error('Error obteniendo estadísticas de deudas:', error)
    return NextResponse.json({ error: 'Error obteniendo estadísticas de deudas' }, { status: 500 })
  }
})
