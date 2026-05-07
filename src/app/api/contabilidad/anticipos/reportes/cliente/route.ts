import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('clienteId')
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')

    const where = {
      tipo: 'COBRO' as const,
      ...(clienteId ? { clienteId } : {}),
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
      include: {
        cliente: { select: { clienteId: true, nombre: true } },
        contrato: { select: { contratoId: true, numeroContrato: true } },
      },
      orderBy: { fechaReserva: 'desc' },
    })

    const grouped = new Map<string, {
      cliente: { clienteId: string; nombre: string } | null
      anticipos: typeof anticipos
      totales: { totalOriginal: number; totalEjecutado: number; totalPendiente: number }
    }>()

    for (const anticipo of anticipos) {
      const key = anticipo.clienteId || 'sin-cliente'
      const current = grouped.get(key) || {
        cliente: anticipo.cliente || null,
        anticipos: [],
        totales: { totalOriginal: 0, totalEjecutado: 0, totalPendiente: 0 },
      }

      const montoOriginal = Number(anticipo.montoOriginal || 0)
      const saldoDisponible = Number(anticipo.saldoDisponible || 0)
      current.anticipos.push(anticipo)
      current.totales.totalOriginal += montoOriginal
      current.totales.totalEjecutado += montoOriginal - saldoDisponible
      current.totales.totalPendiente += saldoDisponible
      grouped.set(key, current)
    }

    return NextResponse.json({ clientes: Array.from(grouped.values()) })
  } catch (error) {
    console.error('Error al obtener reporte de anticipos por cliente:', error)
    return NextResponse.json({ error: 'Error al obtener reporte de anticipos por cliente' }, { status: 500 })
  }
})
