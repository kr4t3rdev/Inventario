import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const proveedorId = searchParams.get('proveedorId')
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')

    const where = {
      tipo: 'PAGO',
      ...(proveedorId ? { proveedorId } : {}),
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
        proveedor: { select: { vendorId: true, nombre: true } },
        contrato: { select: { contratoId: true, numeroContrato: true } },
      },
      orderBy: { fechaReserva: 'desc' },
    })

    const grouped = new Map<string, {
      proveedor: { vendorId: string; nombre: string } | null
      anticipos: typeof anticipos
      totales: { totalOriginal: number; totalEjecutado: number; totalPendiente: number }
    }>()

    for (const anticipo of anticipos) {
      const key = anticipo.proveedorId || 'sin-proveedor'
      const current = grouped.get(key) || {
        proveedor: anticipo.proveedor || null,
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

    return NextResponse.json({ proveedores: Array.from(grouped.values()) })
  } catch (error) {
    console.error('Error al obtener reporte de anticipos por proveedor:', error)
    return NextResponse.json({ error: 'Error al obtener reporte de anticipos por proveedor' }, { status: 500 })
  }
})
