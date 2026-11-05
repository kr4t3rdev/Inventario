import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ asiento: { findMany: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));

import { verifyReversalIntegrity } from './financial-ledger-reversal-integrity';

describe('verifyReversalIntegrity', () => {
  beforeEach(() => vi.resetAllMocks());

  it('acepta un par original-reverso coherente', async () => {
    db.asiento.findMany.mockResolvedValue([
      {
        asientoId: 'original-1', origenTipo: 'factura', origenId: 'doc-1',
        estado: 'ANULADO', revertidoPorId: 'reverso-1',
      },
      {
        asientoId: 'reverso-1', origenTipo: 'REVERSO_ASIENTO', origenId: 'original-1',
        estado: 'CONTABILIZADO', revertidoPorId: null,
      },
    ]);

    await expect(verifyReversalIntegrity({ tenantId: 'tenant-a' })).resolves.toEqual([]);
  });

  it('detecta un reverso cuyo original no existe', async () => {
    db.asiento.findMany.mockResolvedValue([{
      asientoId: 'reverso-1', origenTipo: 'REVERSO_ASIENTO', origenId: 'original-inexistente',
      estado: 'CONTABILIZADO', revertidoPorId: null,
    }]);

    const problemas = await verifyReversalIntegrity({ tenantId: 'tenant-a' });
    expect(problemas).toHaveLength(1);
    expect(problemas[0].codigo).toBe('ORIGINAL_REVERSO_AUSENTE');
  });

  it('detecta un original revertido sin reverso existente', async () => {
    db.asiento.findMany.mockResolvedValue([{
      asientoId: 'original-1', origenTipo: 'factura', origenId: 'doc-1',
      estado: 'ANULADO', revertidoPorId: 'reverso-1',
    }]);

    const problemas = await verifyReversalIntegrity({ tenantId: 'tenant-a' });
    expect(problemas).toHaveLength(1);
    expect(problemas[0].codigo).toBe('REVERSO_NO_ENCONTRADO');
  });

  it('detecta un original contabilizado que declara un reverso', async () => {
    db.asiento.findMany.mockResolvedValue([
      {
        asientoId: 'original-1', origenTipo: 'factura', origenId: 'doc-1',
        estado: 'CONTABILIZADO', revertidoPorId: 'reverso-1',
      },
      {
        asientoId: 'reverso-1', origenTipo: 'REVERSO_ASiento', origenId: 'original-1',
        estado: 'CONTABILIZADO', revertidoPorId: null,
      },
    ]);

    const problemas = await verifyReversalIntegrity({ tenantId: 'tenant-a' });
    expect(problemas.map((problema) => problema.codigo)).toEqual(['ORIGINAL_REVERSO_INCONSISTENTE']);
  });

  it('detecta una reversión anidada no admitida por el criterio de pares directos', async () => {
    db.asiento.findMany.mockResolvedValue([
      {
        asientoId: 'original-1', origenTipo: 'factura', origenId: 'doc-1',
        estado: 'ANULADO', revertidoPorId: 'reverso-1',
      },
      {
        asientoId: 'reverso-1', origenTipo: 'REVERSO_ASiento', origenId: 'original-1',
        estado: 'ANULADO', revertidoPorId: 'reverso-2',
      },
      {
        asientoId: 'reverso-2', origenTipo: 'REVERSO_ASiento', origenId: 'reverso-1',
        estado: 'CONTABILIZADO', revertidoPorId: null,
      },
    ]);

    const problemas = await verifyReversalIntegrity({ tenantId: 'tenant-a' });
    expect(problemas.map((problema) => problema.codigo)).toEqual(['ORIGINAL_REVERSO_INCONSISTENTE']);
  });

  it('detecta un reverso que no corresponde al original que lo declara', async () => {
    db.asiento.findMany.mockResolvedValue([
      {
        asientoId: 'original-1', origenTipo: 'factura', origenId: 'doc-1',
        estado: 'ANULADO', revertidoPorId: 'reverso-1',
      },
      {
        asientoId: 'reverso-1', origenTipo: 'REVERSO_ASIENTO', origenId: 'otro-original',
        estado: 'CONTABILIZADO', revertidoPorId: null,
      },
    ]);

    const problemas = await verifyReversalIntegrity({ tenantId: 'tenant-a' });
    expect(problemas.map((problema) => problema.codigo).sort()).toEqual([
      'ORIGINAL_REVERSO_AUSENTE', 'ORIGINAL_REVERSO_INCONSISTENTE',
    ]);
  });

  it('rechaza un tenant vacío antes de consultar', async () => {
    await expect(verifyReversalIntegrity({ tenantId: '' })).rejects.toThrow();
    expect(db.asiento.findMany).not.toHaveBeenCalled();
  });
});
