import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { ActionError } from '@/lib/server-actions'
import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { calcularSaldoPendienteDeuda, calcularTotalDeudaConInteres, normalizarEstadoDeudaCash } from '@/lib/utils/deuda-cash'
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { resolveCashDebtCurrencyAmounts } from '@/features/contabilidad/services/cash-debt-payment-valuation';
import { getRequiredTenantAccountingPolicy } from '@/features/contabilidad/services/tenant-accounting-policy-service';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { buildEventoDeudaRecibida } from '@/features/contabilidad-formal/lib/event-builders';

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
  tasaCambio: z.coerce.number().positive().optional(),
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
export const GET = withAuthGet(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    if (!deudasCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const tenantId = requireTenant(user);
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
      tenantId,
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
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    if (!deudasCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const tenantId = requireTenant(user);
    requireFeature(user, 'deudas-cash', 'crear deudas cash');
    requirePermission(user, 'financiero.contabilidad.acceder', 'crear deudas cash');
    const rawBody = await request.json()
    console.log('[DeudaCash POST] body recibido:', JSON.stringify(rawBody))
    const body = createSchema.parse(rawBody)

    // Validar período contable antes de crear la deuda
    const fechaOperacion = extraerFechaDeBody(rawBody) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId,
      tipoOperacion: 'deuda_cash',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    const totalDeuda = calcularTotalDeudaConInteres(body.montoCapital, body.tasaInteres)

    // Referencias del tenant resueltas antes de abrir la transacción.
    const proveedor = await prisma.vendor.findFirst({
      where: { vendorId: body.proveedorId, tenantId },
      select: { nombre: true }
    })

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const cuentaOrigen = await prisma.cuentaBancaria.findFirst({
      where: { cuentaId: body.cuentaBancariaId, tenantId, isActive: true },
      select: { cuentaId: true, moneda: true }
    })
    if (!cuentaOrigen) {
      return NextResponse.json({ error: 'Cuenta bancaria no encontrada o inactiva' }, { status: 400 })
    }

    const tipoPagoDesembolso =
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true, tenantId } })) ||
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true, tenantId } }))

    if (!tipoPagoDesembolso) {
      return NextResponse.json({ error: 'No existe un tipo de pago válido para el desembolso de deuda' }, { status: 400 })
    }

    // La política funcional y la conversión se leen dentro de la transacción.
    const fechaReconciliacion = new Date();

    const deuda = await prisma.$transaction(async (tx) => {
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();
      const conversion = buildPersistedAccountingAmount(
        new Prisma.Decimal(body.montoCapital),
        body.moneda || 'CUP',
        body.tasaCambio ?? undefined,
        fechaReconciliacion,
        undefined,
        functionalCurrency,
      );
      if (conversion.montoConvertido == null || !conversion.fxEvidence) {
        throw new ActionError(
          'Falta evidencia FX funcional para la deuda', 'FX_INSUFICIENTE',
        );
      }
      const importes = resolveCashDebtCurrencyAmounts({
        monedaObligacion: body.moneda || 'CUP',
        monedaFondos: body.moneda || 'CUP',
        monedaCuenta: cuentaOrigen.moneda,
        montoFondos: body.montoCapital,
        montoFuncional: conversion.montoConvertido,
        functionalCurrency,
      })

      const debit = await tx.cuentaBancaria.updateMany({
        where: {
          cuentaId: body.cuentaBancariaId, tenantId, isActive: true,
          moneda: cuentaOrigen.moneda,
        },
        data: { saldo: { increment: importes.montoCuenta.toNumber() } }
      })
      if (debit.count !== 1) throw new Error('Cuenta bancaria no disponible')

      const lastDeuda = await tx.deudaCash.findFirst({
        orderBy: { idNumerico: 'desc' },
        select: { idNumerico: true }
      })
      const nextNum = (lastDeuda?.idNumerico ?? 0) + 1

      const cuentaPorPagar = await tx.cuentaPorPagar.create({
        data: {
          tenantId,
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

      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenantId,
          cuentaId: body.cuentaBancariaId,
          tipoPagoId: tipoPagoDesembolso.tipoId,
          monto: body.montoCapital,
          moneda: body.moneda,
          ...(conversion.montoConvertido != null ? { montoConvertido: conversion.montoConvertido } : {}),
          montoCuenta: importes.montoCuenta,
          monedaCuenta: cuentaOrigen.moneda.trim().toUpperCase(),
          ...(conversion.tasaCambio != null ? { tasaCambio: conversion.tasaCambio } : {}),
          fechaReconciliacion,
          ...(conversion.fxEvidence ?? {}),
          observaciones: body.observaciones || `Desembolso de deuda cash para proveedor ${body.proveedorId}`,
          reconciliadoPor: user.userId,
          deudaCashId: null,
          tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO'
        }
      })

      const deudaCreada = await tx.deudaCash.create({
        data: {
          tenantId,
          proveedorId: body.proveedorId,
          cuentaPorPagarId: cuentaPorPagar.cuentaPorPagarId,
          montoCapital: body.montoCapital,
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

      // Capa de contabilidad formal (CTA-1/R6): deuda recibida de terceros, una vez
      // por origen dentro de la misma transacción; valoración heredada de la fila
      // de caja persistida, sin recalcular la tasa.
      await postEvento(tx, { tenantId, userId: user.userId }, buildEventoDeudaRecibida({
        deudaId: deudaCreada.id,
        valoracion: {
          monto: reconciliacion.monto,
          moneda: reconciliacion.moneda || 'CUP',
          montoFuncional: reconciliacion.montoConvertido ?? undefined,
          monedaFuncionalCodigo: functionalCurrency,
          tasaCambio: reconciliacion.tasaCambio ?? undefined,
          fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint ?? undefined,
        },
        fecha: reconciliacion.fechaReconciliacion,
        descripcion: body.observaciones || `Deuda recibida de proveedor ${body.proveedorId}`,
      }))

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'DEUDA_CASH',
        entidadId: deudaCreada.id,
        usuarioId: user.userId,
        detalles: {
          proveedorId: body.proveedorId,
          montoCapital: body.montoCapital,
          moneda: body.moneda,
        },
      }, tx)

      return deudaCreada;
    })

    return NextResponse.json({ deuda }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[DeudaCash POST] Zod errors:', JSON.stringify(error.errors))
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error creando deuda cash:', error)
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'TENANT_REQUIRED' ? 403
        : error.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    return NextResponse.json({ error: 'Error creando deuda cash' }, { status: 500 })
  }
})
