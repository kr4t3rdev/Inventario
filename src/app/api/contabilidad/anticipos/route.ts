import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { createAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import { AuditLogService } from '@/lib/services/audit-log-service'

const querySchema = z.object({
  tipo: z.enum(['PAGO', 'COBRO']).optional(),
  estado: z.enum(['RESERVADO', 'EJECUTADO', 'ANULADO']).optional(),
  proveedorId: z.string().optional(),
  clienteId: z.string().optional(),
  moneda: z.string().optional()
})

const createSchema = z.object({
  tipo: z.enum(['PAGO', 'COBRO']),
  contratoId: z.string().min(1),
  proveedorId: z.string().optional(),
  clienteId: z.string().optional(),
  monto: z.coerce.number().positive(),
  moneda: z.string().min(1),
  cuentaOrigenId: z.string().optional(),
  tipoPagoOrigenId: z.string().optional(),
  referenciaExterna: z.string().optional(),
  vigenciaHasta: z.string().optional()
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
      tipo: searchParams.get('tipo') || undefined,
      estado: searchParams.get('estado') || undefined,
      proveedorId: searchParams.get('proveedorId') || undefined,
      clienteId: searchParams.get('clienteId') || undefined,
      moneda: searchParams.get('moneda') || undefined
    })

    const anticipos = await prisma.anticipo.findMany({
      where: {
        ...(query.tipo ? { tipo: query.tipo } : {}),
        ...(query.estado ? { estado: query.estado } : {}),
        ...(query.proveedorId ? { proveedorId: query.proveedorId } : {}),
        ...(query.clienteId ? { clienteId: query.clienteId } : {}),
        ...(query.moneda ? { moneda: query.moneda } : {})
      },
      include: {
        contrato: {
          select: {
            contratoId: true,
            numeroContrato: true
          }
        },
        proveedor: {
          select: {
            vendorId: true,
            nombre: true
          }
        },
        cliente: {
          select: {
            clienteId: true,
            nombre: true
          }
        },
        movimientos: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ anticipos })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error listando anticipos:', error)
    return NextResponse.json({ error: 'Error listando anticipos' }, { status: 500 })
  }
})

export const POST = withAuthPost(async (request: NextRequest, _context: any, user: any) => {
  try {
    if (!anticiposEnabled()) {
      return NextResponse.json({ error: 'Módulo de anticipos deshabilitado' }, { status: 404 })
    }

    const body = createSchema.parse(await request.json())
    const anticipo = await prisma.$transaction(async (tx) =>
      createAnticipo(tx, {
        tipo: body.tipo,
        contratoId: body.contratoId,
        proveedorId: body.proveedorId,
        clienteId: body.clienteId,
        monto: body.monto,
        moneda: body.moneda,
        cuentaOrigenId: body.cuentaOrigenId,
        tipoPagoOrigenId: body.tipoPagoOrigenId,
        referenciaExterna: body.referenciaExterna,
        vigenciaHasta: body.vigenciaHasta,
        usuarioId: user.userId
      })
    )

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'ANTICIPO',
      entidadId: anticipo.anticipoId,
      usuarioId: user.userId,
      detalles: {
        tipo: anticipo.tipo,
        moneda: anticipo.moneda,
        montoOriginal: Number(anticipo.montoOriginal),
        estado: anticipo.estado
      }
    })

    return NextResponse.json({ anticipo }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    if (isAnticipoWorkflowError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('Error creando anticipo:', error)
    return NextResponse.json({ error: 'Error creando anticipo' }, { status: 500 })
  }
})
