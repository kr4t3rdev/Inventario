import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { ActionError } from '@/lib/server-actions'
import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { hasFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { calcularSaldoPendientePrestamo, normalizarEstadoPrestamoCash } from '@/lib/utils/prestamo-cash'
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';

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
export const GET = withAuthGet(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    requirePermission(user, 'financiero.contabilidad.acceder', 'consultar préstamos cash');
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
      tenantId,
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
    if (error instanceof ActionError && error.code === 'FORBIDDEN') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 })
    }
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
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    requirePermission(user, 'financiero.contabilidad.acceder', 'crear préstamos cash');
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
    }
    if (!hasFeature(user, 'prestamos-cash')) {
      return NextResponse.json(
        { error: 'El plan actual no permite crear nuevos préstamos cash', code: 'FEATURE_NOT_AVAILABLE' },
        { status: 403 },
      )
    }

    const body = createSchema.parse(await request.json())

    // Validar período contable antes de crear el préstamo
    const fechaOperacion = extraerFechaDeBody(body as unknown as Record<string, unknown>) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId,
      tipoOperacion: 'prestamo_cash',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

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
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true, tenantId } })) ||
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true, tenantId } }))

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
          tenantId,
          clienteId: body.clienteId,
          montoDeuda,
          montoPagado: 0,
          tipoCuenta: 'PRESTAMO_CASH',
          estado: 'PENDIENTE',
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined
        }
      })

      const fechaReconciliacion = new Date();
      const conversion = buildPersistedAccountingAmount(
        Number(body.montoCapital),
        body.moneda || 'CUP',
        body.tasaCambioAlCrear ?? undefined,
        fechaReconciliacion,
      );
      await tx.reconciliacionVenta.create({
        data: {
          tenantId,
          cuentaId: body.cuentaBancariaId,
          tipoPagoId: tipoPagoDesembolso.tipoId,
          monto: body.montoCapital,
          moneda: body.moneda,
          ...(conversion.montoConvertido != null ? { montoConvertido: conversion.montoConvertido } : {}),
          ...(conversion.tasaCambio != null ? { tasaCambio: conversion.tasaCambio } : {}),
          fechaReconciliacion,
          ...(conversion.fxEvidence ?? {}),
          observaciones: body.observaciones || `Desembolso de préstamo cash para cliente ${body.clienteId}`,
          reconciliadoPor: user.userId,
          prestamoCashId: null,
          tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO'
        }
      })

      return tx.prestamoCash.create({
        data: {
          tenantId,
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
    if (error instanceof ActionError) {
      const status = ['FORBIDDEN', 'TENANT_REQUIRED', 'FEATURE_NOT_AVAILABLE'].includes(error.code)
        ? 403
        : error.code === 'NOT_FOUND'
          ? 404
          : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('Error creando préstamo cash:', error)
    return NextResponse.json({ error: 'Error creando préstamo cash' }, { status: 500 })
  }
})
