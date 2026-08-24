import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  reconciliacionVenta: { findMany: vi.fn() },
  reconciliacionServicio: { findMany: vi.fn() },
  reconciliacionGasto: { findMany: vi.fn() },
  merma: { findMany: vi.fn() },
  compraServicio: { findMany: vi.fn() },
  ventaServicios: { findMany: vi.fn() },
}));

const tenantPolicyMock = vi.hoisted(() => ({
  getRequiredTenantAccountingPolicy: vi.fn(),
}));

const costoMock = vi.hoisted(() => ({ calcularDetalleCostoVenta: vi.fn() }));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => tenantPolicyMock);
vi.mock('@/features/contabilidad/utils/venta-costo', () => costoMock);

import { getReconciledResultForYear } from '../reconciled-result-service';

const YEAR = 2026;

/**
 * @description Configura un modelo Prisma simulado que distingue la lectura del período
 * actual de las lecturas auxiliares de período anterior.
 * @param {{findMany: (args?: unknown) => Promise<unknown[]>}} model - Modelo simulado.
 * @param {unknown[]} inYearRows - Filas del período solicitado.
 * @returns {void} No devuelve valor; configura el mock recibido.
 */
function scopeInYear(model: { findMany: (args?: unknown) => Promise<unknown[]> }, inYearRows: unknown[]): void {
  model.findMany.mockImplementation((args?: { where?: { fechaReconciliacion?: Record<string, unknown> } }) => {
    const range = args?.where?.fechaReconciliacion;
    if (range && !('gte' in range)) return Promise.resolve([]);
    return Promise.resolve(inYearRows);
  });
}

function baseRec(overrides: Record<string, unknown> = {}) {
  return {
    reconciliacionId: 'rec-1',
    monto: 100,
    moneda: 'USD',
    montoConvertido: 2400,
    tasaCambio: 24,
    fechaReconciliacion: new Date('2026-01-15T12:00:00.000Z'),
    ...overrides,
  };
}

