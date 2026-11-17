import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';

const prismaMock = vi.hoisted(() => ({
  cuentaPorCobrar: {
    aggregate: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('AccountingAccountsService CxC metrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calculates porVencer from active accounts only, excluding PAGADA and ANULADA', async () => {
    prismaMock.cuentaPorCobrar.aggregate.mockResolvedValue({ _sum: { montoDeuda: 300 } });
    prismaMock.cuentaPorCobrar.count
      .mockResolvedValueOnce(1) // active overdue
      .mockResolvedValueOnce(3) // active total
      .mockResolvedValueOnce(5); // all rows, including paid/annulled

    const result = await AccountingAccountsService.getReceivablesMetrics({ tenantId: 'tenant-1' });

    expect(result).toEqual({
      totalPendiente: 300,
      vencidas: 1,
      cuentasActivas: 3,
      porVencer: 2,
      totalCuentas: 5,
    });
    expect(prismaMock.cuentaPorCobrar.count).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        estado: { in: ['PENDIENTE', 'PARCIAL'] },
      }),
    }));
  });
});

describe('AccountingAccountsService CxC list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns original currency and external reference for initial receivables', async () => {
    const createdAt = new Date('2026-11-16T12:00:00Z');
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([{
      id: 'cxc-1',
      idCC: 1,
      facturaId: null,
      numeroFactura: null,
      referenciaExternaInicial: 'LEGACY-AR-7',
      inicializacionId: 'init-1',
      clienteId: 'cliente-1',
      montoDeuda: 125.25,
      montoPagado: 0,
      montoOriginal: 125.25,
      monedaOriginal: 'EUR',
      idTransferencia: null,
      estado: 'PENDIENTE',
      tipoCuenta: 'APERTURA_EXTERNA',
      fechaVencimiento: null,
      createdAt,
      updatedAt: createdAt,
      factura: null,
      cliente: { clienteId: 'cliente-1', nombre: 'Cliente externo' },
      prestamoCash: null,
    }]);
    prismaMock.cuentaPorCobrar.count.mockResolvedValue(1);

    const result = await AccountingAccountsService.listReceivables({ tenantId: 'tenant-1' });

    expect(result.cuentas[0]).toMatchObject({
      moneda: 'EUR',
      referenciaExternaInicial: 'LEGACY-AR-7',
      montoDeuda: 125.25,
    });
  });

  it('searches initial receivables by their external reference', async () => {
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([]);
    prismaMock.cuentaPorCobrar.count.mockResolvedValue(0);

    await AccountingAccountsService.listReceivables({
      tenantId: 'tenant-1',
      search: 'LEGACY-AR-7',
    });

    expect(prismaMock.cuentaPorCobrar.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        OR: expect.arrayContaining([
          { referenciaExternaInicial: { contains: 'LEGACY-AR-7', mode: 'insensitive' } },
        ]),
      }),
    }));
  });
});
