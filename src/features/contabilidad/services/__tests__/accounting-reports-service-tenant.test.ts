import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findMany: vi.fn() },
    reconciliacionVenta: { findMany: vi.fn() },
    reconciliacionServicio: { findMany: vi.fn() },
    reconciliacionGasto: { findMany: vi.fn() },
    transferenciaBancaria: { findMany: vi.fn() },
    ajusteBancario: { findMany: vi.fn() },
    inyeccionCapital: { findMany: vi.fn() },
    pagoDeuda: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';

describe('AccountingReportsService tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of [
      prisma.cuentaBancaria,
      prisma.reconciliacionVenta,
      prisma.reconciliacionServicio,
      prisma.reconciliacionGasto,
      prisma.transferenciaBancaria,
      prisma.ajusteBancario,
      prisma.inyeccionCapital,
      prisma.pagoDeuda,
    ]) {
      vi.mocked(model.findMany).mockResolvedValue([] as never);
    }
  });

  it('scopes every summary query to the authenticated tenant', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');

    await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });

    expect(prisma.cuentaBancaria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.reconciliacionServicio.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.reconciliacionGasto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.transferenciaBancaria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.ajusteBancario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.inyeccionCapital.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cuentaBancaria: { tenantId: 'tenant-a' } }),
      }),
    );
    expect(prisma.pagoDeuda.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cuentaBancaria: { tenantId: 'tenant-a' } }),
      }),
    );
  });

  it('scopes every movement query to the authenticated tenant', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');

    await AccountingReportsService.getMovementsReport({ tenantId: 'tenant-a' });

    for (const query of [
      prisma.reconciliacionVenta.findMany,
      prisma.reconciliacionServicio.findMany,
      prisma.reconciliacionGasto.findMany,
      prisma.transferenciaBancaria.findMany,
      prisma.ajusteBancario.findMany,
    ]) {
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
      );
    }

    for (const query of [prisma.inyeccionCapital.findMany, prisma.pagoDeuda.findMany]) {
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cuentaBancaria: { tenantId: 'tenant-a' } }),
        }),
      );
    }
  });

  it('cubre el día completo de cierre con límite exclusivo en resumen y movimientos', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');
    const expectedLt = new Date('2026-02-01T00:00:00.000Z');

    await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      fechaFin: '2026-01-31',
    });

    expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaReconciliacion: { lt: expectedLt },
        }),
      }),
    );

    vi.clearAllMocks();
    for (const model of [
      prisma.reconciliacionVenta,
      prisma.reconciliacionServicio,
      prisma.reconciliacionGasto,
      prisma.transferenciaBancaria,
      prisma.ajusteBancario,
      prisma.inyeccionCapital,
      prisma.pagoDeuda,
    ]) {
      vi.mocked(model.findMany).mockResolvedValue([] as never);
    }

    await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a',
      fechaFin: '2026-01-31',
    });

    expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaReconciliacion: { lt: expectedLt },
        }),
      }),
    );
  });

  it('separa préstamos y deudas cash de los ingresos operativos', async () => {
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      { tipoReconciliacion: 'PRESTAMO_CASH', monto: 10, moneda: 'CUP', montoConvertido: 10 },
      { tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO', monto: 20, moneda: 'CUP', montoConvertido: 20 },
      { tipoReconciliacion: 'DEUDA_CASH', monto: 30, moneda: 'CUP', montoConvertido: 30 },
      { tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO', monto: 40, moneda: 'CUP', montoConvertido: 40 },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      includePrestamosCash: true,
      includeDeudasCash: true,
    });
    const cup = result.resumenPorMoneda.find((row) => row.moneda === 'CUP');

    expect(cup?.desglose.ingresos.ventas).toBe(0);
    expect(cup?.totalIngresos).toBe(50);
    expect(cup?.totalEgresos).toBe(50);
    expect(cup?.desglose.egresos.prestamosCash).toBe(20);
    expect(cup?.desglose.egresos.deudasCash).toBe(30);
  });

  it('limits the summary to the requested currency', async () => {
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([
      { cuentaId: 'cup', saldo: 100, moneda: 'CUP' },
      { cuentaId: 'usd', saldo: 200, moneda: 'USD' },
    ] as never);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      { tipoReconciliacion: 'VENTA', monto: 10, moneda: 'CUP', montoConvertido: 10 },
      { tipoReconciliacion: 'VENTA', monto: 20, moneda: 'USD', montoConvertido: 20 },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      moneda: 'USD',
    });

    expect(result.resumenPorMoneda.map((row) => row.moneda)).toEqual(['USD']);
    expect(result.resumenPorMoneda[0]?.totalIngresos).toBe(20);
  });

  it('does not classify bank transfers as operating income or expense', async () => {
    vi.mocked(prisma.transferenciaBancaria.findMany).mockResolvedValue([
      { transferenciaId: 'transfer-1', montoOrigen: 100, montoDestino: 100 },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });

    expect(result.resumenPorMoneda).toEqual([]);
    expect(result.estadisticas.totalTransferencias).toBe(1);
  });

  it('keeps JSON and CSV totals aligned for the same report filters', async () => {
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([
      { cuentaId: 'cup', saldo: 50, moneda: 'CUP' },
    ] as never);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      { tipoReconciliacion: 'VENTA', monto: 25, moneda: 'CUP', montoConvertido: 25 },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const json = await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });
    const csv = await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      export: 'csv',
    });
    const cup = json.resumenPorMoneda.find((row) => row.moneda === 'CUP');

    expect(cup?.totalIngresos).toBe(25);
    expect(csv.exportContent).toContain('CUP,50,25,0,25,25');
  });

  it('excludes non-posted expense reconciliations from the cash summary', async () => {
    vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([
      { estado: 'PENDIENTE', tipoGasto: 'GASTODE', monto: 100, moneda: 'CUP' },
      { estado: 'PAGADA', tipoGasto: 'GASTODE', monto: 20, moneda: 'CUP' },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });
    const cup = result.resumenPorMoneda.find((row) => row.moneda === 'CUP');

    expect(cup?.totalEgresos).toBe(20);
  });

  it('excludes non-posted expense reconciliations from movements', async () => {
    vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([
      {
        reconciliacionId: 'pending', estado: 'PENDIENTE', tipoGasto: 'GASTODE', monto: 100,
        moneda: 'CUP', cuentaBancaria: { nombreBanco: 'Banco', numeroCuenta: '1' },
        tipoPago: { nombre: 'Efectivo' }, fechaReconciliacion: new Date(),
      },
      {
        reconciliacionId: 'posted', estado: 'PAGADA', tipoGasto: 'GASTODE', monto: 20,
        moneda: 'CUP', cuentaBancaria: { nombreBanco: 'Banco', numeroCuenta: '1' },
        tipoPago: { nombre: 'Efectivo' }, fechaReconciliacion: new Date(),
      },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getMovementsReport({ tenantId: 'tenant-a' });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('posted');
  });

  it('usa rangos semiabiertos [gte, lt) en resumen y movimientos', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');
    const expectedGte = new Date('2026-01-01T00:00:00.000Z');
    const expectedLt = new Date('2026-02-01T00:00:00.000Z');

    await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
    });

    expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaReconciliacion: { gte: expectedGte, lt: expectedLt },
        }),
      }),
    );

    await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
    });

    expect(prisma.reconciliacionVenta.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaReconciliacion: { gte: expectedGte, lt: expectedLt },
        }),
      }),
    );
  });

  it('no fabrica montoConvertido sin evidencia persistida', async () => {
    vi.mocked(prisma.transferenciaBancaria.findMany).mockResolvedValue([
      {
        transferenciaId: 't1', numeroComprobante: 'C-1', montoOrigen: 100,
        monedaOrigen: 'CUP', montoDestino: 100, monedaDestino: 'CUP', tasaCambio: null,
        motivo: null, descripcion: null, fechaTransferencia: new Date('2026-05-01T12:00:00.000Z'),
        cuentaOrigen: { nombreBanco: 'A', numeroCuenta: '1' },
        cuentaDestino: { nombreBanco: 'B', numeroCuenta: '2' },
      },
    ] as never);
    vi.mocked(prisma.inyeccionCapital.findMany).mockResolvedValue([
      {
        id: 'cap1', tipo: 'CAPITAL_SOCIAL', montoRecibido: 500, moneda: 'USD',
        descripcion: null, socio: 'Socio', entidadPrestamista: null,
        createdAt: new Date('2026-05-02T12:00:00.000Z'),
        cuentaBancaria: { nombreBanco: 'A', numeroCuenta: '1' },
      },
    ] as never);
    vi.mocked(prisma.pagoDeuda.findMany).mockResolvedValue([
      {
        id: 'pd1', montoPagado: 50, fechaPago: new Date('2026-05-03T12:00:00.000Z'),
        comprobante: null, observaciones: null,
        cuentaBancaria: { nombreBanco: 'A', numeroCuenta: '1', moneda: 'USD' },
        inyeccion: { entidadPrestamista: 'Entidad', tipo: 'DEUDA' },
      },
    ] as never);
    vi.mocked(prisma.ajusteBancario.findMany).mockResolvedValue([
      {
        ajusteId: 'a1', tipo: 'ingreso', monto: 25, moneda: null, montoConvertido: null,
        tasaCambio: null, descripcion: 'd', motivo: null, realizadoPor: 'u',
        fechaOperacion: new Date('2026-05-04T12:00:00.000Z'),
        cuentaBancaria: { nombreBanco: 'A', numeroCuenta: '1' },
      },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getMovementsReport({ tenantId: 'tenant-a' });
    const byTipo = new Map(result.data.map((mov) => [mov.tipo, mov]));

    expect(byTipo.get('transferencia_entrada')?.montoConvertido).toBeNull();
    expect(byTipo.get('inyeccion_capital')?.montoConvertido).toBeNull();
    expect(byTipo.get('pago_deuda')?.montoConvertido).toBeNull();
    expect(byTipo.get('ajuste_ingreso')?.montoConvertido).toBeNull();
  });

  it('excluye tipos de venta desconocidos del ingreso operativo y los cuenta', async () => {
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      { tipoReconciliacion: 'VENTA', monto: 10, moneda: 'CUP', montoConvertido: 10 },
      { tipoReconciliacion: 'TIPO_DESCONOCIDO', monto: 99, moneda: 'CUP', montoConvertido: 99 },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });
    const cup = result.resumenPorMoneda.find((row) => row.moneda === 'CUP');

    expect(cup?.desglose.ingresos.ventas).toBe(10);
    expect(cup?.totalIngresos).toBe(10);
    expect(result.metadatos.clasificacionNoReconocida).toBe(1);
  });

  it('aplica la política canónica a los estados y tipos de gasto del resumen', async () => {
    vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([
      { estado: 'CANCELADA', tipoGasto: 'GASTODE', monto: 77, moneda: 'CUP' },
      { estado: 'PAGADA', tipoGasto: 'RARO', monto: 55, moneda: 'CUP' },
      { estado: 'PAGADA', tipoGasto: 'GASTODE', monto: 7, moneda: 'CUP' },
      { estado: 'PARCIAL', tipoGasto: 'SALARIO', monto: 3, moneda: 'CUP' },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });
    const cup = result.resumenPorMoneda.find((row) => row.moneda === 'CUP');

    expect(cup?.desglose.egresos.gastos).toBe(10);
    expect(result.metadatos.clasificacionNoReconocida).toBe(1);
  });

  it('distingue evidencia persistida, legado sin procedencia y sin conversión', async () => {
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      { tipoReconciliacion: 'VENTA', monto: 10, moneda: 'CUP', montoConvertido: 10 },
      {
        tipoReconciliacion: 'VENTA', monto: 20, moneda: 'USD', montoConvertido: 480,
        rateEffectiveAt: new Date('2026-02-01T00:00:00.000Z'),
      },
      { tipoReconciliacion: 'VENTA', monto: 30, moneda: 'USD', montoConvertido: 720 },
      { tipoReconciliacion: 'VENTA', monto: 40, moneda: 'EUR', montoConvertido: null },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });

    expect(result.metadatos.coberturaConversion).toEqual({
      total: 4,
      normalized: 2,
      legacyUnproven: 1,
      unresolved: 1,
      percentage: 50,
    });
  });
});
