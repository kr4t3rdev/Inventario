import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function handleGetReconciliacionStats(tenantId: string) {
  const todayStart = startOfDay(new Date()); const todayEnd = endOfDay(new Date())

  const ventasPendientesCount = await prisma.venta.count({ where: { tenantId, reconciliaciones: { none: {} } } })
  const ventasCompletadasHoyCount = await prisma.reconciliacionVenta.count({ where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } } })
  const serviciosPendientesCount = await prisma.reconciliacionServicio.count({ where: { tenantId, ventasServicio: { tenantId, reconciliaciones: { none: {} } } } })
  const serviciosCompletadosHoyCount = await prisma.reconciliacionServicio.count({ where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } } })

  const [salariosPendientes, gastosDEPendientes, comprasPendientes] = await Promise.all([
    prisma.pagosalario.count({ where: { tenantId, ReconciliacionGasto: { none: {} } } }),
    prisma.gastosDE.count({ where: { tenantId, reconciliaciones: { none: {} } } }),
    prisma.gastoCompra.count({ where: { tenantId, reconciliaciones: { none: {} } } })
  ])
  const gastosPendientesCount = salariosPendientes + gastosDEPendientes + comprasPendientes
  const gastosCompletadosHoyCount = await prisma.reconciliacionGasto.count({ where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } } })

  const [lastVentas, lastServicios, lastGastos] = await Promise.all([
    prisma.reconciliacionVenta.findMany({ where: { tenantId }, take: 5, orderBy: { createdAt: 'desc' }, include: { venta: { select: { ventaId: true } }, cuentaBancaria: { select: { nombreBanco: true } } } }),
    prisma.reconciliacionServicio.findMany({ where: { tenantId }, take: 5, orderBy: { createdAt: 'desc' }, include: { ventasServicio: { select: { ventaServicioId: true } }, cuentaBancaria: { select: { nombreBanco: true } } } }),
    prisma.reconciliacionGasto.findMany({ where: { tenantId }, take: 5, orderBy: { createdAt: 'desc' }, include: { cuentaBancaria: { select: { nombreBanco: true } } } })
  ])

  const activity = [
    ...lastVentas.map((i: any) => ({ id: i.reconciliacionId, type: 'venta' as const, description: 'Venta reconciliada', accountName: i.cuentaBancaria.nombreBanco, amount: Number(i.monto), date: i.createdAt, reference: `Venta #${i.venta?.ventaId?.slice(0, 8)}...` })),
    ...lastServicios.map((i: any) => ({ id: i.reconciliacionId, type: 'servicio' as const, description: 'Servicio reconciliado', accountName: i.cuentaBancaria.nombreBanco, amount: Number(i.monto), date: i.createdAt, reference: `Servicio #${i.ventasServicio?.ventaServicioId?.slice(0, 8)}...` })),
    ...lastGastos.map((i: any) => ({ id: i.reconciliacionId, type: 'gasto' as const, description: 'Gasto reconciliado', accountName: i.cuentaBancaria?.nombreBanco || 'Multi-cuenta', amount: Number(i.monto), date: i.createdAt, reference: 'Gasto' }))
  ]
  activity.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const recentActivity = activity.slice(0, 5)

  const [sumVentas, sumServicios, sumGastos] = await Promise.all([
    prisma.reconciliacionVenta.aggregate({ _sum: { montoConvertido: true }, where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.reconciliacionServicio.aggregate({ _sum: { montoConvertido: true }, where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.reconciliacionGasto.aggregate({ _sum: { montoConvertido: true }, where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } } })
  ])

  const totalReconciledAmount = (Number(sumVentas._sum.montoConvertido) || 0) + (Number(sumServicios._sum.montoConvertido) || 0) + (Number(sumGastos._sum.montoConvertido) || 0)
  const totalCompletedToday = ventasCompletadasHoyCount + serviciosCompletadosHoyCount + gastosCompletadosHoyCount
  const totalPending = ventasPendientesCount + serviciosPendientesCount + gastosPendientesCount

  return NextResponse.json({
    modules: { ventas: { pending: ventasPendientesCount, completedToday: ventasCompletadasHoyCount, totalToday: ventasPendientesCount + ventasCompletadasHoyCount }, servicios: { pending: serviciosPendientesCount, completedToday: serviciosCompletadosHoyCount, totalToday: serviciosPendientesCount + serviciosCompletadosHoyCount }, gastos: { pending: gastosPendientesCount, completedToday: gastosCompletadosHoyCount, totalToday: gastosPendientesCount + gastosCompletadosHoyCount } },
    stats: { totalPending, completedToday: totalCompletedToday, reconciledAmount: totalReconciledAmount, efficiency: totalCompletedToday + totalPending > 0 ? Math.round((totalCompletedToday / (totalCompletedToday + totalPending)) * 100) : 0 },
    recentActivity
  })
}
