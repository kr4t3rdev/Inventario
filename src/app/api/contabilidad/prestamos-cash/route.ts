import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { calcularSaldoPendientePrestamo, normalizarEstadoPrestamoCash } from '@/lib/utils/prestamo-cash'

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
  tasaInteres: z.coerce.number().min(0).optional(),
  tasaCambioAlCrear: z.coerce.number().positive().optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  cuentaBancariaId: z.string().min(1, 'La cuenta bancaria es requerida')
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
          cuentaPorCobrar: true,
          reconciliaciones: {
            include: {
              tipoPago: true,
              cuentaBancaria: true
            },
            orderBy: {
              fechaReconciliacion: 'desc'
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit
      }),
      prisma.prestamoCash.count({ where })
    ])

    const prestamosNormalizados = prestamos.map((prestamo) => ({
      ...prestamo,
      estado: normalizarEstadoPrestamoCash(prestamo.estado, {
        montoDeuda: Number(prestamo.cuentaPorCobrar?.montoDeuda ?? prestamo.montoCapital),
        montoPagado: Number(prestamo.cuentaPorCobrar?.montoPagado ?? 0),
        estado: prestamo.cuentaPorCobrar?.estado,
      }),
      saldoPendiente: calcularSaldoPendientePrestamo(
        Number(prestamo.cuentaPorCobrar?.montoDeuda ?? prestamo.montoCapital),
        Number(prestamo.cuentaPorCobrar?.montoPagado ?? 0)
      ),
    }))

    return NextResponse.json({
      prestamos: prestamosNormalizados,
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

    const cuentaOrigen = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId: body.cuentaBancariaId },
      select: { cuentaId: true, saldo: true, isActive: true }
    })
    if (!cuentaOrigen || !cuentaOrigen.isActive) {
      return NextResponse.json({ error: 'Cuenta bancaria no encontrada o inactiva' }, { status: 400 })
    }
    if (cuentaOrigen.saldo < body.montoCapital) {
      return NextResponse.json(
        { error: `Saldo insuficiente en la cuenta. Disponible: ${cuentaOrigen.saldo}` },
        { status: 400 }
      )
    }

    const tipoPagoDesembolso =
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true } })) ||
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true } }))

    if (!tipoPagoDesembolso) {
      return NextResponse.json({ error: 'No existe un tipo de pago válido para registrar el desembolso' }, { status: 400 })
    }

    const prestamo = await prisma.$transaction(async (tx) => {
      await tx.cuentaBancaria.update({
        where: { cuentaId: body.cuentaBancariaId },
        data: { saldo: { decrement: body.montoCapital } }
      })

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

      await tx.reconciliacionVenta.create({
        data: {
          cuentaId: body.cuentaBancariaId,
          tipoPagoId: tipoPagoDesembolso.tipoId,
          monto: body.montoCapital,
          moneda: body.moneda,
          montoConvertido: body.tasaCambioAlCrear ? body.montoCapital * body.tasaCambioAlCrear : body.montoCapital,
          tasaCambio: body.tasaCambioAlCrear,
          fechaReconciliacion: new Date(),
          observaciones: body.observaciones || `Desembolso de préstamo cash para cliente ${body.clienteId}`,
          reconciliadoPor: user.userId,
          prestamoCashId: null,
          tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO'
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
          cuentaBancariaId: body.cuentaBancariaId,
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
