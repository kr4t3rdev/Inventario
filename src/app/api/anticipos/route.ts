import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { createAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

const CreateAnticipoSchema = z.object({
  tipo: z.enum(['PAGO', 'COBRO']),
  contratoId: z.string().min(1),
  proveedorId: z.string().optional(),
  clienteId: z.string().optional(),
  monto: z.coerce.number().positive(),
  moneda: z.string().min(1),
  cuentaOrigenId: z.string().optional(),
  tipoPagoOrigenId: z.string().optional(),
  referenciaExterna: z.string().optional(),
  vigenciaHasta: z.string().optional(),
})

/**
 * @description Lista anticipos con sus relaciones principales.
 * @param {NextRequest} _request - Request HTTP.
 * @returns {Promise<NextResponse>} Lista de anticipos.
 */
export const GET = withAuthGet(async (_request: NextRequest) => {
  try {
    const anticipos = await prisma.anticipo.findMany({
      include: {
        contrato: {
          select: {
            contratoId: true,
            estado: true,
            fechaInicio: true,
            fechaFin: true,
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
        creador: {
          select: {
            userId: true,
            name: true,
            email: true,
          },
        },
        contrato: {
          select: {
            contratoId: true,
            numeroContrato: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ anticipos })
  } catch (error) {
    console.error('Error al listar anticipos:', error)
    return NextResponse.json({ error: 'Error al listar anticipos' }, { status: 500 })
  }
})

/**
 * @description Crea un anticipo usando el workflow de negocio.
 * @param {NextRequest} request - Request HTTP.
 * @param {unknown} _context - Contexto de la ruta.
 * @param {{ userId: string }} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} Anticipo creado.
 */
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: { userId: string }) => {
  try {
    const body = await request.json()
    const payload = CreateAnticipoSchema.parse(body)

    const origenTipo = payload.tipo === 'PAGO' ? 'ANTICIPO_PAGO' : 'ANTICIPO_COBRO'

    await assertOperationAllowed(new Date(), origenTipo)

    const anticipo = await prisma.$transaction(async (tx) => {
      return createAnticipo(tx, {
        ...payload,
        vigenciaHasta: payload.vigenciaHasta || undefined,
        usuarioId: user.userId,
      })
    })

    await registrarEventoContable({
      origenTipo,
      origenId: anticipo.anticipoId,
      monto: Number(anticipo.montoOriginal),
      fechaOperacion: new Date(),
      descripcion: `Anticipo ${payload.tipo} ${anticipo.anticipoId}`,
      moneda: payload.moneda,
      usuarioId: user.userId,
    })

    return NextResponse.json({ anticipo }, { status: 201 })
  } catch (error) {
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json(serializePeriodoOperacionError(error), { status: error.status })
    }
    console.error('Error al crear anticipo:', error)

    if (isAnticipoWorkflowError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Payload inválido', issues: error.flatten() },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Error al crear anticipo' }, { status: 500 })
  }
})
