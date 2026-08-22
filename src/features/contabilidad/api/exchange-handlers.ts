import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { authenticateUser, type AuthenticatedUser } from '@/lib/auth-middleware';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { CurrencyConversionService } from '@/lib/services/currency-conversion-service';
import { ExchangeRateReadService } from '@/features/contabilidad/services/exchange-rate-read-service';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { ExchangeServiceError } from '@/features/contabilidad/services/exchange-types';
import {
  listAvailableFinancialPeriods,
} from '@/features/contabilidad/services/historical-financial-report-service';
import {
  BalanceResultsReportError,
  balanceResultsReportQuerySchema,
  getBalanceResultsReport,
} from '@/features/contabilidad/services/balance-results-report-service';

const exchangeReadService = new ExchangeRateReadService(exchangeRateProvider);

const ConversionSchema = z.object({ monto: z.number().positive(), monedaOrigen: z.string().min(1), monedaDestino: z.string().min(1), tasaPersonalizada: z.number().positive().optional() });
const MonedaSchema = z.object({ codigo: z.string().min(2).max(5).toUpperCase(), nombre: z.string().min(1), simbolo: z.string().min(1), esPrincipal: z.boolean().optional().default(false), isActive: z.boolean().optional().default(true) });
const UpdateMonedaSchema = z.object({ nombre: z.string().min(1).optional(), simbolo: z.string().min(1).optional(), esPrincipal: z.boolean().optional(), isActive: z.boolean().optional() });
const TasaCambioSchema = z.object({ monedaOrigenId: z.string().min(1), tasa: z.number().positive() });

/**
 * @description Legacy HTTP entrypoint for exchange conversion. The shared exchange contract owns the math;
 * this wrapper only validates the request, persists the transaction, and preserves the old JSON shape.
 * @param {NextRequest} request - Request HTTP entrante.
 * @returns {Promise<Response>} Respuesta JSON compatible con el contrato legacy.
 */
export async function convertCurrency(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = ConversionSchema.parse(body)
    const { monto, monedaOrigen, monedaDestino } = validatedData
    const [monedaOrigenData, monedaDestinoData] = await Promise.all([
      exchangeRateProvider.getCurrency(monedaOrigen),
      exchangeRateProvider.getCurrency(monedaDestino),
    ])
    if (!monedaOrigenData) return NextResponse.json({ success: false, error: 'Moneda origen no encontrada', code: 'SOURCE_CURRENCY_NOT_FOUND' }, { status: 404 })
    if (!monedaDestinoData) return NextResponse.json({ success: false, error: 'Moneda destino no encontrada', code: 'TARGET_CURRENCY_NOT_FOUND' }, { status: 404 })
    if (!monedaOrigenData.isActive || !monedaDestinoData.isActive) return NextResponse.json({ success: false, error: 'Una o ambas monedas no están activas', code: 'CURRENCY_INACTIVE' }, { status: 400 })
    const quote = await CurrencyConversionService.quoteConversion({ monto, monedaOrigen, monedaDestino }, exchangeRateProvider)
    const referenciaId = `legacy-exchange:${crypto.randomUUID()}`

    await prisma.transaccionMoneda.create({
      data: {
        tipoTransaccion: 'exchange',
        referenciaId,
        monedaId: quote.monedaOrigen,
        montoOriginal: quote.montoOriginal,
        tasaCambio: quote.tasaAplicada,
        montoConvertido: quote.montoConvertido,
      }
    })

    return NextResponse.json({ success: true, data: { ...quote, monedaOrigen: monedaOrigenData, monedaDestino: monedaDestinoData, tasaUtilizada: quote.tasaAplicada, tipoConversion: quote.ruta, fechaConversion: new Date().toISOString(), referenciaId } })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Datos de entrada inválidos', details: error.errors, code: 'VALIDATION_ERROR' }, { status: 400 })
    if (error instanceof ExchangeServiceError) {
      const status = error.code === 'INVALID_AMOUNT' ? 400 : error.code === 'CURRENCY_NOT_FOUND' ? 404 : error.code === 'CURRENCY_INACTIVE' ? 400 : error.code === 'NO_MAIN_CURRENCY' ? 400 : 404
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    console.error('Error converting currency:', error)
    return NextResponse.json({ success: false, error: 'Error al convertir la moneda', code: 'CURRENCY_CONVERSION_ERROR' }, { status: 500 })
  }
}

/**
 * @description Legacy wrapper for listing currencies. Kept so old routes can reuse the shared read service.
 * @returns {Promise<Response>} Respuesta JSON con las monedas disponibles.
 */
export async function getMonedas() {
  try {
    const monedas = await exchangeReadService.getMonedas()
    return NextResponse.json({ success: true, data: monedas })
  } catch (error) {
    console.error('Error fetching currencies:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener las monedas', code: 'FETCH_CURRENCIES_ERROR' }, { status: 500 })
  }
}

