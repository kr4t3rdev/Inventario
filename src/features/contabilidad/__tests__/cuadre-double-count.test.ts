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
  gastosDE: { findMany: vi.fn(), count: vi.fn() },
  gastoCompra: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
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
      clasificacion: 'NO_CLASIFICADA',
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
