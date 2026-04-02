import { NextRequest, NextResponse } from 'next/server'

import prisma from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

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
export const GET = withAuthGet(async (_request: NextRequest) => {
  try {
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
    }

    const [totalActivos, totalPagados, totalVencidos, montosPorMoneda, pendientePorMoneda] = await Promise.all([
      prisma.prestamoCash.count({
        where: { estado: 'ACTIVO', deletedAt: null }
      }),
      prisma.prestamoCash.count({
        where: { estado: 'PAGADO', deletedAt: null }
      }),
      prisma.prestamoCash.count({
        where: { estado: 'VENCIDO', deletedAt: null }
      }),
      prisma.prestamoCash.groupBy({
        by: ['moneda'],
        where: {
          estado: { not: 'CANCELADO' },
          deletedAt: null
        },
        _sum: { montoCapital: true }
      }),
      prisma.cuentaPorCobrar.groupBy({
        by: ['id'],
        where: {
          tipoCuenta: 'PRESTAMO_CASH',
          estado: { not: 'PAGADA' }
        },
        _sum: {
          montoDeuda: true,
          montoPagado: true
        }
      })
    ])

    // Calcular monto pendiente agrupado por moneda del préstamo
    const cuentasPendientes = await prisma.cuentaPorCobrar.findMany({
      where: {
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
    })

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
      montoPendienteCobro: pendienteCobro
    })
  } catch (error) {
    console.error('Error obteniendo estadísticas de préstamos:', error)
    return NextResponse.json({ error: 'Error obteniendo estadísticas de préstamos' }, { status: 500 })
  }
})
