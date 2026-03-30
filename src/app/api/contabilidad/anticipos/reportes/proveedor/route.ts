import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

const querySchema = z.object({
  proveedorId: z.string().optional(),
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
      proveedorId: searchParams.get('proveedorId') || undefined,
      fechaInicio: searchParams.get('fechaInicio') || undefined,
      fechaFin: searchParams.get('fechaFin') || undefined
    })

    const whereClause: any = {
      tipo: 'PAGO'
    }

    if (query.proveedorId) {
      whereClause.proveedorId = query.proveedorId
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
        proveedor: {
          select: {
            vendorId: true,
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

    // Agrupar por proveedor
    const porProveedor = anticipos.reduce((acc, anticipo) => {
      const proveedorId = anticipo.proveedorId || 'sin-proveedor'
      if (!acc[proveedorId]) {
        acc[proveedorId] = {
          proveedor: anticipo.proveedor
            ? { vendorId: anticipo.proveedor.vendorId, nombre: anticipo.proveedor.nombre }
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
      acc[proveedorId].anticipos.push({
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

      acc[proveedorId].totales.totalOriginal += Number(anticipo.montoOriginal)
      acc[proveedorId].totales.totalEjecutado += totalEjecutado
      acc[proveedorId].totales.totalPendiente += Number(anticipo.saldoDisponible)

      return acc
    }, {} as Record<string, any>)

    const resultado = query.proveedorId
      ? porProveedor[query.proveedorId] || null
      : Object.values(porProveedor)

    return NextResponse.json({ reporte: resultado })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error generando reporte por proveedor:', error)
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 })
  }
})