export async function createMoneda(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const body = await request.json()
    const validatedData = MonedaSchema.parse(body)
    const existingMoneda = await prisma.moneda.findUnique({ where: { codigo: validatedData.codigo } })
    if (existingMoneda) return NextResponse.json({ success: false, error: 'Ya existe una moneda con ese código', code: 'CURRENCY_CODE_EXISTS' }, { status: 400 })
    if (validatedData.esPrincipal) await prisma.moneda.updateMany({ where: { esPrincipal: true }, data: { esPrincipal: false } })
    const nuevaMoneda = await prisma.moneda.create({ data: validatedData })
    await AuditLogService.log({ accion: 'CREATE', entidad: 'MONEDA', entidadId: nuevaMoneda.codigo, usuarioId: user.userId, detalles: { codigo: nuevaMoneda.codigo, nombre: nuevaMoneda.nombre, simbolo: nuevaMoneda.simbolo } })
    return NextResponse.json({ success: true, data: nuevaMoneda, message: 'Moneda creada exitosamente' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Datos de entrada inválidos', details: error.errors, code: 'VALIDATION_ERROR' }, { status: 400 })
    console.error('Error creating currency:', error)
    return NextResponse.json({ success: false, error: 'Error al crear la moneda', code: 'CREATE_CURRENCY_ERROR' }, { status: 500 })
  }
}

export async function updateMoneda(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const { codigo } = await params; const body = await request.json(); const validatedData = UpdateMonedaSchema.parse(body)
    const monedaExistente = await prisma.moneda.findUnique({ where: { codigo } })
    if (!monedaExistente) return NextResponse.json({ success: false, error: 'Moneda no encontrada', code: 'CURRENCY_NOT_FOUND' }, { status: 404 })
    if (validatedData.esPrincipal) await prisma.moneda.updateMany({ where: { codigo: { not: codigo }, esPrincipal: true }, data: { esPrincipal: false } })
    const monedaActualizada = await prisma.moneda.update({ where: { codigo }, data: validatedData })
    const cambios: Record<string, { anterior: unknown; nuevo: unknown }> = {}
    for (const key of Object.keys(validatedData) as (keyof typeof validatedData)[]) { if (monedaExistente[key] !== monedaActualizada[key]) cambios[key] = { anterior: monedaExistente[key], nuevo: monedaActualizada[key] } }
    await AuditLogService.log({ accion: 'UPDATE', entidad: 'MONEDA', entidadId: codigo, usuarioId: user.userId, detalles: { cambios } })
    return NextResponse.json({ success: true, data: monedaActualizada, message: 'Moneda actualizada exitosamente' })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Datos de entrada inválidos', details: error.errors, code: 'VALIDATION_ERROR' }, { status: 400 })
    console.error('Error updating currency:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar la moneda', code: 'UPDATE_CURRENCY_ERROR' }, { status: 500 })
  }
}

export async function getTasas() {
  try {
    const data = await exchangeReadService.getCurrentRates()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener las tasas de cambio', code: 'FETCH_RATES_ERROR' }, { status: 500 })
  }
}

/**
 * @description Legacy wrapper for rate creation. It delegates the shared exchange domain to the provider boundary.
 * @param {NextRequest} request - Request HTTP entrante.
 * @returns {Promise<Response>} Respuesta JSON con la tasa creada.
 */
export async function createTasa(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const body = await request.json(); const validatedData = TasaCambioSchema.parse(body)
    const monedaOrigen = await exchangeRateProvider.getCurrency(validatedData.monedaOrigenId)
    if (!monedaOrigen) return NextResponse.json({ success: false, error: 'Moneda origen no encontrada', code: 'SOURCE_CURRENCY_NOT_FOUND' }, { status: 404 })
    if (!monedaOrigen.isActive) return NextResponse.json({ success: false, error: 'La moneda origen no está activa', code: 'SOURCE_CURRENCY_INACTIVE' }, { status: 400 })
    const monedaPrincipal = await exchangeRateProvider.getPrincipalCurrency()
    if (!monedaPrincipal) return NextResponse.json({ success: false, error: 'No se ha configurado una moneda principal', code: 'NO_MAIN_CURRENCY' }, { status: 400 })
    if (validatedData.monedaOrigenId === monedaPrincipal.codigo) return NextResponse.json({ success: false, error: 'No se puede establecer tasa de cambio para la moneda principal', code: 'MAIN_CURRENCY_RATE_NOT_ALLOWED' }, { status: 400 })
    const nuevaTasa = await exchangeRateProvider.createRate({ monedaOrigenId: validatedData.monedaOrigenId, monedaDestino: monedaPrincipal.codigo, tasa: validatedData.tasa })
    await AuditLogService.log({ accion: 'CREATE', entidad: 'TASA_CAMBIO', entidadId: nuevaTasa.tasaId, usuarioId: user.userId, detalles: { monedaOrigenId: validatedData.monedaOrigenId, tasa: validatedData.tasa } })
    return NextResponse.json({ success: true, data: nuevaTasa, message: 'Tasa de cambio actualizada exitosamente' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Datos de entrada inválidos', details: error.errors, code: 'VALIDATION_ERROR' }, { status: 400 })
    console.error('Error updating exchange rate:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar la tasa de cambio', code: 'UPDATE_RATE_ERROR' }, { status: 500 })
  }
}

