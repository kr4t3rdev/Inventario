import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'

const querySchema = z.object({
  estado: z.enum(['ACTIVO', 'PAGADO', 'VENCIDO', 'CANCELADO']).optional(),
  clienteId: z.string().optional(),
  moneda: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
})

const createSchema = z.object({
  clienteId: z.string().min(1, 'El clienteId es requerido'),
  montoCapital: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.string().optional().default('CUP'),
  tasaInteres: z.coerce.number().positive().optional(),
  tasaCambioAlCrear: z.coerce.number().positive().optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional()
})

/**
 * @description Verifica si el módulo de préstamos cash está habilitado
 * @returns {boolean} true si está habilitado
 */
function prestamosCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false'
}

/**
 * @description Lista los préstamos cash con filtros y paginación
 * @param {NextRequest} request - Request con query params: estado, clienteId, moneda, page, limit
 * @returns {NextResponse} Lista paginada de préstamos
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      estado: searchParams.get('estado') || undefined,
      clienteId: searchParams.get('clienteId') || undefined,
      moneda: searchParams.get('moneda') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined
    })

    const skip = (query.page - 1) * query.limit

    const where = {
      deletedAt: null,
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...(query.moneda ? { moneda: query.moneda } : {})
    }

    const [prestamos, total] = await Promise.all([
      prisma.prestamoCash.findMany({
        where,
        include: {
          cliente: {
            select: {
              clienteId: true,
              nombre: true
            }
          },
          cuentaPorCobrar: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit
      }),
      prisma.prestamoCash.count({ where })
    ])

    return NextResponse.json({
      prestamos,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit)
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error listando préstamos cash:', error)
    return NextResponse.json({ error: 'Error listando préstamos cash' }, { status: 500 })
  }
})

/**
 * @description Crea un préstamo cash con su cuenta por cobrar asociada en una transacción
 * @param {NextRequest} request - Request con body: clienteId, montoCapital, moneda, tasaInteres?, fechaVencimiento?, observaciones?
 * @returns {NextResponse} Préstamo creado con status 201
 */
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: { userId: string }) => {
  try {
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
    }

    const body = createSchema.parse(await request.json())

    const prestamo = await prisma.$transaction(async (tx) => {
      const montoDeuda = body.tasaInteres
        ? Number((body.montoCapital * (1 + body.tasaInteres / 100)).toFixed(2))
        : body.montoCapital

      const cuentaPorCobrar = await tx.cuentaPorCobrar.create({
        data: {
          clienteId: body.clienteId,
          montoDeuda,
          montoPagado: 0,
          tipoCuenta: 'PRESTAMO_CASH',
          estado: 'PENDIENTE',
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined
        }
      })

      return tx.prestamoCash.create({
        data: {
          clienteId: body.clienteId,
          cuentaPorCobrarId: cuentaPorCobrar.id,
          montoCapital: body.montoCapital,
          moneda: body.moneda,
          tasaInteres: body.tasaInteres,
          tasaCambioAlCrear: body.tasaCambioAlCrear,
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined,
          observaciones: body.observaciones,
          createdById: user.userId
        },
        include: {
          cliente: {
            select: {
              clienteId: true,
              nombre: true
            }
          },
          cuentaPorCobrar: true
        }
      })
    })

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'PRESTAMO_CASH',
      entidadId: prestamo.id,
      usuarioId: user.userId,
      detalles: {
        clienteId: body.clienteId,
        montoCapital: body.montoCapital,
        moneda: body.moneda
      }
    })

    return NextResponse.json({ prestamo }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error creando préstamo cash:', error)
    return NextResponse.json({ error: 'Error creando préstamo cash' }, { status: 500 })
  }
})
