import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { authenticateUser, type AuthenticatedUser } from '@/lib/auth-middleware';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { CurrencyConversionService } from '@/lib/services/currency-conversion-service';
import { ExchangeRateReadService } from '@/features/contabilidad/services/exchange-rate-read-service';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { ExchangeServiceError } from '@/features/contabilidad/services/exchange-types';
import { calcularCostoVenta, type VentaParaCosto } from '@/features/contabilidad/utils/venta-costo';
import { calcularIngresoVenta, type VentaParaIngreso } from '@/features/contabilidad/utils/venta-ingreso';

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
      user.planFeatures?.['reportes-financieros'] !== true
    ) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    const year = parseInt(new URL(request.url).searchParams.get("year") || "") || new Date().getFullYear()
    const tenantId = user.tenantId

    if (!tenantId && user.role !== "admin") {
      return NextResponse.json({ error: "Sin contexto de empresa" }, { status: 403 })
    }

    const tenantWhere = tenantId ? { tenantId } : {}

    const cuentasBancarias = await prisma.cuentaBancaria.findMany({
      where: { ...tenantWhere, isActive: true },
      select: { nombreBanco: true, saldo: true, moneda: true },
    })
    const totalEfectivo = cuentasBancarias.reduce((acc: number, c: any) => acc + c.saldo, 0)
    const stockUbicaciones = await prisma.stockUbicacion.findMany({
      where: tenantWhere,
      select: {
        cantidad: true,
        producto: {
          select: {
            precioCosto: true,
          },
        },
      },
    })
    const totalInventario = stockUbicaciones.reduce(
      (acc: number, registro: any) =>
        acc + Number(registro.cantidad || 0) * Number(registro.producto?.precioCosto || 0),
      0,
    )
    const cuentasPorCobrar = await prisma.cuentaPorCobrar.findMany({
      where: tenantWhere,
      select: { montoDeuda: true, montoPagado: true },
    })
    const totalCuentasPorCobrar = cuentasPorCobrar.reduce((acc: number, c: any) => acc + (Number(c.montoDeuda) - Number(c.montoPagado)), 0)
    const deudasExternas = await prisma.inyeccionCapital.findMany({
      where: {
        ...(tenantId ? { cuentaBancaria: { tenantId } } : {}),
        tipo: "DEUDA_EXTERNA",
      },
      select: { saldoPendiente: true, montoTotalDeuda: true },
    })
    const totalPasivos = deudasExternas.reduce((acc: number, d: any) => acc + (d.saldoPendiente ? Number(d.saldoPendiente) : Number(d.montoTotalDeuda)), 0)
    const capitalSocial = await prisma.inyeccionCapital.findMany({
      where: {
        ...(tenantId ? { cuentaBancaria: { tenantId } } : {}),
        tipo: "CAPITAL_SOCIAL",
      },
      select: { montoRecibido: true },
    })
    const totalCapital = capitalSocial.reduce((acc: number, c: any) => acc + Number(c.montoRecibido), 0)
    const months = Array.from({ length: 12 }, (_, i) => i)
    const monthlyData = await Promise.all(months.map(async (mi) => {
      const sd = new Date(year, mi, 1); const ed = new Date(year, mi + 1, 0)
      const ventas = await prisma.venta.findMany({
        where: { ...tenantWhere, createdAt: { gte: sd, lte: ed } },
        include: {
          producto: { select: { precioCosto: true, precioVenta: true } },
          items: {
            include: {
              producto: { select: { precioCosto: true } },
              allocations: {
                include: { compraDocumentoItem: { select: { precioUnitario: true } } },
              },
            },
          },
        },
      })
      const iv = calcularIngresoVenta(ventas as unknown as VentaParaIngreso[])
      const vs = (await prisma.ventaServicios.findMany({ where: { ...tenantWhere, createdAt: { gte: sd, lte: ed } } })).reduce((a: number, v: any) => a + v.total, 0)
      const gc = (await prisma.gastoCompra.findMany({ where: { ...tenantWhere, createdAt: { gte: sd, lte: ed } } })).reduce((a: number, c: any) => a + c.total, 0)
      const vc = calcularCostoVenta(ventas as unknown as VentaParaCosto[])
      const gs = (await prisma.pagosalario.findMany({ where: { ...tenantWhere, createdAt: { gte: sd, lte: ed } } })).reduce((a: number, s: any) => a + s.salario + (s.bonificaciones ?? 0) + (s.horasExtras ?? 0), 0)
      const gg = (await prisma.gastosDE.findMany({ where: { ...tenantWhere, createdAt: { gte: sd, lte: ed } } })).reduce((a: number, g: any) => a + g.monto, 0)
      const gm = (await prisma.merma.findMany({ where: { ...tenantWhere, createdAt: { gte: sd, lte: ed } } })).reduce((a: number, m: any) => a + (m.costoTotal ?? 0), 0)
      const ti = iv + vs; const tg = vc + gc + gs + gg + gm
      return { month: mi + 1, monthName: sd.toLocaleString('es-ES', { month: 'long' }), ingresosVentas: iv, ingresosServicios: vs, totalIngresos: ti, ventasCosto: vc, gastosCompras: gc, gastosSalarios: gs, gastosGenerales: gg, gastosMermas: gm, totalGastos: tg, utilidadNeta: ti - tg }
    }))
    const anual = monthlyData.reduce((acc: any, curr: any) => ({ ingresosVentas: acc.ingresosVentas + curr.ingresosVentas, ingresosServicios: acc.ingresosServicios + curr.ingresosServicios, totalIngresos: acc.totalIngresos + curr.totalIngresos, gastosCompras: acc.gastosCompras + curr.gastosCompras, gastosSalarios: acc.gastosSalarios + curr.gastosSalarios, gastosGenerales: acc.gastosGenerales + curr.gastosGenerales, gastosMermas: acc.gastosMermas + curr.gastosMermas, totalGastos: acc.totalGastos + curr.totalGastos, utilidadNeta: acc.utilidadNeta + curr.utilidadNeta }), { ingresosVentas: 0, ingresosServicios: 0, totalIngresos: 0, gastosCompras: 0, gastosSalarios: 0, gastosGenerales: 0, gastosMermas: 0, totalGastos: 0, utilidadNeta: 0 })
    return NextResponse.json({ balance: { activos: { efectivo: totalEfectivo, inventario: totalInventario, cuentasPorCobrar: totalCuentasPorCobrar, total: totalEfectivo + totalInventario + totalCuentasPorCobrar }, pasivos: { deudaExterna: totalPasivos, total: totalPasivos }, patrimonio: { capitalSocial: totalCapital, utilidadEjercicio: anual.utilidadNeta, total: totalCapital + anual.utilidadNeta } }, estadoResultados: { mensual: monthlyData, anual } })
  } catch (error) {
    console.error("Error al obtener balance financiero:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
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
