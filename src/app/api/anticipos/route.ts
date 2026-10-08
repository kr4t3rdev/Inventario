import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { ActionError } from '@/lib/server-actions/types'
import { createAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'

const CreateAnticipoSchema = z.object({
  tipo: z.enum(['PAGO', 'COBRO']),
  contratoId: z.string().min(1),
  proveedorId: z.string().optional(),
  clienteId: z.string().optional(),
  monto: z.coerce.number().positive(),
  moneda: z.string().min(1),
  cuentaOrigenId: z.string().min(1),
  tipoPagoOrigenId: z.string().min(1),
  referenciaExterna: z.string().optional(),
  vigenciaHasta: z.string().optional(),
})

/**
 * @description Lista anticipos con sus relaciones principales.
 * @param {NextRequest} _request - Request HTTP.
 * @returns {Promise<NextResponse>} Lista de anticipos.
 */
export const GET = withAuthGet(async (_request: NextRequest, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user)
    requireFeature(user, 'anticipos', 'consultar anticipos')
    requirePermission(user, 'financiero.contabilidad.acceder', 'consultar anticipos')
    const anticipos = await prisma.anticipo.findMany({
      where: { tenantId },
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ anticipos })
  } catch (error) {
    console.error('Error al listar anticipos:', error)
    if (error instanceof ActionError) {
      return NextResponse.json({ error: error.message, code: error.code },
        { status: error.code === 'FORBIDDEN' ? 403 : 400 })
    }
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
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user)
    requireFeature(user, 'anticipos', 'registrar anticipos')
    requirePermission(user, 'financiero.contabilidad.acceder', 'registrar anticipos')
    const body = await request.json()
    const payload = CreateAnticipoSchema.parse(body)

    const anticipo = await prisma.$transaction(async (tx) => {
      return createAnticipo(tx, {
        ...payload,
        tenantId,
        vigenciaHasta: payload.vigenciaHasta || undefined,
        usuarioId: user.userId,
        idempotencyKey: request.headers.get('Idempotency-Key') ?? undefined,
      })
    })

    return NextResponse.json({ anticipo }, { status: 201 })
  } catch (error) {
    console.error('Error al crear anticipo:', error)

    if (error instanceof ActionError) {
      return NextResponse.json({ error: error.message, code: error.code },
        { status: error.code === 'FORBIDDEN' ? 403 : 400 })
    }

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
