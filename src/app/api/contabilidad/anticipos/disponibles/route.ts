import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

/**
 * @description Query schema para filtrar anticipos disponibles.
 */
const DisponiblesQuerySchema = z.object({
  contexto: z.enum(['compra', 'factura']).optional(),
  proveedorId: z.string().optional(),
  clienteId: z.string().optional(),
  moneda: z.string().optional(),
  estado: z.enum(['RESERVADO', 'EJECUTADO', 'ANULADO']).optional(),
})

/**
 * @description Retorna anticipos disponibles para ser aplicados a compras o facturas.
 * Filtra por tipo (PAGO para compras, COBRO para facturas), entidad y moneda.
 * Solo incluye anticipos con saldo disponible > 0 y estado RESERVADO.
 * @param {NextRequest} request - Request HTTP con query params.
 * @returns {Promise<NextResponse>} Lista de anticipos disponibles con saldo.
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)

    const rawParams = {
      contexto: searchParams.get('contexto') || undefined,
      proveedorId: searchParams.get('proveedorId') || undefined,
      clienteId: searchParams.get('clienteId') || undefined,
      moneda: searchParams.get('moneda') || undefined,
      estado: searchParams.get('estado') || undefined,
    }

    const params = DisponiblesQuerySchema.parse(rawParams)

    // Determinar el tipo de anticipo según el contexto
    let tipoFilter: 'PAGO' | 'COBRO' | undefined
    if (params.contexto === 'compra') {
      tipoFilter = 'PAGO'
    } else if (params.contexto === 'factura') {
      tipoFilter = 'COBRO'
    }

    const where: Record<string, unknown> = {
      estado: params.estado || 'RESERVADO',
      saldoDisponible: { gt: 0 },
    }

    if (tipoFilter) {
      where.tipo = tipoFilter
    }

    if (params.proveedorId) {
      where.proveedorId = params.proveedorId
    }

    if (params.clienteId) {
      where.clienteId = params.clienteId
    }

    if (params.moneda) {
      where.moneda = params.moneda
    }

    // Filtrar por vigencia: solo anticipos vigentes o sin fecha de vigencia
    const now = new Date()
    where.OR = [
      { vigenciaHasta: null },
      { vigenciaHasta: { gte: now } },
    ]

    const anticipos = await prisma.anticipo.findMany({
      where,
      include: {
        contrato: {
          select: {
            contratoId: true,
            numeroContrato: true,
            estado: true,
          },
        },
        proveedor: {
          select: {
            vendorId: true,
            nombre: true,
          },
        },
        cliente: {
          select: {
            clienteId: true,
            nombre: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ anticipos })
  } catch (error) {
    console.error('Error al obtener anticipos disponibles:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', issues: error.flatten() },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error al obtener anticipos disponibles' },
      { status: 500 }
    )
  }
})