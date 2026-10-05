import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { ActionError } from '@/lib/server-actions'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { calcularMontoTotalACobrar, calcularSaldoPendientePrestamo, normalizarEstadoPrestamoCash } from '@/lib/utils/prestamo-cash'
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { resolveCashDebtCurrencyAmounts } from '@/features/contabilidad/services/cash-debt-payment-valuation';
import { getRequiredTenantAccountingPolicy } from '@/features/contabilidad/services/tenant-accounting-policy-service';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { buildEventoPrestamoOtorgado } from '@/features/contabilidad-formal/lib/event-builders';
import { auditarCreditoOverride, validarCreditoOrigen } from '@/features/ventas/services/credito-override';

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
  solicitarCreditoOverride: z.boolean().optional(),
  motivoCreditoOverride: z.string().trim().max(500).optional(),
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
      saldoPendiente: Number(calcularSaldoPendientePrestamo(
        Number(prestamo.cuentaPorCobrar?.montoDeuda ?? prestamo.montoCapital),
        Number(prestamo.cuentaPorCobrar?.montoPagado ?? 0)
      )),
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
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
    }
    requireFeature(user, 'prestamos-cash', 'crear préstamos cash');
    requirePermission(user, 'financiero.contabilidad.acceder', 'crear préstamos cash');

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

    const cliente = await prisma.cliente.findFirst({
      where: { clienteId: body.clienteId, tenantId },
      select: { clienteId: true },
    });
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }
    const cuentaOrigen = await prisma.cuentaBancaria.findFirst({
      where: { cuentaId: body.cuentaBancariaId, tenantId },
      select: { cuentaId: true, saldo: true, isActive: true, moneda: true }
    })
    if (!cuentaOrigen || !cuentaOrigen.isActive) {
      return NextResponse.json({ error: 'Cuenta bancaria no encontrada o inactiva' }, { status: 400 })
    }

    const tipoPagoDesembolso =
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true, tenantId } })) ||
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true, tenantId } }))

    if (!tipoPagoDesembolso) {
      return NextResponse.json({ error: 'No existe un tipo de pago válido para registrar el desembolso' }, { status: 400 })
    }

    const fechaReconciliacion = new Date();
    const moneda = body.moneda || 'CUP';

    const prestamo = await prisma.$transaction(async (tx) => {
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();
      const conversion = buildPersistedAccountingAmount(
        new Prisma.Decimal(body.montoCapital), moneda, body.tasaCambioAlCrear ?? undefined,
        fechaReconciliacion, undefined, functionalCurrency,
      );
      if (conversion.montoConvertido == null || !conversion.fxEvidence) {
        throw new ActionError(
          'Falta evidencia FX funcional para el préstamo', 'FX_INSUFICIENTE',
        );
      }
      const importes = resolveCashDebtCurrencyAmounts({
        monedaObligacion: moneda,
        monedaFondos: moneda,
        monedaCuenta: cuentaOrigen.moneda,
        montoFondos: body.montoCapital,
        montoFuncional: conversion.montoConvertido,
        functionalCurrency,
      });
      if (Number(cuentaOrigen.saldo) < importes.montoCuenta.toNumber()) {
        throw new ActionError(
          `Saldo insuficiente en la cuenta. Disponible: ${cuentaOrigen.saldo}`,
          'VALIDATION_ERROR',
        );
      }
      const montoDeuda = body.tasaInteres
        ? calcularMontoTotalACobrar(body.montoCapital, body.tasaInteres)
        : new Prisma.Decimal(body.montoCapital);
      const decisionCredito = await validarCreditoOrigen({
        tx,
        user,
        tenantId,
        clienteId: body.clienteId,
        moneda: body.moneda,
        montoNuevo: montoDeuda.toNumber(),
        permiso: 'financiero.prestamos-cash.credito-override',
        solicitarCreditoOverride: body.solicitarCreditoOverride,
        motivoCreditoOverride: body.motivoCreditoOverride,
      });
      const debit = await tx.cuentaBancaria.updateMany({
        where: { cuentaId: body.cuentaBancariaId, tenantId, isActive: true,
          moneda: cuentaOrigen.moneda,
          saldo: { gte: importes.montoCuenta.toNumber() } },
        data: { saldo: { decrement: importes.montoCuenta.toNumber() } }
      });
      if (debit.count !== 1) throw new Error('Cuenta bancaria no disponible');

      const cuentaPorCobrar = await tx.cuentaPorCobrar.create({
        data: {
          tenantId,
          clienteId: body.clienteId,
          montoDeuda,
          montoPagado: 0,
          monedaOriginal: moneda.toUpperCase(),
          montoOriginal: montoDeuda,
          tipoCuenta: 'PRESTAMO_CASH',
          estado: 'PENDIENTE',
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined
        }
      })

      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenantId,
          cuentaId: body.cuentaBancariaId,
          tipoPagoId: tipoPagoDesembolso.tipoId,
          monto: body.montoCapital,
          moneda,
          montoConvertido: conversion.montoConvertido,
          montoCuenta: importes.montoCuenta,
          monedaCuenta: cuentaOrigen.moneda.trim().toUpperCase(),
          ...(conversion.tasaCambio != null ? { tasaCambio: conversion.tasaCambio } : {}),
          fechaReconciliacion,
          ...(conversion.fxEvidence ?? {}),
          observaciones: body.observaciones || `Desembolso de préstamo cash para cliente ${body.clienteId}`,
          reconciliadoPor: user.userId,
          prestamoCashId: null,
          tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO'
        }
      })

      const creado = await tx.prestamoCash.create({
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
      });
      await postEvento(tx, { tenantId, userId: user.userId }, buildEventoPrestamoOtorgado({
        prestamoId: creado.id,
        valoracion: {
          monto: reconciliacion.monto,
          moneda: reconciliacion.moneda || 'CUP',
          montoFuncional: reconciliacion.montoConvertido ?? undefined,
          monedaFuncionalCodigo: functionalCurrency,
          tasaCambio: reconciliacion.tasaCambio ?? undefined,
          fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint ?? undefined,
        },
        fecha: reconciliacion.fechaReconciliacion,
      }));
      await auditarCreditoOverride({
        tx, user, decision: decisionCredito, tenantId, clienteId: body.clienteId,
        origen: 'PRESTAMO_CASH', origenId: creado.id, montoNuevo: montoDeuda.toNumber(),
      });
      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'PRESTAMO_CASH',
        entidadId: creado.id,
        usuarioId: user.userId,
        detalles: {
          clienteId: body.clienteId,
          montoCapital: body.montoCapital,
          moneda: body.moneda,
        },
      }, tx)
      return creado;
    })

    return NextResponse.json({ prestamo }, { status: 201 })
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error creando préstamo cash:', error)
    return NextResponse.json({ error: 'Error creando préstamo cash' }, { status: 500 })
  }
})
