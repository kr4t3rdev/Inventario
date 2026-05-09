/**
 * @description Server Actions para Cuadre Diario.
 */
'use server'

import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

function formatoFecha(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface VentaConPrecio {
  id: string
  cantidad: number
  precioVenta: number
  total?: number
  createdAt: Date
  puntoDeVenta?: { nombre?: string } | null
  producto?: { nombre?: string; precioVenta?: number } | null
  tipoPago?: { nombre?: string } | null
}

interface GastoFormateado {
  id: string
  tipo: string
  descripcion: string | null
  monto: number
  moneda: string
  hora: string
  metodoPago: string
}

export const getCuadreDiarioAction = withAction(async (fecha: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user)

  const ahora = new Date()
  const f = fecha ? new Date(fecha + 'T00:00:00') : new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const year = f.getFullYear()
  const month = String(f.getMonth() + 1).padStart(2, '0')
  const day = String(f.getDate()).padStart(2, '0')

  const fechaInicio = new Date(`${year}-${month}-${day}T00:00:00`)
  const fechaFin = new Date(`${year}-${month}-${day}T23:59:59.999`)

  const [ventasDelDia, ventaServiciosDelDia, gastosDEdelDia, gastosCompraDelDia, gastosSalariosDia, todasLasVentas, tiposPago] =
    await Promise.all([
      prisma.venta.findMany({
        where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
        include: { producto: { select: { nombre: true, precioVenta: true } }, puntoDeVenta: { select: { nombre: true } } },
      }),
      prisma.ventaServicios.findMany({
        where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
        include: { servicio: { select: { nombre: true } }, puntoDeVenta: { select: { nombre: true } } },
      }),
      prisma.gastosDE.findMany({
        where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
      }),
      prisma.gastoCompra.findMany({
        where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
        include: { vendor: { select: { nombre: true } } },
      }),
      prisma.pagosalario.findMany({
        where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
        include: { empleado: { select: { nombre: true } } },
      }),
      prisma.venta.findMany({
        where: { createdAt: { lte: fechaFin }, tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tipoPago.findMany({ where: { isActive: true, tenantId: null } }),
    ])

  const totalVentas = ventasDelDia.reduce((sum, v: VentaConPrecio) => sum + (v.total ?? v.cantidad * (v.precioVenta ?? 0)), 0)
  const totalServicios = ventaServiciosDelDia.reduce((sum: number, v: any) => sum + (v.total ?? 0), 0)
  const totalIngresos = totalVentas + totalServicios
  const totalGastosDE = gastosDEdelDia.reduce((sum: number, g: any) => sum + g.monto, 0)
  const totalGastosSalarios = gastosSalariosDia.reduce((sum: number, s: any) => sum + s.salario + (s.bonificaciones ?? 0) + (s.horasExtras ?? 0), 0)
  const totalGastosCompra = gastosCompraDelDia.reduce((sum: number, c: any) => sum + Number(c.total ?? 0), 0)
  const totalGastos = totalGastosDE + totalGastosSalarios + totalGastosCompra
  const diferencia = totalIngresos - totalGastos

  const ayer = new Date(fechaInicio)
  ayer.setDate(ayer.getDate() - 1)
  const ayerInicio = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate())
  const ayerFin = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate(), 23, 59, 59, 999)

  const ventasAyer = await prisma.venta.findMany({
    where: { createdAt: { gte: ayerInicio, lte: ayerFin }, tenantId },
  })
  const serviciosAyer = await prisma.ventaServicios.findMany({
    where: { createdAt: { gte: ayerInicio, lte: ayerFin }, tenantId },
  })
  const ingresosAyer = ventasAyer.reduce((sum: number, v: any) => sum + (v.total ?? v.cantidad * (v.precioVenta ?? 0)), 0)
    + serviciosAyer.reduce((sum: number, v: any) => sum + (v.total ?? 0), 0)

  const calcularVariacion = (actual: number, anterior: number) => {
    if (anterior === 0) return actual > 0 ? 100 : 0
    return ((actual - anterior) / anterior) * 100
  }
  const variacionVentas = calcularVariacion(totalIngresos, ingresosAyer)

  const todasLasOperaciones: any[] = []
  for (const v of ventasDelDia) {
    const t = v.total ?? (v.cantidad * (v.precioVenta ?? 0))
    todasLasOperaciones.push({
      id: v.id, tipo: 'venta', descripcion: v.producto?.nombre ?? 'Venta',
      monto: t, metodoPago: v.tipoPago?.nombre ?? 'Efectivo',
      hora: formatoFecha(v.createdAt), puntoDeVenta: v.puntoDeVenta?.nombre ?? '',
    })
  }
  for (const v of ventaServiciosDelDia) {
    todasLasOperaciones.push({
      id: v.id, tipo: 'servicio', descripcion: v.servicio?.nombre ?? 'Servicio',
      monto: v.total ?? 0, metodoPago: 'Transferencia',
      hora: formatoFecha(v.createdAt), puntoDeVenta: v.puntoDeVenta?.nombre ?? '',
    })
  }

  const gastosFormateados: GastoFormateado[] = []
  for (const g of gastosDEdelDia) {
    gastosFormateados.push({
      id: g.gastosDEId, tipo: 'gasto_operativo', descripcion: g.descripcion || g.tipo,
      monto: g.monto, moneda: 'CUP', hora: formatoFecha(g.createdAt), metodoPago: 'Efectivo',
    })
  }
  for (const c of gastosCompraDelDia) {
    gastosFormateados.push({
      id: c.gastoCompraId, tipo: 'compra', descripcion: c.descripcion || (c.vendor?.nombre ?? 'Compra'),
      monto: Number(c.total ?? 0), moneda: 'CUP', hora: formatoFecha(c.createdAt), metodoPago: 'Efectivo',
    })
  }
  for (const s of gastosSalariosDia) {
    const monto = s.salario + (s.bonificaciones ?? 0) + (s.horasExtras ?? 0)
    gastosFormateados.push({
      id: s.pgId, tipo: 'salario', descripcion: `Salario: ${s.empleado?.nombre ?? ''}`,
      monto, moneda: 'CUP', hora: formatoFecha(s.createdAt), metodoPago: 'Transferencia',
    })
  }

  const resumenMetodosPago: Record<string, number> = {}
  for (const op of todasLasOperaciones) {
    resumenMetodosPago[op.metodoPago] = (resumenMetodosPago[op.metodoPago] ?? 0) + op.monto
  }

  return {
    resumen: {
      fecha: formatoFecha(f),
      totalVentas, totalServicios, totalIngresos,
      totalGastosDE, totalGastosSalarios, totalGastosCompra,
      totalGastos, diferencia,
      variacionPorcentual: variacionVentas, ingresosAyer,
    },
    ventas: todasLasOperaciones,
    gastos: gastosFormateados,
    resumenMetodosPago,
    totales: { efectivoInicial: 0, efectivoFinal: 0 },
  }
})
