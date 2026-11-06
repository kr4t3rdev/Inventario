import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ asiento: { findMany: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));

import { resolveClosingScope } from './financial-ledger-closing-scope';

describe('resolveClosingScope', () => {
  beforeEach(() => vi.resetAllMocks());

  it('incluye el cierre y los contraasientos que lo revierten', async () => {
    db.asiento.findMany
      .mockResolvedValueOnce([{ asientoId: 'cierre-1' }])
      .mockResolvedValueOnce([{ asientoId: 'reverso-1' }])
      .mockResolvedValueOnce([]);

    await expect(resolveClosingScope({ tenantId: 'tenant-a' })).resolves.toEqual([
      'cierre-1', 'reverso-1',
    ]);
  });

  it('sigue la cadena cuando un reverso es revertido a su vez', async () => {
    db.asiento.findMany
      .mockResolvedValueOnce([{ asientoId: 'cierre-1' }])
      .mockResolvedValueOnce([{ asientoId: 'reverso-1' }])
      .mockResolvedValueOnce([{ asientoId: 'reverso-2' }])
      .mockResolvedValueOnce([]);

    await expect(resolveClosingScope({ tenantId: 'tenant-a' })).resolves.toEqual([
      'cierre-1', 'reverso-1', 'reverso-2',
    ]);
  });

  it('acota la búsqueda al tenant y devuelve vacío sin cierres', async () => {
    db.asiento.findMany.mockResolvedValueOnce([]);

    await expect(resolveClosingScope({ tenantId: 'tenant-a' })).resolves.toEqual([]);
    expect(db.asiento.findMany).toHaveBeenCalledTimes(1);
    expect(db.asiento.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-a' }),
    }));
  });

  it('rechaza un tenant vacío antes de consultar', async () => {
    await expect(resolveClosingScope({ tenantId: '  ' })).rejects.toThrow();
    expect(db.asiento.findMany).not.toHaveBeenCalled();
  });
});
