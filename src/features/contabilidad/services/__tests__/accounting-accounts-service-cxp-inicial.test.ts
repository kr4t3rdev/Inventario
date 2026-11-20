import { describe, expect, it, vi } from 'vitest';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';

const prismaMock = vi.hoisted(() => ({ cuentaPorPagar: {
  findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(),
} }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('lectura de CxP iniciales', () => {
  it('devuelve origen externo sin inventar factura, fecha o antigüedad', async () => {
    const date = new Date('2026-11-16T12:00:00Z');
    prismaMock.cuentaPorPagar.findMany.mockResolvedValue([{
      cuentaPorPagarId: 'cxp-1', tipo: 'inicial_externa', numeroFactura: null,
      referenciaExternaInicial: 'LEGACY-AP-1', fechaEmision: null, fechaVencimiento: null,
      montoDeuda: 125, montoPagado: 0, saldoPendiente: 125, moneda: 'CUP',
      estado: 'PENDIENTE', pagos: [], createdAt: date, updatedAt: date,
    }]);
    prismaMock.cuentaPorPagar.count.mockResolvedValue(1);
    prismaMock.cuentaPorPagar.aggregate.mockResolvedValue({ _sum: {
      montoDeuda: 125, montoPagado: 0, saldoPendiente: 125,
    } });
    const result = await AccountingAccountsService.listPayables({ tenantId: 'tenant-1' });
    expect(result.cuentas[0]).toMatchObject({
      tipo: 'inicial_externa', numeroFactura: null, fechaEmision: null,
      referenciaExternaInicial: 'LEGACY-AP-1', rangoAntiguedad: null, diasTranscurridos: null,
    });
  });
  it('busca por referencia externa en el tenant', async () => {
    prismaMock.cuentaPorPagar.findMany.mockResolvedValue([]);
    prismaMock.cuentaPorPagar.count.mockResolvedValue(0);
    prismaMock.cuentaPorPagar.aggregate.mockResolvedValue({ _sum: {
      montoDeuda: 0, montoPagado: 0, saldoPendiente: 0,
    } });
    await AccountingAccountsService.listPayables({ tenantId: 'tenant-1', search: 'LEGACY-AP-1' });
    expect(prismaMock.cuentaPorPagar.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1', OR: expect.arrayContaining([
        { referenciaExternaInicial: { contains: 'LEGACY-AP-1', mode: 'insensitive' } },
      ]) }),
    }));
  });
});
