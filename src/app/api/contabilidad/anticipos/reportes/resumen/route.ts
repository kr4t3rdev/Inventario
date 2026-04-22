import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')

    const where = {
      ...(tipo ? { tipo } : {}),
      ...(fechaInicio || fechaFin
        ? {
            fechaReserva: {
              ...(fechaInicio ? { gte: new Date(fechaInicio) } : {}),
              ...(fechaFin ? { lte: new Date(fechaFin) } : {}),
            },
          }
        : {}),
    }

    const anticipos = await prisma.anticipo.findMany({
      where,
      select: {
        tipo: true,
        estado: true,
        moneda: true,
        montoOriginal: true,
        saldoDisponible: true,
      },
    })

    const porTipo = anticipos.reduce((acc: Record<string, number>, anticipo) => {
      const key = anticipo.tipo || 'UNKNOWN'
      acc[key] = (acc[key] || 0) + Number(anticipo.montoOriginal || 0)
      return acc
    }, {})

    const porEstado = anticipos.reduce((acc: Record<string, number>, anticipo) => {
      const key = anticipo.estado || 'UNKNOWN'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const porMoneda = anticipos.reduce((acc: Record<string, { total: number; pendiente: number }>, anticipo) => {
      const key = anticipo.moneda || 'CUP'
      if (!acc[key]) acc[key] = { total: 0, pendiente: 0 }
      acc[key].total += Number(anticipo.montoOriginal || 0)
      acc[key].pendiente += Number(anticipo.saldoDisponible || 0)
      return acc
    }, {})

    const totalAnticipos = anticipos.reduce((sum, anticipo) => sum + Number(anticipo.montoOriginal || 0), 0)
    const totalPendiente = anticipos.reduce((sum, anticipo) => sum + Number(anticipo.saldoDisponible || 0), 0)

    return NextResponse.json({
      resumen: {
        porTipo,
        porEstado,
        porMoneda,
        totalesGenerales: {
          totalAnticipos,
          totalEjecutado: totalAnticipos - totalPendiente,
          totalPendiente,
        },
      },
    })
  } catch (error) {
    console.error('Error al obtener resumen de anticipos:', error)
    return NextResponse.json({ error: 'Error al obtener resumen de anticipos' }, { status: 500 })
  }
})
