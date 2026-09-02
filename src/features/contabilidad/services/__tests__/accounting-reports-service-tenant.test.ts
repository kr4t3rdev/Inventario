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
    delete (prisma as typeof prisma & { $queryRaw?: unknown }).$queryRaw;
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

  it('usa el read model SQL paginado para el reporte JSON sin filtros posprocesados', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{
      data: [{
        id: 'movement-1', tipo: 'venta', fecha: '2026-01-01T12:00:00.000Z',
        monto: 25, moneda: 'CUP', montoConvertido: 25, tasaCambio: 1,
        descripcion: 'Venta V-1', cuenta: 'Banco - 1', tipoPago: 'Efectivo',
        observaciones: null, realizadoPor: 'user-1', referencia: 'V-1', detalles: {},
      }],
      total: 1,
      totales: { CUP: { ingresos: 25, egresos: 0, neto: 25 } },
      coberturaConversion: {
        total: 1, normalized: 1, legacyUnproven: 0, unresolved: 0, percentage: 100,
      },
    }]);
    (prisma as typeof prisma & { $queryRaw: typeof queryRaw }).$queryRaw = queryRaw;

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a',
      page: 1,
      limit: 10,
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.data[0]?.id).toBe('movement-1');
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(result.metadatos.coberturaConversion.percentage).toBe(100);
    expect(prisma.reconciliacionVenta.findMany).not.toHaveBeenCalled();
  });

  it('usa el read model paginado y limita a 10.000 filas para exportaciones CSV', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{
      data: [{
        id: 'movement-export-1', tipo: 'venta', fecha: '2026-01-01T12:00:00.000Z',
        monto: 25, moneda: 'CUP', descripcion: 'Venta exportada', referencia: 'V-1',
      }],
      total: 12_000,
      totales: { CUP: { ingresos: 30_000, egresos: 5_000, neto: 25_000 } },
      coberturaConversion: {
        total: 12_000, normalized: 12_000, legacyUnproven: 0, unresolved: 0, percentage: 100,
      },
    }]);
    (prisma as typeof prisma & { $queryRaw: typeof queryRaw }).$queryRaw = queryRaw;

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a', formato: 'csv', page: 99, limit: 50_000,
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0]?.[0] as { values?: unknown[] };
    expect(sql.values).toContain(10_000);
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({ page: 1, limit: 10_000, total: 12_000, totalPages: 2 });
    expect(result.totales).toEqual({ CUP: { ingresos: 30_000, egresos: 5_000, neto: 25_000 } });
    expect(result.exportContent).toContain('Venta exportada');
    expect(prisma.reconciliacionVenta.findMany).not.toHaveBeenCalled();
  });

  it('escapa CSV según RFC 4180 y neutraliza fórmulas en campos de texto', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{
      data: [{
        id: 'movement-export-unsafe', tipo: 'venta', fecha: '2026-01-01T12:00:00.000Z',
        monto: 100, moneda: 'CUP', montoConvertido: 100, tasaCambio: 1,
        descripcion: '=SUM(A1:A2), "demo"', cuenta: '+cmd', tipoPago: '@pay',
        realizadoPor: '-operator', referencia: 'ref-1', observaciones: 'linea 1\nlinea "2"',
      }],
      total: 1,
      totales: { CUP: { ingresos: 100, egresos: 0, neto: 100 } },
      coberturaConversion: {
        total: 1, normalized: 1, legacyUnproven: 0, unresolved: 0, percentage: 100,
      },
    }]);
    (prisma as typeof prisma & { $queryRaw: typeof queryRaw }).$queryRaw = queryRaw;

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a', formato: 'csv', limit: 10,
    });

    expect(result.exportContent).toContain('"\'=SUM(A1:A2), ""demo"""');
    expect(result.exportContent).toContain('"\'+cmd"');
    expect(result.exportContent).toContain('"\'@pay"');
    expect(result.exportContent).toContain('"\'-operator"');
    expect(result.exportContent).toContain('"linea 1\nlinea ""2"""');
  });

  it('usa el read model paginado para exportaciones PDF y conserva los filtros', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{
      data: [{ id: 'movement-pdf-1', tipo: 'gasto', fecha: '2026-01-01T12:00:00.000Z', monto: -10 }],
      total: 1,
      totales: { CUP: { ingresos: 0, egresos: 10, neto: -10 } },
      coberturaConversion: {
        total: 1, normalized: 1, legacyUnproven: 0, unresolved: 0, percentage: 100,
      },
    }]);
    (prisma as typeof prisma & { $queryRaw: typeof queryRaw }).$queryRaw = queryRaw;

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a', formato: 'pdf', fechaInicio: '2026-01-01', fechaFin: '2026-01-31',
      busqueda: 'gasto', tipoMovimiento: 'gasto', moneda: 'CUP', cuentaId: 'account-1', limit: 25,
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.data[0]?.id).toBe('movement-pdf-1');
    expect(result.pagination).toEqual({ page: 1, limit: 25, total: 1, totalPages: 1 });
    expect(result.filtros).toMatchObject({
      busqueda: 'gasto', fechaInicio: '2026-01-01', fechaFin: '2026-01-31',
      cuentaId: 'account-1', tipoMovimiento: 'gasto', moneda: 'CUP',
    });
    expect(prisma.reconciliacionGasto.findMany).not.toHaveBeenCalled();
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

  it('solo consulta la fuente necesaria cuando se filtra por tipo de movimiento', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');

    await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a',
      tipoMovimiento: 'gasto',
    });

    expect(prisma.reconciliacionGasto.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.reconciliacionVenta.findMany).not.toHaveBeenCalled();
    expect(prisma.reconciliacionServicio.findMany).not.toHaveBeenCalled();
    expect(prisma.transferenciaBancaria.findMany).not.toHaveBeenCalled();
    expect(prisma.ajusteBancario.findMany).not.toHaveBeenCalled();
    expect(prisma.inyeccionCapital.findMany).not.toHaveBeenCalled();
    expect(prisma.pagoDeuda.findMany).not.toHaveBeenCalled();
  });

  it('consulta pagos de deuda con la capacidad de deudas, no con la de capital', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');

    await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a',
      tipoMovimiento: 'pago_deuda',
      includeCapital: false,
      includeDeudasCash: true,
    });

    expect(prisma.pagoDeuda.findMany).toHaveBeenCalledTimes(1);
  });

  it('aplica la misma separación de capacidades en el resumen', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');

    await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      includeCapital: false,
      includeDeudasCash: true,
    });

    expect(prisma.inyeccionCapital.findMany).not.toHaveBeenCalled();
    expect(prisma.pagoDeuda.findMany).toHaveBeenCalledTimes(1);
  });

  it('devuelve solo la fila de transferencia asociada a la cuenta filtrada', async () => {
    vi.mocked(prisma.transferenciaBancaria.findMany).mockResolvedValue([
      {
        transferenciaId: 'transfer-1', numeroComprobante: 'T-1', montoOrigen: 100,
        monedaOrigen: 'CUP', montoDestino: 100, monedaDestino: 'CUP', tasaCambio: 1,
        motivo: 'Traspaso', descripcion: 'Movimiento interno', fechaTransferencia: new Date('2026-01-01T12:00:00Z'),
        cuentaOrigenId: 'cuenta-a', cuentaDestinoId: 'cuenta-b',
        cuentaOrigen: { nombreBanco: 'Banco A', numeroCuenta: '1' },
        cuentaDestino: { nombreBanco: 'Banco B', numeroCuenta: '2' },
      },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a',
      cuentaId: 'cuenta-a',
    });

    expect(result.data.map((movement) => movement.tipo)).toEqual(['transferencia_salida']);
  });

  it.each([
    { formato: 'csv' as const },
    { busqueda: 'T-USD' },
    { tipoMovimiento: 'transferencia_entrada' },
  ])('filtra por moneda cada pata de una transferencia en fallback (%o)', async (filters) => {
    vi.mocked(prisma.transferenciaBancaria.findMany).mockResolvedValue([
      {
        transferenciaId: 'transfer-fx', numeroComprobante: 'T-USD', montoOrigen: 100,
        monedaOrigen: 'CUP', montoDestino: 4, monedaDestino: 'USD', tasaCambio: 25,
        motivo: 'Conversión', descripcion: 'Transferencia CUP a USD',
        fechaTransferencia: new Date('2026-01-01T12:00:00Z'),
        cuentaOrigenId: 'cuenta-cup', cuentaDestinoId: 'cuenta-usd',
        cuentaOrigen: { nombreBanco: 'Banco CUP', numeroCuenta: '1' },
        cuentaDestino: { nombreBanco: 'Banco USD', numeroCuenta: '2' },
      },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a', moneda: 'USD', ...filters,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'transfer-fx-destino', tipo: 'transferencia_entrada', moneda: 'USD',
    });
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

  it('limita el contenido CSV al límite solicitado', async () => {
    vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([
      {
        reconciliacionId: 'expense-1', tipoGasto: 'GASTODE', estado: 'PAGADA', monto: 10,
        moneda: 'CUP', descripcion: 'Primera fila', fechaReconciliacion: new Date('2026-01-02T12:00:00Z'),
        cuentaBancaria: { nombreBanco: 'Banco', numeroCuenta: '1' },
        tipoPago: { nombre: 'Efectivo' },
      },
      {
        reconciliacionId: 'expense-2', tipoGasto: 'GASTODE', estado: 'PAGADA', monto: 20,
        moneda: 'CUP', descripcion: 'Segunda fila', fechaReconciliacion: new Date('2026-01-01T12:00:00Z'),
        cuentaBancaria: { nombreBanco: 'Banco', numeroCuenta: '1' },
        tipoPago: { nombre: 'Efectivo' },
      },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a',
      formato: 'csv',
      limit: 1,
    });

    expect(result.exportContent).toContain('Primera fila');
    expect(result.exportContent).not.toContain('Segunda fila');
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

  it('filtra por cuenta y moneda simultáneamente en el resumen', async () => {
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([
      { cuentaId: 'c1', saldo: 100, moneda: 'CUP' },
      { cuentaId: 'c2', saldo: 200, moneda: 'USD' },
    ] as never);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      { tipoReconciliacion: 'VENTA', monto: 50, moneda: 'CUP', montoConvertido: 50 },
      { tipoReconciliacion: 'VENTA', monto: 75, moneda: 'USD', montoConvertido: 75 },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      cuentaId: 'c1',
      moneda: 'CUP',
    });

    expect(result.resumenPorMoneda).toHaveLength(1);
    expect(result.resumenPorMoneda[0].moneda).toBe('CUP');
    expect(result.resumenPorMoneda[0].totalIngresos).toBe(50);
  });

  it('el resumen por moneda no mezcla ingresos de diferentes monedas', async () => {
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([
      { cuentaId: 'c1', saldo: 0, moneda: 'CUP' },
    ] as never);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      { tipoReconciliacion: 'VENTA', monto: 100, moneda: 'CUP', montoConvertido: 100 },
      { tipoReconciliacion: 'VENTA', monto: 50, moneda: 'USD', montoConvertido: 1200 },
      { tipoReconciliacion: 'VENTA', monto: 30, moneda: 'EUR', montoConvertido: 900 },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });

    const cup = result.resumenPorMoneda.find((r) => r.moneda === 'CUP');
    const usd = result.resumenPorMoneda.find((r) => r.moneda === 'USD');
    const eur = result.resumenPorMoneda.find((r) => r.moneda === 'EUR');

    expect(cup?.totalIngresos).toBe(100);
    expect(usd?.totalIngresos).toBe(50);
    expect(eur?.totalIngresos).toBe(30);

    expect(result.resumenPorMoneda.length).toBeGreaterThanOrEqual(3);
  });

  it('los totales del resumen representan todo el período, no una página', async () => {
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({
        tipoReconciliacion: 'VENTA',
        monto: 10,
        moneda: 'CUP',
        montoConvertido: 10,
      })),
    );

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });
    const cup = result.resumenPorMoneda.find((r) => r.moneda === 'CUP');

    expect(cup?.totalIngresos).toBe(250);
  });

  it('rango de fechas inclusivo: incluye el último día completo', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');
    const expectedGte = new Date('2026-03-01T00:00:00.000Z');
    const expectedLt = new Date('2026-04-01T00:00:00.000Z');

    await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      fechaInicio: '2026-03-01',
      fechaFin: '2026-03-31',
    });

    expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaReconciliacion: { gte: expectedGte, lt: expectedLt },
        }),
      }),
    );
  });
});
