import { NextRequest, NextResponse } from 'next/server'

import prisma from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

function anticiposEnabled(): boolean {
  return process.env.ENABLE_ANTICIPOS !== 'false'
}

export const GET = withAuthGet(async (_request: NextRequest) => {
  try {
    if (!anticiposEnabled()) {
      return NextResponse.json({ error: 'Módulo de anticipos deshabilitado' }, { status: 404 })
    }

    // Totales por tipo
    const porTipo = await prisma.anticipo.groupBy({
      by: ['tipo'],
      _sum: {
        montoOriginal: true
      }
    })

    // Totales por estado
    const porEstado = await prisma.anticipo.groupBy({
      by: ['estado'],
      _count: true
    })

    // Totales por moneda
    const porMoneda = await prisma.anticipo.groupBy({
      by: ['moneda'],
      _sum: {
        montoOriginal: true,
        saldoDisponible: true
      }
    })

    // Evolución mensual de anticipos (últimos 6 meses)
    const fechaInicio = new Date()
    fechaInicio.setMonth(fechaInicio.getMonth() - 6)
    fechaInicio.setDate(1)

    const evolucion = await prisma.anticipo.findMany({
      where: {
        fechaReserva: {
          gte: fechaInicio
        }
      },
      select: {
        tipo: true,
        montoOriginal: true,
        fechaReserva: true
      }
    })

    // Agrupar por mes
    const evolucionAgrupada = evolucion.reduce((acc, anticipo) => {
      const mes = anticipo.fechaReserva.toISOString().substring(0, 7) // YYYY-MM
      if (!acc[mes]) {
        acc[mes] = { mes, pagos: 0, cobros: 0 }
      }
      if (anticipo.tipo === 'PAGO') {
        acc[mes].pagos += Number(anticipo.montoOriginal)
      } else {
        acc[mes].cobros += Number(anticipo.montoOriginal)
      }
      return acc
    }, {} as Record<string, { mes: string; pagos: number; cobros: number }>)

    const evolucionMensual = Object.values(evolucionAgrupada).sort((a, b) => a.mes.localeCompare(b.mes))

    // Construir respuesta
    const resultado = {
      porTipo: porTipo.reduce((acc, item) => {
        acc[item.tipo] = Number(item._sum.montoOriginal) || 0
        return acc
      }, {} as Record<string, number>),
      porEstado: porEstado.reduce((acc, item) => {
        acc[item.estado] = item._count
        return acc
      }, {} as Record<string, number>),
      porMoneda: porMoneda.reduce((acc, item) => {
        acc[item.moneda] = {
          total: Number(item._sum.montoOriginal) || 0,
          pendiente: Number(item._sum.saldoDisponible) || 0
        }
        return acc
      }, {} as Record<string, { total: number; pendiente: number }>),
      evolucion: evolucionMensual,
      totalesGenerales: {
        totalAnticipos: porTipo.reduce((sum, item) => sum + (Number(item._sum.montoOriginal) || 0), 0),
        totalPendiente: porMoneda.reduce((sum, item) => sum + (Number(item._sum.saldoDisponible) || 0), 0)
      }
    }

    return NextResponse.json({ resumen: resultado })
  } catch (error) {
    console.error('Error generando resumen de anticipos:', error)
    return NextResponse.json({ error: 'Error generando resumen' }, { status: 500 })
  }
})
