import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

const querySchema = z.object({
  clienteId: z.string().optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional()
})

function anticiposEnabled(): boolean {
  return process.env.ENABLE_ANTICIPOS !== 'false'
}

export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    if (!anticiposEnabled()) {
      return NextResponse.json({ error: 'Módulo de anticipos deshabilitado' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      clienteId: searchParams.get('clienteId') || undefined,
      fechaInicio: searchParams.get('fechaInicio') || undefined,
      fechaFin: searchParams.get('fechaFin') || undefined
    })

    const whereClause: any = {
      tipo: 'COBRO'
    }

    if (query.clienteId) {
      whereClause.clienteId = query.clienteId
    }

    if (query.fechaInicio || query.fechaFin) {
      whereClause.fechaReserva = {}
      if (query.fechaInicio) {
        whereClause.fechaReserva.gte = new Date(query.fechaInicio)
      }
      if (query.fechaFin) {
        whereClause.fechaReserva.lte = new Date(query.fechaFin)
      }
    }

    const anticipos = await prisma.anticipo.findMany({
      where: whereClause,
      include: {
        cliente: {
          select: {
            clienteId: true,
            nombre: true
          }
        },
        contrato: {
          select: {
            contratoId: true,
            numeroContrato: true
          }
        },
        movimientos: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { fechaReserva: 'desc' }
    })

    // Agrupar por cliente
    const porCliente = anticipos.reduce((acc, anticipo) => {
      const clienteId = anticipo.clienteId || 'sin-cliente'
      if (!acc[clienteId]) {
        acc[clienteId] = {
          cliente: anticipo.cliente
            ? { clienteId: anticipo.cliente.clienteId, nombre: anticipo.cliente.nombre }
            : null,
          anticipos: [],
          totales: {
            totalOriginal: 0,
            totalEjecutado: 0,
            totalPendiente: 0
          }
        }
      }

      const totalEjecutado = Number(anticipo.montoOriginal) - Number(anticipo.saldoDisponible)
      acc[clienteId].anticipos.push({
        anticipoId: anticipo.anticipoId,
        numeroContrato: anticipo.contrato?.numeroContrato,
        montoOriginal: Number(anticipo.montoOriginal),
        saldoDisponible: Number(anticipo.saldoDisponible),
        estado: anticipo.estado,
        moneda: anticipo.moneda,
        fechaReserva: anticipo.fechaReserva,
        vigenciaHasta: anticipo.vigenciaHasta,
        movimientos: anticipo.movimientos.map((m) => ({
          tipo: m.tipoMovimiento,
          monto: Number(m.monto),
          fecha: m.createdAt
        }))
      })

      acc[clienteId].totales.totalOriginal += Number(anticipo.montoOriginal)
      acc[clienteId].totales.totalEjecutado += totalEjecutado
      acc[clienteId].totales.totalPendiente += Number(anticipo.saldoDisponible)

      return acc
    }, {} as Record<string, any>)

    const resultado = query.clienteId
      ? porCliente[query.clienteId] || null
      : Object.values(porCliente)

    return NextResponse.json({ reporte: resultado })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error generando reporte por cliente:', error)
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 })
  }
})
