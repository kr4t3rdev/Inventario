import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'
import { authenticateUser } from '@/lib/auth-middleware'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())

    // 1. VENTAS
    // Pendientes: Ventas sin reconciliaciones
    const ventasPendientesCount = await prisma.venta.count({
      where: {
        reconciliaciones: { none: {} }
      }
    })

    // Completados Hoy: Reconciliaciones de ventas creadas hoy
    const ventasCompletadasHoyCount = await prisma.reconciliacionVenta.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    })

    // 2. SERVICIOS
    // Pendientes: VentaServicio sin reconciliaciones
    const serviciosPendientesCount = await prisma.reconciliacionServicio.count({
      where: {
        ventasServicio: {
          reconciliaciones: { none: {} }
        }
      }
    })

    // Completados Hoy: Reconciliaciones de servicios creadas hoy
    const serviciosCompletadosHoyCount = await prisma.reconciliacionServicio.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    })

    // 3. GASTOS
    // Pendientes: Suma de pendientes en Salarios, GastosDE, Compras
    const [salariosPendientes, gastosDEPendientes, comprasPendientes] = await Promise.all([
      prisma.pagosalario.count({
        where: { ReconciliacionGasto: { none: {} } }
      }),
      prisma.gastosDE.count({
        where: { reconciliaciones: { none: {} } }
      }),
      prisma.gastoCompra.count({
        where: { reconciliaciones: { none: {} } }
      })
    ])
    
    const gastosPendientesCount = salariosPendientes + gastosDEPendientes + comprasPendientes

    // Completados Hoy: Reconciliaciones de gastos creadas hoy
    const gastosCompletadosHoyCount = await prisma.reconciliacionGasto.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    })

    // 4. RECENT ACTIVITY (Last 5)
    // Fetch last 5 from each, then merge and sort
    const [lastVentas, lastServicios, lastGastos] = await Promise.all([
      prisma.reconciliacionVenta.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          venta: {
            select: { ventaId: true } // Just to have some ref
          },
          cuentaBancaria: { select: { nombreBanco: true } }
        }
      }),
      prisma.reconciliacionServicio.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          ventasServicio: {
            select: { ventaServicioId: true }
          },
          cuentaBancaria: { select: { nombreBanco: true } }
        }
      }),
      prisma.reconciliacionGasto.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          cuentaBancaria: { select: { nombreBanco: true } }
        }
      })
    ])

    // Normalize activity items
    const activity = [
      ...lastVentas.map((item: { reconciliacionId: string; cuentaBancaria: { nombreBanco: string | null }; monto: unknown; createdAt: Date; venta: { ventaId: string | null } }) => ({
        id: item.reconciliacionId,
        type: 'venta' as const,
        description: `Venta reconciliada`,
        accountName: item.cuentaBancaria.nombreBanco,
        amount: Number(item.monto),
        date: item.createdAt,
        reference: `Venta #${item.venta?.ventaId?.slice(0, 8)}...`
      })),
      ...lastServicios.map((item: { reconciliacionId: string; cuentaBancaria: { nombreBanco: string | null }; monto: unknown; createdAt: Date; ventasServicio: { ventaServicioId: string | null } }) => ({
        id: item.reconciliacionId,
        type: 'servicio' as const,
        description: `Servicio reconciliado`,
        accountName: item.cuentaBancaria.nombreBanco,
        amount: Number(item.monto),
        date: item.createdAt,
        reference: `Servicio #${item.ventasServicio?.ventaServicioId?.slice(0, 8)}...`
      })),
      ...lastGastos.map((item: { reconciliacionId: string; cuentaBancaria: { nombreBanco: string | null } | undefined; monto: unknown; createdAt: Date }) => ({
        id: item.reconciliacionId,
        type: 'gasto' as const,
        description: `Gasto reconciliado`,
        accountName: item.cuentaBancaria?.nombreBanco || 'Multi-cuenta',
        amount: Number(item.monto),
        date: item.createdAt,
        reference: `Gasto`
      }))
    ]

    // Sort by date desc and take top 5
    activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const recentActivity = activity.slice(0, 5)

    // 5. TOTALS
    // Calculate total reconciled amount today (across all 3 types)
    // Prisma aggregate is useful here
    const [sumVentas, sumServicios, sumGastos] = await Promise.all([
        prisma.reconciliacionVenta.aggregate({
            _sum: { montoConvertido: true }, // Use converted amount to standardize
            where: { createdAt: { gte: todayStart, lte: todayEnd } }
        }),
        prisma.reconciliacionServicio.aggregate({
            _sum: { montoConvertido: true },
            where: { createdAt: { gte: todayStart, lte: todayEnd } }
        }),
        prisma.reconciliacionGasto.aggregate({
            _sum: { montoConvertido: true },
            where: { createdAt: { gte: todayStart, lte: todayEnd } }
        })
    ])

    const totalReconciledAmount = 
        (Number(sumVentas._sum.montoConvertido) || 0) + 
        (Number(sumServicios._sum.montoConvertido) || 0) + 
        (Number(sumGastos._sum.montoConvertido) || 0)

    const totalCompletedToday = ventasCompletadasHoyCount + serviciosCompletadosHoyCount + gastosCompletadosHoyCount
    const totalPending = ventasPendientesCount + serviciosPendientesCount + gastosPendientesCount

    return NextResponse.json({
      modules: {
        ventas: {
          pending: ventasPendientesCount,
          completedToday: ventasCompletadasHoyCount,
          totalToday: ventasPendientesCount + ventasCompletadasHoyCount
        },
        servicios: {
          pending: serviciosPendientesCount,
          completedToday: serviciosCompletadosHoyCount,
          totalToday: serviciosPendientesCount + serviciosCompletadosHoyCount
        },
        gastos: {
          pending: gastosPendientesCount,
          completedToday: gastosCompletadosHoyCount,
          totalToday: gastosPendientesCount + gastosCompletadosHoyCount
        }
      },
      stats: {
        totalPending,
        completedToday: totalCompletedToday,
        reconciledAmount: totalReconciledAmount,
        efficiency: totalCompletedToday + totalPending > 0 
          ? Math.round((totalCompletedToday / (totalCompletedToday + totalPending)) * 100) 
          : 0
      },
      recentActivity
    })

  } catch (error) {
    console.error('Error fetching reconciliation stats:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
