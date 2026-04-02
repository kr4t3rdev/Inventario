import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'

const querySchema = z.object({
  estado: z.enum(['ACTIVO', 'PAGADO', 'VENCIDO', 'CANCELADO']).optional(),
  proveedorId: z.string().optional(),
  moneda: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
})

const createSchema = z.object({
  proveedorId: z.string().min(1, 'El proveedorId es requerido'),
  montoCapital: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.string().optional().default('CUP'),
  tasaInteres: z.coerce.number().positive().optional(),
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
 * @description Lista las deudas cash con filtros y paginación
 * @param {NextRequest} request - Request con query params: estado, proveedorId, moneda, page, limit
 * @returns {NextResponse} Lista paginada de deudas
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      estado: searchParams.get('estado') || undefined,
      proveedorId: searchParams.get('proveedorId') || undefined,
      moneda: searchParams.get('moneda') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined
    })

    const skip = (query.page - 1) * query.limit

    const where = {
      deletedAt: null,
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.proveedorId ? { proveedorId: query.proveedorId } : {}),
      ...(query.moneda ? { moneda: query.moneda } : {})
    }

    const [deudas, total] = await Promise.all([
      prisma.deudaCash.findMany({
        where,
        include: {
          proveedor: {
            select: {
              vendorId: true,
              nombre: true
            }
          },
          cuentaPorPagar: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit
      }),
      prisma.deudaCash.count({ where })
    ])

    return NextResponse.json({
      deudas,
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
    console.error('Error listando deudas cash:', error)
    return NextResponse.json({ error: 'Error listando deudas cash' }, { status: 500 })
  }
})

/**
 * @description Crea una deuda cash con su cuenta por pagar asociada en una transacción
 * @param {NextRequest} request - Request con body: proveedorId, montoCapital, moneda, tasaInteres?, fechaVencimiento?, observaciones?
 * @returns {NextResponse} Deuda creada con status 201
 */
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: { userId: string }) => {
  try {
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const body = createSchema.parse(await request.json())

    const proveedor = await prisma.vendor.findUnique({
      where: { vendorId: body.proveedorId },
      select: { nombre: true }
    })

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const deuda = await prisma.$transaction(async (tx) => {
      const lastDeuda = await tx.deudaCash.findFirst({
        orderBy: { idNumerico: 'desc' },
        select: { idNumerico: true }
      })
      const nextNum = (lastDeuda?.idNumerico ?? 0) + 1

      const cuentaPorPagar = await tx.cuentaPorPagar.create({
        data: {
          numeroFactura: `DC-${nextNum}`,
          proveedorId: body.proveedorId,
          proveedorNombre: proveedor.nombre,
          montoDeuda: body.montoCapital,
          montoPagado: 0,
          saldoPendiente: body.montoCapital,
          moneda: body.moneda,
          tipo: 'compra',
          tipoDeuda: 'DEUDA_CASH',
          estado: 'PENDIENTE',
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined
        }
      })

      return tx.deudaCash.create({
        data: {
          proveedorId: body.proveedorId,
          cuentaPorPagarId: cuentaPorPagar.cuentaPorPagarId,
          montoCapital: body.montoCapital,
          moneda: body.moneda,
          tasaInteres: body.tasaInteres,
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined,
          observaciones: body.observaciones,
          createdById: user.userId
        },
        include: {
          proveedor: {
            select: {
              vendorId: true,
              nombre: true
            }
          },
          cuentaPorPagar: true
        }
      })
    })

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'DEUDA_CASH',
      entidadId: deuda.id,
      usuarioId: user.userId,
      detalles: {
        proveedorId: body.proveedorId,
        montoCapital: body.montoCapital,
        moneda: body.moneda
      }
    })

    return NextResponse.json({ deuda }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error creando deuda cash:', error)
    return NextResponse.json({ error: 'Error creando deuda cash' }, { status: 500 })
  }
})
