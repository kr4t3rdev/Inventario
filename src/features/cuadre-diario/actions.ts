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

  const [ventasDelDia, ventaServiciosDelDia, gastosDEdelDia, gastosCompraDelDia, gastosSalariosDia, todasLasVentas, tiposPago, turnosDelDia, arqueosDelDia] =
    await Promise.all([
      prisma.venta.findMany({
        where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
        include: { producto: { select: { nombre: true, precioVenta: true } }, puntoDeVenta: { select: { nombre: true } } },
      }),
      prisma.ventaServicios.findMany({
        where: { createdAt: { gte: fechaInicio, lte: fechaFin }, tenantId },
        include: {
  // @ts-expect-error - Schema mismatch with ventaServicios.servicio relation
        servicio: { select: { nombre: true } }, puntoDeVenta: { select: { nombre: true } }
        },
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
      prisma.tipoPago.findMany({
  // @ts-expect-error - isActive field may not exist in current Prisma schema
      where: { isActive: true, tenantId: null }
      }),
      // Turnos del día con fondos
      prisma.turnoPuntoVenta.findMany({
        where: { tenantId, fechaApertura: { gte: fechaInicio, lte: fechaFin } },
        include: {
          puntoDeVenta: { select: { nombre: true } },
          arqueo: true,
          _count: { select: { ventas: true } },
        },
      }),
      // Arqueos del día
      prisma.arqueoCaja.findMany({
        where: { tenantId, createdAt: { gte: fechaInicio, lte: fechaFin } },
      }),
    ])

  // @ts-expect-error - total may be Decimal or Int, reduce works regardless
  const totalVentas = ventasDelDia.reduce((sum, v: VentaConPrecio) => sum + (v.total ?? v.cantidad * (v.precioVenta ?? 0)), 0)
  const totalServicios = ventaServiciosDelDia.reduce((sum: number, v: any) => sum + (v.total ?? 0), 0)
  // @ts-expect-error - totalServicios may be Decimal, coercion is intentional
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
  // @ts-expect-error - total/price may be Decimal, coercion is intentional
    const t = v.total ?? (v.cantidad * (v.precioVenta ?? 0))
    todasLasOperaciones.push({
  // @ts-expect-error - producto.nombre may not be in Ventas type
      id: v.id, tipo: 'venta', descripcion: v.producto?.nombre ?? 'Venta',
  // @ts-expect-error - tipoPago is a relation with optional nombre
      monto: t, metodoPago: v.tipoPago?.nombre ?? 'Efectivo',
      hora: formatoFecha(v.createdAt), puntoDeVenta: v.puntoDeVenta?.nombre ?? '',
    })
  }
  for (const v of ventaServiciosDelDia) {
    todasLasOperaciones.push({
  // @ts-expect-error - servicio.nombre may not be in VentaServicios type
      id: v.id, tipo: 'servicio', descripcion: v.servicio?.nombre ?? 'Servicio',
      monto: v.total ?? 0, metodoPago: 'Transferencia',
  // @ts-expect-error - puntoDeVenta.nombre relation may not be in type
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

  // Calcular efectivo inicial y final desde turnos y arqueos
  const efectivoInicial = turnosDelDia.reduce((sum, t) => sum + t.fondoInicialCup, 0);
  const efectivoFinal = arqueosDelDia.length > 0
    ? arqueosDelDia.reduce((sum, a) => sum + a.totalEfectivoCup, 0)
    : turnosDelDia.reduce((sum, t) => {
        const ventasEfectivo = ventasDelDia
          .filter(v => (v as any).turnoId === t.id && ((v as any).metodoPago === 'EFECTIVO' || (v as any).metodoPago === 'MIXTO'))
          .reduce((s, v) => s + ((v as any).montoEfectivo ?? 0), 0);
        return sum + t.fondoInicialCup + ventasEfectivo;
      }, 0);

  // Ventas por método de pago (desde los nuevos campos estructurados)
  const ventasPorMetodoPago: Record<string, number> = {};
  for (const v of ventasDelDia) {
    const mp = (v as any).metodoPago ?? 'EFECTIVO';
    const monto = mp === 'MIXTO'
      ? ((v as any).montoEfectivo ?? 0) + ((v as any).montoTarjeta ?? 0) + ((v as any).montoTransferencia ?? 0) + ((v as any).montoCredito ?? 0)
      : (v.total ?? v.cantidad * (v.precioVenta ?? 0));
    ventasPorMetodoPago[mp] = (ventasPorMetodoPago[mp] ?? 0) + monto;
  }
  // Merge con legacy
  for (const [mp, monto] of Object.entries(resumenMetodosPago)) {
    ventasPorMetodoPago[mp] = (ventasPorMetodoPago[mp] ?? 0) + monto;
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
    resumenMetodosPago: ventasPorMetodoPago,
    totales: { efectivoInicial, efectivoFinal },
    turnosDelDia: turnosDelDia.map(t => ({
      id: t.id,
      puntoDeVenta: t.puntoDeVenta?.nombre ?? 'Desconocido',
      estado: t.estado,
      fondoInicialCup: t.fondoInicialCup,
      fondoInicialUsd: t.fondoInicialUsd,
      totalVentas: t._count?.ventas ?? 0,
      tieneArqueo: !!t.arqueo,
      arqueo: t.arqueo ? {
        totalEfectivoCup: t.arqueo.totalEfectivoCup,
        totalEfectivoUsd: t.arqueo.totalEfectivoUsd,
        diferenciaCup: t.arqueo.diferenciaCup,
        diferenciaUsd: t.arqueo.diferenciaUsd,
      } : null,
    })),
    arqueosDelDia: arqueosDelDia.map(a => ({
      id: a.id,
      totalEfectivoCup: a.totalEfectivoCup,
      totalEfectivoUsd: a.totalEfectivoUsd,
      diferenciaCup: a.diferenciaCup,
      diferenciaUsd: a.diferenciaUsd,
    })),
  }
})
