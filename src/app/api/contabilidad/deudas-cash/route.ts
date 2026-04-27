import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { calcularSaldoPendienteDeuda, calcularTotalDeudaConInteres, normalizarEstadoDeudaCash } from '@/lib/utils/deuda-cash'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

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
  tasaInteres: z.coerce.number().min(0).optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  comprobanteUrl: z.string().url().optional(),
  cuentaBancariaId: z.string().min(1, 'La cuenta bancaria es requerida')
})

/**
 * @description Verifica si el módulo de deudas cash está habilitado
 * @returns {boolean} true si está habilitado
 */
function deudasCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false'
}

/**
 * @description Lista las deudas cash con filtros y paginación
 * @param {NextRequest} request - Request con query params: estado, proveedorId, moneda, page, limit
 * @returns {NextResponse} Lista paginada de deudas
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    if (!deudasCashEnabled()) {
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
          cuentaPorPagar: true,
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
      prisma.deudaCash.count({ where })
    ])

    const deudasNormalizadas = deudas.map((deuda) => ({
      ...deuda,
      estado: normalizarEstadoDeudaCash(deuda.estado, {
        montoDeuda: Number(deuda.cuentaPorPagar?.montoDeuda ?? deuda.montoCapital),
        montoPagado: Number(deuda.cuentaPorPagar?.montoPagado ?? 0),
        estado: deuda.cuentaPorPagar?.estado,
      }),
      saldoPendiente: calcularSaldoPendienteDeuda(
        Number(deuda.cuentaPorPagar?.montoDeuda ?? deuda.montoCapital),
        Number(deuda.cuentaPorPagar?.montoPagado ?? 0)
      )
    }))

    return NextResponse.json({
      deudas: deudasNormalizadas,
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
    if (!deudasCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const rawBody = await request.json()
    console.log('[DeudaCash POST] body recibido:', JSON.stringify(rawBody))
    const body = createSchema.parse(rawBody)
    const totalDeuda = calcularTotalDeudaConInteres(body.montoCapital, body.tasaInteres)

    await assertOperationAllowed(new Date(), 'DEUDA_CASH')

    const proveedor = await prisma.vendor.findUnique({
      where: { vendorId: body.proveedorId },
      select: { nombre: true }
    })

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const deuda = await prisma.$transaction(async (tx) => {
      const tipoPagoDesembolso =
        (await tx.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true } })) ||
        (await tx.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true } }))

      if (!tipoPagoDesembolso) {
        throw new Error('No existe un tipo de pago válido para el desembolso de deuda')
      }

      await tx.cuentaBancaria.update({
        where: { cuentaId: body.cuentaBancariaId },
        data: { saldo: { increment: body.montoCapital } }
      })

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
          montoDeuda: totalDeuda,
          montoPagado: 0,
          saldoPendiente: totalDeuda,
          moneda: body.moneda,
          tipo: 'compra',
          tipoDeuda: 'DEUDA_CASH',
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
          montoConvertido: body.montoCapital,
          fechaReconciliacion: new Date(),
          observaciones: body.observaciones || `Desembolso de deuda cash para proveedor ${body.proveedorId}`,
          reconciliadoPor: user.userId,
          deudaCashId: null,
          tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO'
        }
      })

      return tx.deudaCash.create({
        data: {
          proveedorId: body.proveedorId,
          cuentaPorPagarId: cuentaPorPagar.cuentaPorPagarId,
          montoCapital: body.montoCapital,
          montoTotalDeuda: totalDeuda,
          moneda: body.moneda,
          tasaInteres: body.tasaInteres,
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined,
          observaciones: body.observaciones,
          comprobanteUrl: body.comprobanteUrl,
          cuentaBancariaId: body.cuentaBancariaId,
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

    await registrarEventoContable({
      origenTipo: 'DEUDA_CASH',
      origenId: deuda.id,
      monto: body.montoCapital,
      fechaOperacion: new Date(),
      descripcion: `Desembolso de deuda cash para proveedor ${body.proveedorId}`,
      moneda: body.moneda,
      usuarioId: user.userId,
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
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      console.error('[DeudaCash POST] Zod errors:', JSON.stringify(error.errors))
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error creando deuda cash:', error)
    return NextResponse.json({ error: 'Error creando deuda cash' }, { status: 500 })
  }
})