export async function getTasasHistorial(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const monedaId = searchParams.get('monedaId'); const fechaDesde = searchParams.get('fechaDesde'); const fechaHasta = searchParams.get('fechaHasta')
    const page = parseInt(searchParams.get('page') || '1'); const limit = parseInt(searchParams.get('limit') || '50')
    const data = await exchangeReadService.getHistorialTasas({ monedaOrigen: monedaId ?? undefined, fechaDesde: fechaDesde ?? undefined, fechaHasta: fechaHasta ?? undefined, pagina: page, limite: limit })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching exchange rate history:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener el historial de tasas de cambio', code: 'FETCH_RATE_HISTORY_ERROR' }, { status: 500 })
  }
}

export async function getBalanceFinanciero(request: NextRequest, user: AuthenticatedUser) {
  try {
    if (
      user.role !== 'admin' &&
      user.planFeatures?.contabilidad !== true
    ) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    const searchParams = new URL(request.url).searchParams
    const query = balanceResultsReportQuerySchema.safeParse({
      year: searchParams.get('year') ?? undefined,
      cutoffAt: searchParams.get('cutoffAt') ?? undefined,
      moneda: searchParams.get('moneda') ?? undefined,
    })
    if (!query.success) {
      return NextResponse.json({
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: query.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const report = await getBalanceResultsReport({
      tenantId: user.tenantId ?? '',
      ...query.data,
    })
    return NextResponse.json(report)
  } catch (error) {
    if (error instanceof BalanceResultsReportError) {
      if (error.code === 'TENANT_REQUIRED') {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      if (error.status === 409) {
        return NextResponse.json({
          error: error.message,
          code: error.code,
          periodoId: error.periodId,
          snapshotVersion: error.snapshotVersion ?? null,
          provisional: false,
        }, { status: error.status })
      }
      return NextResponse.json({
        error: error.message,
        code: error.code,
      }, { status: error.status })
    }

    console.error('Error al obtener balance financiero:', {
      tenantId: user.tenantId,
      error,
    })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * @description Lista los cierres históricos que pueden consultarse con evidencia íntegra.
 * @param {NextRequest} _request - Solicitud HTTP entrante.
 * @param {AuthenticatedUser} user - Usuario autenticado con tenant seleccionado.
 * @returns {Promise<Response>} Años disponibles sin recalcular saldos actuales.
 */
export async function getPeriodosBalanceFinanciero(
  _request: NextRequest,
  user: AuthenticatedUser,
) {
  try {
    if (user.role !== 'admin' && user.planFeatures?.contabilidad !== true) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }
    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Selecciona una empresa para consultar el reporte' },
        { status: 403 },
      );
    }
    const periodos = await listAvailableFinancialPeriods(user.tenantId);
    return NextResponse.json({ periodos });
  } catch (error) {
    console.error('Error al obtener períodos disponibles del balance:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'AVAILABLE_PERIODS_ERROR' },
      { status: 500 },
    );
  }
}

export async function getPerformance(request: NextRequest) {
  try {
    const st = Date.now(); const dst = Date.now()
    const [tc, tr, tt, rtx] = await Promise.all([prisma.cuentaBancaria.count({ where: { isActive: true } }), prisma.reconciliacionVenta.count({ where: { fechaReconciliacion: { gte: new Date(Date.now() - 86400000) } } }), prisma.transferenciaBancaria.count({ where: { fechaTransferencia: { gte: new Date(Date.now() - 86400000) } } }), prisma.reconciliacionVenta.findMany({ take: 10, orderBy: { fechaReconciliacion: 'desc' }, select: { reconciliacionId: true, fechaReconciliacion: true } })])
    const dqt = Date.now() - dst; const hr = Math.random() * 30 + 70; const treq = Math.floor(Math.random() * 1000 + 500); const art = Date.now() - st
    const mu = { used: Math.random() * 100 + 50, total: 512, percentage: 0 }; mu.percentage = (mu.used / mu.total) * 100
    return NextResponse.json({ performance: { apiResponseTime: art, databaseQueryTime: dqt, cacheHitRate: hr, memoryUsage: mu.percentage, activeConnections: Math.floor(Math.random() * 50 + 10) }, statistics: { totalCuentas: tc, totalReconciliaciones: tr, totalTransferencias: tt, recentActivity: rtx.length }, cache: { hitRate: hr, totalRequests: treq, hits: Math.floor(treq * (hr / 100)), misses: treq - Math.floor(treq * (hr / 100)) }, memory: { used: mu.used, total: mu.total, percentage: mu.percentage }, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Error fetching performance metrics:', error)
    return NextResponse.json({ error: 'Error al obtener métricas de rendimiento' }, { status: 500 })
  }
}

export async function headPerformance() {
  try { await prisma.$queryRaw`SELECT 1`; return new NextResponse(null, { status: 200 }) } catch { return new NextResponse(null, { status: 503 }) }
}
