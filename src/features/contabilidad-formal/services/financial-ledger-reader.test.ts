import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ asientoLinea: { findMany: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));

import { readFinancialLedger } from './financial-ledger-reader';

describe('readFinancialLedger', () => {
  beforeEach(() => vi.resetAllMocks());

  it('restringe tenant, estado y fecha, y conserva los importes decimales', async () => {
    const cutoffAt = new Date('2026-06-30T23:59:59.000Z');
    db.asientoLinea.findMany.mockResolvedValue([{
      cuentaId: 'cash', debe: { toString: () => '0.1' }, haber: { toString: () => '0' },
      cuenta: { codigo: '1.1', nombre: 'Caja', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
    }]);

    const rows = await readFinancialLedger({ tenantId: 'tenant-a', cutoffAt });

    expect(db.asientoLinea.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId: 'tenant-a',
        asiento: { tenantId: 'tenant-a', estado: 'CONTABILIZADO', fecha: { lte: cutoffAt } },
        cuenta: { tenantId: 'tenant-a' },
      },
    }));
    expect(rows).toEqual([{
      id: 'cash', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA',
      debit: '0.1', credit: '0',
    }]);
  });

  it('rechaza tenant vacío o corte inválido antes de consultar', async () => {
    await expect(readFinancialLedger({ tenantId: '', cutoffAt: new Date() })).rejects.toThrow();
    await expect(readFinancialLedger({ tenantId: 't', cutoffAt: new Date('invalid') })).rejects.toThrow();
    expect(db.asientoLinea.findMany).not.toHaveBeenCalled();
  });

  it('permite leer un intervalo de resultados con inicio inclusivo', async () => {
    const from = new Date('2026-01-01T05:00:00.000Z');
    const cutoffAt = new Date('2026-06-30T23:59:59.000Z');
    db.asientoLinea.findMany.mockResolvedValue([]);
    await readFinancialLedger({ tenantId: 'tenant-a', from, cutoffAt });
    expect(db.asientoLinea.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        asiento: expect.objectContaining({ fecha: { gte: from, lte: cutoffAt } }),
      }),
    }));
  });

  it('rechaza el inicio inválido o posterior al corte sin consultar', async () => {
    const cutoffAt = new Date('2026-06-30T23:59:59.000Z');
    await expect(readFinancialLedger({ tenantId: 't', cutoffAt, from: new Date('invalid') }))
      .rejects.toThrow();
    await expect(readFinancialLedger({ tenantId: 't', cutoffAt, from: new Date('2027-01-01') }))
      .rejects.toThrow();
    expect(db.asientoLinea.findMany).not.toHaveBeenCalled();
  });

  it('excluye cierres solo al solicitar movimientos para estado de resultados', async () => {
    db.asientoLinea.findMany.mockResolvedValue([]);
    await readFinancialLedger({
      tenantId: 'tenant-a', cutoffAt: new Date('2026-12-31T23:59:59.000Z'),
      excludeClosingEntries: true,
    });
    expect(db.asientoLinea.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        asiento: expect.objectContaining({ origenTipo: { not: 'cierre_periodo' } }),
      }),
    }));
  });
});
