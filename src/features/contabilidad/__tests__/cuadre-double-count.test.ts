/**
 * @description Tests de prevención de doble conteo contable al facturar ofertas mixtas.
 * El cuadre actual suma Venta.total + VentaServicios.total, contando los servicios
 * dos veces cuando provienen de la misma oferta.
 * La solución es vincular VentaServicios con la Venta que lo generó (ventaId),
 * y excluir de los agregados de ingreso las VS que pertenecen a una venta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  venta: { findMany: vi.fn(), count: vi.fn() },
  ventaServicios: { findMany: vi.fn(), count: vi.fn() },
  reconciliacionGasto: { findMany: vi.fn() },
  compraServicio: { findMany: vi.fn(), count: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn() },
  gastosDE: { findMany: vi.fn(), count: vi.fn() },
  gastoCompra: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));
const exchangeRateMock = vi.hoisted(() => ({ getRateAsOf: vi.fn() }));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
  exchangeRateProvider: exchangeRateMock,
}));

import { obtenerVentasVsReconciliado } from '@/features/contabilidad/cuadre-queries';

const rango = { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') };

describe('obtenerVentasVsReconciliado – prevención de doble conteo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Oferta mixta facturada: total 300 (200 producto + 100 servicio)
    mockPrisma.venta.findMany.mockResolvedValue([
      { ventaId: 'venta-1', total: 300, cantidad: 3, createdAt: new Date('2026-01-15'), metodoPago: null, reconciliaciones: [] },
    ]);
    mockPrisma.venta.count.mockResolvedValue(1);
    // El mock debe simular el filtro Prisma: si ventaId: null en el where,
    // entonces la VS con ventaId='venta-1' queda excluida del resultado.
    mockPrisma.ventaServicios.findMany.mockImplementation(
      (args: { where: { ventaId?: null } }) => {
        if (args?.where?.ventaId === null) {
          return Promise.resolve([]); // VS vinculada a Venta: excluida
        }
        return Promise.resolve([
          {
            ventaServicioId: 'vs-1', tenantId: 'tenant-1', servicioId: 'srv-1',
            cantidad: 1, total: 100, moneda: 'CUP',
            createdAt: new Date('2026-01-15'), reconciliaciones: [],
            ventaId: 'venta-1',
          },
        ]);
      },
    );
    mockPrisma.ventaServicios.count.mockResolvedValue(0);
    mockPrisma.reconciliacionGasto.findMany.mockResolvedValue([]);
    mockPrisma.compraServicio.findMany.mockResolvedValue([]);
    mockPrisma.compraServicio.count.mockResolvedValue(0);
    mockPrisma.gastosDE.findMany.mockResolvedValue([]);
    mockPrisma.gastosDE.count.mockResolvedValue(0);
    mockPrisma.gastoCompra.findMany.mockResolvedValue([]);
    mockPrisma.gastoCompra.count.mockResolvedValue(0);
    mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({
      functionalCurrencyCode: 'CUP',
    });
    exchangeRateMock.getRateAsOf.mockResolvedValue(null);
  });

  it('no duplica el ingreso de un servicio que ya está en Venta', async () => {
    // Filtra VS vinculadas a una Venta: deben excluirse de la suma de ingresos
    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    const ventasServiciosWhere = mockPrisma.ventaServicios.findMany.mock.calls[0]?.[0]?.where;
    // El filtro debe excluir VS con ventaId no null
    expect(ventasServiciosWhere).toEqual(
      expect.objectContaining({ ventaId: null }),
    );

    // Ingreso total: solo la Venta (300), sin duplicar el servicio (100)
    const totalIngresos = result.items
      .filter((i) => i.tipo === 'VENTA' || i.tipo === 'SERVICIO')
      .reduce((sum, item) => sum + item.monto, 0);
    expect(totalIngresos).toBe(300);
    expect(mockPrisma.gastoCompra.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      tenantId: 'tenant-1', fechaCompra: rango, deletedAt: null,
    });
    expect(mockPrisma.compraServicio.findMany.mock.calls[0]?.[0]?.where).toEqual({
      tenantId: 'tenant-1', fechaServicio: rango,
    });
  });

  it('identifica como CxC una venta enlazada, sin inferir que es conciliable', async () => {
    mockPrisma.ventaServicios.findMany.mockResolvedValue([]);
    mockPrisma.venta.findMany.mockResolvedValueOnce([
      {
        ventaId: 'venta-cxc', total: 4300, createdAt: new Date('2026-01-15'),
        metodoPago: null, reconciliaciones: [],
        factura: { cuentaPorCobrar: { estado: 'PENDIENTE' } },
      },
    ]);

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    expect(result.items.find((item) => item.id === 'venta-cxc')).toMatchObject({
      clasificacion: 'CUENTA_POR_COBRAR',
      estadoCuenta: 'PENDIENTE',
    });
    expect(result.totales.cantidadPendientes).toBe(1);
    expect(mockPrisma.venta.findMany.mock.calls[0]?.[0]?.include?.factura).toEqual({
      select: { cuentaPorCobrar: { select: { estado: true } } },
    });
  });

  it('suma conciliaciones múltiples y distingue operaciones abiertas, parciales y saldadas', async () => {
    mockPrisma.ventaServicios.findMany.mockResolvedValue([]);
    mockPrisma.venta.findMany.mockResolvedValueOnce([
      {
        ventaId: 'sale-open', total: 100, createdAt: new Date('2026-01-15'), metodoPago: null,
        factura: null, VentaServicios: [], reconciliaciones: [],
      },
      {
        ventaId: 'sale-partial', total: 100, createdAt: new Date('2026-01-16'), metodoPago: null,
        factura: null, VentaServicios: [],
        reconciliaciones: [
          { monto: 30, montoConvertido: 30, fechaReconciliacion: new Date('2026-01-16') },
          { monto: 20, montoConvertido: 20, fechaReconciliacion: new Date('2026-01-17') },
        ],
      },
      {
        ventaId: 'sale-cxc-partial', total: 100, createdAt: new Date('2026-01-18'), metodoPago: null,
        factura: { cuentaPorCobrar: { estado: 'PARCIAL' } }, VentaServicios: [],
        reconciliaciones: [{ monto: 25, montoConvertido: 25, fechaReconciliacion: new Date('2026-01-18') }],
      },
      {
        ventaId: 'sale-paid', total: 100, createdAt: new Date('2026-01-19'), metodoPago: null,
        factura: { cuentaPorCobrar: { estado: 'PAGADA' } }, VentaServicios: [],
        reconciliaciones: [{ monto: 100, montoConvertido: 100, fechaReconciliacion: new Date('2026-01-19') }],
      },
    ]);

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    expect(result.items.find((item) => item.id === 'sale-open')).toMatchObject({
      estaReconciliado: false, clasificacion: 'CONCILIABLE', montoReconciliado: null, diferencia: 100,
    });
    expect(result.items.find((item) => item.id === 'sale-partial')).toMatchObject({
      estaReconciliado: false, clasificacion: 'RECONCILIADA_PARCIALMENTE', montoReconciliado: 50, diferencia: 50,
    });
    expect(result.items.find((item) => item.id === 'sale-cxc-partial')).toMatchObject({
      estaReconciliado: false, clasificacion: 'CUENTA_POR_COBRAR', estadoCuenta: 'PARCIAL',
      montoReconciliado: 25, diferencia: 75,
    });
    expect(result.items.find((item) => item.id === 'sale-paid')).toMatchObject({
      estaReconciliado: true, clasificacion: 'RECONCILIADA', estadoCuenta: 'PAGADA',
      montoReconciliado: 100, diferencia: 0,
    });
    expect(mockPrisma.venta.findMany.mock.calls[0]?.[0]?.include?.reconciliaciones).not.toHaveProperty('take');
  });

  it('convierte conciliaciones históricas con tasa cuando falta montoConvertido', async () => {
    mockPrisma.ventaServicios.findMany.mockResolvedValue([]);
    mockPrisma.venta.findMany.mockResolvedValueOnce([
      {
        ventaId: 'sale-fx-legacy', total: 100, createdAt: new Date('2026-01-15'),
        metodoPago: null, factura: null, VentaServicios: [],
        reconciliaciones: [{
          monto: 4, montoConvertido: null, moneda: 'USD', tasaCambio: 25,
          fechaReconciliacion: new Date('2026-01-15'),
        }],
      },
    ]);

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    expect(result.items.find((item) => item.id === 'sale-fx-legacy')).toMatchObject({
      montoReconciliado: 100,
      diferencia: 0,
      estaReconciliado: true,
      clasificacion: 'RECONCILIADA',
    });
  });

  it('clasifica anticipos de servicios con pagos parciales aplicados fuera del período', async () => {
    mockPrisma.venta.findMany.mockResolvedValue([]);
    mockPrisma.ventaServicios.findMany.mockResolvedValue([]);
    mockPrisma.compraServicio.findMany.mockResolvedValueOnce([
      {
        compraServicioId: 'service-advance', total: 100, estado: 'PENDIENTE',
        createdAt: new Date('2026-01-15'), numeroFactura: 'ADV-1',
      },
    ]);
    mockPrisma.reconciliacionGasto.findMany
      .mockResolvedValueOnce([
        { referenciaId: 'service-advance', monto: 25, montoConvertido: 25,
          fechaReconciliacion: new Date('2025-12-20') },
        { referenciaId: 'service-advance', monto: 15, montoConvertido: 15,
          fechaReconciliacion: new Date('2026-01-20') },
      ])
      .mockResolvedValueOnce([]);

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);
    const item = result.items.find((entry) => entry.id === 'service-advance');

    expect(item).toMatchObject({
      monto: 100,
      montoReconciliado: 40,
      diferencia: 60,
      estaReconciliado: false,
      clasificacion: 'CUENTA_POR_PAGAR',
      estadoCuenta: 'PENDIENTE',
    });
    expect(mockPrisma.reconciliacionGasto.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      tenantId: 'tenant-1',
      tipoGasto: 'servicio',
      estado: { in: ['PAGADA', 'PAGADO', 'POSTED', 'PARCIAL'] },
      referenciaId: { in: ['service-advance'] },
    });
  });

  it('usa costo por cantidad una sola vez para los gastos de servicios vendidos', async () => {
    mockPrisma.venta.findMany.mockResolvedValue([]);
    mockPrisma.ventaServicios.findMany.mockImplementation((args: { where?: { ventaId?: null; costo?: unknown } }) =>
      Promise.resolve(args?.where?.costo ? [{
        ventaServicioId: 'service-cost', costo: 15, cantidad: 4,
        createdAt: new Date('2026-01-15'),
      }] : []),
    );
    mockPrisma.reconciliacionGasto.findMany.mockResolvedValue([]);

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    expect(result.items.find((entry) => entry.id === 'costo-service-cost')).toMatchObject({
      monto: 60,
      diferencia: 60,
      clasificacion: 'CONCILIABLE',
    });
  });

  it('aplica el mismo cálculo de costo y cantidad a servicios históricos', async () => {
    mockPrisma.venta.findMany.mockResolvedValue([]);
    mockPrisma.ventaServicios.findMany.mockImplementation((args: {
      where?: { ventaId?: null; createdAt?: { lt?: Date }; costo?: unknown };
    }) => {
      if (args?.where?.ventaId === null) return Promise.resolve([]);
      if (args?.where?.createdAt?.lt) {
        return Promise.resolve([{
          ventaServicioId: 'old-service-cost', costo: 10, cantidad: 5,
          createdAt: new Date('2025-12-15'),
        }]);
      }
      return Promise.resolve([]);
    });
    mockPrisma.reconciliacionGasto.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        referenciaId: 'old-service-cost', monto: 25, montoConvertido: 25,
        moneda: 'CUP', tasaCambio: null,
        fechaReconciliacion: new Date('2025-12-20'),
      }]);

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    expect(result.itemsAntiguos.find((entry) => entry.id === 'costo-old-service-cost'))
      .toMatchObject({
        monto: 50,
        montoReconciliado: 25,
        diferencia: 25,
        clasificacion: 'RECONCILIADA_PARCIALMENTE',
      });
    expect(mockPrisma.ventaServicios.findMany.mock.calls.find(([args]) =>
      args?.where?.createdAt?.lt && args?.where?.costo === undefined,
    )?.[0]?.where).toMatchObject({ ventaId: null });
  });

  it('normaliza el total de servicios extranjeros a la moneda funcional', async () => {
    mockPrisma.venta.findMany.mockResolvedValue([]);
    mockPrisma.ventaServicios.findMany.mockResolvedValue([]);
    mockPrisma.compraServicio.findMany
      .mockResolvedValueOnce([{
        compraServicioId: 'foreign-service', total: 100, moneda: 'USD',
        estado: 'PENDIENTE', fechaServicio: new Date('2026-01-15'),
      }])
      .mockResolvedValueOnce([]);
    mockPrisma.gastoCompra.findMany.mockResolvedValueOnce([{
      gastoCompraId: 'foreign-purchase',
      total: 100,
      fechaCompra: new Date('2026-01-15'),
      compraDocumento: { moneda: 'USD' },
      cuentaPorPagar: { estado: 'PARCIAL' },
      reconciliaciones: [],
    }]);
    mockPrisma.reconciliacionGasto.findMany
      .mockResolvedValueOnce([{
        referenciaId: 'foreign-service', monto: 40, montoConvertido: 1000,
        moneda: 'USD', tasaCambio: 25, fechaReconciliacion: new Date('2026-01-16'),
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    exchangeRateMock.getRateAsOf.mockResolvedValue({
      tasaId: 'usd-cup', tasa: 25, fechaVigencia: new Date('2026-01-15'),
    });

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    expect(result.items.find((item) => item.id === 'foreign-service')).toMatchObject({
      monto: 2500,
      montoReconciliado: 1000,
      diferencia: 1500,
      moneda: 'CUP',
      clasificacion: 'CUENTA_POR_PAGAR',
      estadoCuenta: 'PENDIENTE',
    });
    expect(result.items.find((item) => item.id === 'foreign-purchase')).toMatchObject({
      monto: 2500,
      moneda: 'CUP',
      clasificacion: 'CUENTA_POR_PAGAR',
      estadoCuenta: 'PARCIAL',
    });
    expect(exchangeRateMock.getRateAsOf).toHaveBeenCalledTimes(1);
  });

  it('valora servicios históricos con la tasa vigente en la fecha del movimiento', async () => {
    const oldServiceDate = new Date('2025-12-15T12:00:00.000Z');
    mockPrisma.venta.findMany.mockResolvedValue([]);
    mockPrisma.ventaServicios.findMany.mockResolvedValue([]);
    mockPrisma.compraServicio.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        compraServicioId: 'old-foreign-service', total: 100, moneda: 'USD',
        estado: 'PENDIENTE', fechaServicio: oldServiceDate, createdAt: oldServiceDate,
      }]);
    mockPrisma.reconciliacionGasto.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        referenciaId: 'old-foreign-service', monto: 40, montoConvertido: 1000,
        moneda: 'USD', tasaCambio: 25, fechaReconciliacion: new Date('2025-12-20'),
      }])
      .mockResolvedValueOnce([]);
    exchangeRateMock.getRateAsOf.mockImplementation(({ boundaryAt }: { boundaryAt: Date }) =>
      Promise.resolve({
        tasaId: boundaryAt < rango.gte ? 'usd-cup-old' : 'usd-cup-current',
        tasa: boundaryAt < rango.gte ? 30 : 25,
        fechaVigencia: boundaryAt,
      }),
    );

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    expect(result.itemsAntiguos.find((item) => item.id === 'old-foreign-service'))
      .toMatchObject({
        monto: 3000,
        montoReconciliado: 1000,
        diferencia: 2000,
        moneda: 'CUP',
        clasificacion: 'CUENTA_POR_PAGAR',
      });
    expect(exchangeRateMock.getRateAsOf).toHaveBeenCalledWith(
      expect.objectContaining({ sourceCurrency: 'USD', targetCurrency: 'CUP', boundaryAt: oldServiceDate }),
    );
  });

  it('identifica CxC vinculada directamente a una venta de servicio', async () => {
    const service = {
      ventaServicioId: 'servicio-cxc', total: 250,
      createdAt: new Date('2026-01-15'), reconciliaciones: [],
      cuentaPorCobrar: { estado: 'PENDIENTE' }, factura: null,
    };
    mockPrisma.ventaServicios.findMany.mockImplementation((args: { where?: { ventaId?: null } }) =>
      Promise.resolve(args?.where?.ventaId === null ? [service] : []),
    );

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    expect(result.items.find((item) => item.id === 'servicio-cxc')).toMatchObject({
      clasificacion: 'CUENTA_POR_COBRAR',
      estadoCuenta: 'PENDIENTE',
    });
    expect(mockPrisma.ventaServicios.findMany.mock.calls[0]?.[0]?.include?.cuentaPorCobrar)
      .toEqual({ select: { estado: true } });
  });

  it('identifica una compra enlazada a CxP con el estado real de la cuenta', async () => {
    mockPrisma.ventaServicios.findMany.mockResolvedValue([]);
    mockPrisma.gastosDE.findMany.mockResolvedValueOnce([
      {
        gastosDEId: 'gasto-cxp', numeroFactura: 'QA-FAC-2026-001', monto: 1100,
        proveedor: 'Proveedor de prueba', createdAt: new Date('2026-01-15'),
        reconciliaciones: [], cuentaPorPagar: { estado: 'PENDIENTE' },
      },
    ]);
    mockPrisma.gastoCompra.findMany.mockResolvedValueOnce([
      {
        gastoCompraId: 'compra-cxp', numeroFactura: 'QA-FAC-2026-002',
        total: 1200, createdAt: new Date('2026-01-15'), reconciliaciones: [],
        cuentaPorPagar: { estado: 'PARCIAL' },
      },
    ]);

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    expect(result.items.find((item) => item.id === 'compra-cxp')).toMatchObject({
      monto: 1200,
      clasificacion: 'CUENTA_POR_PAGAR',
      estadoCuenta: 'PARCIAL',
    });
    expect(result.items.find((item) => item.id === 'gasto-cxp')).toMatchObject({
      clasificacion: 'CUENTA_POR_PAGAR',
      estadoCuenta: 'PENDIENTE',
    });
    expect(result.totales.cantidadGastosPendientes).toBe(2);
    expect(mockPrisma.gastosDE.findMany.mock.calls[0]?.[0]?.include?.cuentaPorPagar).toEqual({
      select: { estado: true },
    });
  });

  it('deja sin clasificar una compra sin relación CxP conocida', async () => {
    mockPrisma.ventaServicios.findMany.mockResolvedValue([]);
    mockPrisma.gastoCompra.findMany.mockResolvedValueOnce([
      {
        gastoCompraId: 'compra-sin-cxp', numeroFactura: 'QA-FAC-2026-003',
        total: 700, createdAt: new Date('2026-01-15'), reconciliaciones: [],
        cuentaPorPagar: null,
      },
    ]);

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    expect(result.items.find((item) => item.id === 'compra-sin-cxp')).toMatchObject({
		clasificacion: 'CONCILIABLE',
      estadoCuenta: null,
    });
  });

  it('clasifica vínculos CxC/CxP en operaciones históricas con estado conocido', async () => {
    mockPrisma.venta.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          ventaId: 'venta-historica-cxc', total: 900,
          createdAt: new Date('2025-12-15'), metodoPago: null, reconciliaciones: [],
          factura: { cuentaPorCobrar: { estado: 'PARCIAL' } },
          VentaServicios: [],
        },
      ]);
    mockPrisma.gastoCompra.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          gastoCompraId: 'compra-historica-cxp', numeroFactura: 'OLD-FAC-1',
          total: 500, createdAt: new Date('2025-12-15'), reconciliaciones: [],
          cuentaPorPagar: { estado: 'PENDIENTE' },
        },
      ]);
    mockPrisma.gastosDE.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          gastosDEId: 'gasto-historico-cxp', numeroFactura: 'OLD-FAC-2', monto: 300,
          proveedor: 'Proveedor histórico', createdAt: new Date('2025-12-15'),
          reconciliaciones: [], cuentaPorPagar: { estado: 'PARCIAL' },
        },
      ]);

    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    expect(result.itemsAntiguos.find((item) => item.id === 'venta-historica-cxc')).toMatchObject({
      clasificacion: 'CUENTA_POR_COBRAR',
      estadoCuenta: 'PARCIAL',
    });
    expect(result.itemsAntiguos.find((item) => item.id === 'compra-historica-cxp')).toMatchObject({
      clasificacion: 'CUENTA_POR_PAGAR',
      estadoCuenta: 'PENDIENTE',
    });
    expect(result.itemsAntiguos.find((item) => item.id === 'gasto-historico-cxp')).toMatchObject({
      clasificacion: 'CUENTA_POR_PAGAR',
      estadoCuenta: 'PARCIAL',
    });
  });
});
