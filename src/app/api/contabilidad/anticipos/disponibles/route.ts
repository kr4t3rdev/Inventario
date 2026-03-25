import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

const querySchema = z.object({
  contexto: z.enum(['compra', 'factura']),
  proveedorId: z.string().optional(),
  clienteId: z.string().optional(),
  moneda: z.string().optional()
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
      contexto: searchParams.get('contexto'),
      proveedorId: searchParams.get('proveedorId') || undefined,
      clienteId: searchParams.get('clienteId') || undefined,
      moneda: searchParams.get('moneda') || undefined
    })

    const tipo = query.contexto === 'compra' ? 'PAGO' : 'COBRO'
    const anticipos = await prisma.anticipo.findMany({
      where: {
        tipo,
        estado: 'RESERVADO',
        saldoDisponible: { gt: 0 },
        ...(query.proveedorId ? { proveedorId: query.proveedorId } : {}),
        ...(query.clienteId ? { clienteId: query.clienteId } : {}),
        ...(query.moneda ? { moneda: query.moneda } : {}),
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: new Date() } }]
      },
      include: {
        contrato: {
          select: {
            contratoId: true,
            numeroContrato: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ anticipos })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error listando anticipos disponibles:', error)
    return NextResponse.json({ error: 'Error listando anticipos disponibles' }, { status: 500 })
  }
})