describe('getReconciledResultForYear unidades monetarias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantPolicyMock.getRequiredTenantAccountingPolicy.mockResolvedValue({
      tenantId: 'tenant-1',
      functionalCurrencyCode: 'CUP',
    });
    prismaMock.reconciliacionVenta.findMany.mockReset();
    prismaMock.reconciliacionServicio.findMany.mockReset();
    prismaMock.reconciliacionGasto.findMany.mockReset();
    scopeInYear(prismaMock.reconciliacionVenta, []);
    scopeInYear(prismaMock.reconciliacionServicio, []);
    scopeInYear(prismaMock.reconciliacionGasto, []);
    prismaMock.merma.findMany.mockResolvedValue([]);
    prismaMock.compraServicio.findMany.mockResolvedValue([]);
    prismaMock.ventaServicios.findMany.mockResolvedValue([]);
    costoMock.calcularDetalleCostoVenta.mockReturnValue({
      historical: 0,
      estimated: 0,
      overAllocatedCost: 0,
      purchaseTrace: [],
    });
  });

  it('reconoce una venta extranjera convertida sin mezclar monedas del documento', async () => {
    scopeInYear(prismaMock.reconciliacionVenta, [
      baseRec({
        tipoReconciliacion: 'VENTA',
        venta: {
          ventaId: 'v1',
          total: 100,
          descuento: 0,
          cantidad: 1,
          deletedAt: null,
          producto: { precioCosto: 0 },
          items: [],
        },
      }),
    ]);
    costoMock.calcularDetalleCostoVenta.mockReturnValue({
      historical: 40,
      estimated: 0,
      overAllocatedCost: 0,
      purchaseTrace: [],
    });

    const result = await getReconciledResultForYear({ tenantId: 'tenant-a', year: YEAR });

    expect(result.annual.income.sales).toBe(2400);
    expect(result.annual.costOfSales.productsHistorical).toBe(960);
    expect(result.annual.cashFlow.operating).toBe(2400);
    expect(result.annual.reconciledResult).toBe(1440);
  });

  it('reparte dos cobros parciales extranjeros sin exceder el documento convertido', async () => {
    scopeInYear(prismaMock.reconciliacionVenta, [
      baseRec({
        reconciliacionId: 'rec-1',
        monto: 50,
        montoConvertido: 1200,
        fechaReconciliacion: new Date('2026-02-10T12:00:00.000Z'),
        tipoReconciliacion: 'VENTA',
        venta: {
          ventaId: 'v1',
          total: 100,
          descuento: 0,
          cantidad: 1,
          deletedAt: null,
          producto: { precioCosto: 0 },
          items: [],
        },
      }),
      baseRec({
        reconciliacionId: 'rec-2',
        monto: 50,
        montoConvertido: 1200,
        fechaReconciliacion: new Date('2026-03-10T12:00:00.000Z'),
        tipoReconciliacion: 'VENTA',
        venta: {
          ventaId: 'v1',
          total: 100,
          descuento: 0,
          cantidad: 1,
          deletedAt: null,
          producto: { precioCosto: 0 },
          items: [],
        },
      }),
    ]);

    const result = await getReconciledResultForYear({ tenantId: 'tenant-a', year: YEAR });

    expect(result.annual.income.sales).toBe(2400);
    const exceeds = result.incidents.filter(
      (incident) => incident.code === 'PAYMENT_EXCEEDS_DOCUMENT',
    );
    expect(exceeds).toHaveLength(0);
  });

  it('convierte el ingreso y el costo de un servicio extranjero a la moneda funcional', async () => {
    scopeInYear(prismaMock.reconciliacionServicio, [
      baseRec({
        ventasServicio: { ventaServicioId: 'vs1', total: 80, costo: 30, cantidad: 2 },
      }),
    ]);

    const result = await getReconciledResultForYear({ tenantId: 'tenant-a', year: YEAR });

    expect(result.annual.income.services).toBe(1920);
    expect(result.annual.costOfSales.services).toBe(1440);
  });

  it('reconoce un gasto extranjero en moneda funcional y limita pagos al documento convertido', async () => {
    scopeInYear(prismaMock.reconciliacionGasto, [
      baseRec({
        reconciliacionId: 'gasto-1',
        monto: 50,
        montoConvertido: 1200,
        tipoGasto: 'GASTODE',
        estado: 'PAGADA',
        referenciaId: 'gde-1',
        gastoCompra: null,
        gastoDE: { monto: 200 },
        pagoSalario: null,
      }),
      baseRec({
        reconciliacionId: 'gasto-2',
        monto: 150,
        montoConvertido: 3600,
        fechaReconciliacion: new Date('2026-04-10T12:00:00.000Z'),
        tipoGasto: 'GASTODE',
        estado: 'PAGADA',
        referenciaId: 'gde-1',
        gastoCompra: null,
        gastoDE: { monto: 200 },
        pagoSalario: null,
      }),
    ]);

    const result = await getReconciledResultForYear({ tenantId: 'tenant-a', year: YEAR });

    expect(result.annual.operatingExpenses.general).toBe(4800);
    expect(result.annual.cashFlow.operating).toBe(-4800);
  });

  it('marca filas legacy sin procedencia FX sin alterar sus importes', async () => {
    scopeInYear(prismaMock.reconciliacionVenta, [
      baseRec({
        tipoReconciliacion: 'VENTA',
        venta: {
          ventaId: 'v-legacy',
          total: 100,
          descuento: 0,
          cantidad: 1,
          deletedAt: null,
          producto: { precioCosto: 0 },
          items: [],
        },
      }),
    ]);

    const result = await getReconciledResultForYear({ tenantId: 'tenant-a', year: YEAR });

    expect(result.annual.income.sales).toBe(2400);
    const legacy = result.incidents.filter(
      (incident) =>
        incident.code === 'FX_PROVENANCE_LEGACY' && incident.movementId === 'rec-1',
    );
    expect(legacy).toHaveLength(1);
  });

  it('no marca filas con procedencia FX persistida', async () => {
    scopeInYear(prismaMock.reconciliacionVenta, [
      baseRec({
        rateEffectiveAt: new Date('2026-01-10T00:00:00.000Z'),
        tipoReconciliacion: 'VENTA',
        venta: {
          ventaId: 'v-evidencia',
          total: 100,
          descuento: 0,
          cantidad: 1,
          deletedAt: null,
          producto: { precioCosto: 0 },
          items: [],
        },
      }),
    ]);

    const result = await getReconciledResultForYear({ tenantId: 'tenant-a', year: YEAR });

    expect(result.annual.income.sales).toBe(2400);
    const legacy = result.incidents.filter(
      (incident) => incident.code === 'FX_PROVENANCE_LEGACY',
    );
    expect(legacy).toHaveLength(0);
  });

  it('en modo estricto excluye filas legacy de los totales con incidencia', async () => {
    vi.stubEnv('FX_STRICT_READERS', 'result');
    scopeInYear(prismaMock.reconciliacionVenta, [
      baseRec({
        reconciliacionId: 'rec-legacy',
        tipoReconciliacion: 'VENTA',
        venta: {
          ventaId: 'v-strict',
          total: 100,
          descuento: 0,
          cantidad: 1,
          deletedAt: null,
          producto: { precioCosto: 0 },
          items: [],
        },
      }),
    ]);

    try {
      const result = await getReconciledResultForYear({ tenantId: 'tenant-a', year: YEAR });

      expect(result.annual.income.sales).toBe(0);
      const excluded = result.incidents.filter(
        (incident) =>
          incident.code === 'FX_PROVENANCE_LEGACY' && incident.movementId === 'rec-legacy',
      );
      expect(excluded).toHaveLength(1);
      expect(excluded[0]?.affectedAmount).toBe(2400);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('en modo estricto conserva filas con evidencia persistida', async () => {
    vi.stubEnv('FX_STRICT_READERS', '*');
    scopeInYear(prismaMock.reconciliacionVenta, [
      baseRec({
        rateEffectiveAt: new Date('2026-01-05T00:00:00.000Z'),
        tipoReconciliacion: 'VENTA',
        venta: {
          ventaId: 'v-evidencia-strict',
          total: 100,
          descuento: 0,
          cantidad: 1,
          deletedAt: null,
          producto: { precioCosto: 0 },
          items: [],
        },
      }),
    ]);

    try {
      const result = await getReconciledResultForYear({ tenantId: 'tenant-a', year: YEAR });

      expect(result.annual.income.sales).toBe(2400);
      expect(
        result.incidents.filter((incident) => incident.code === 'FX_PROVENANCE_LEGACY'),
      ).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
