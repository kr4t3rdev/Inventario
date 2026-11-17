import { describe, expect, it, vi } from 'vitest';
import {
  advanceAccountingPeriodVersion,
  lockAccountingPeriodVersion,
} from './accounting-period-version-lock';

describe('bloqueo de versión de período contable', () => {
  it('crea versión inicial y bloquea la fila antes de devolverla', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockResolvedValue([{ version: 7 }]),
    };

    await expect(lockAccountingPeriodVersion(tx, 'tenant-a')).resolves.toBe(7);
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain('FOR UPDATE');
  });

  it('falla cerrado cuando la fila de versión no puede leerse', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    await expect(lockAccountingPeriodVersion(tx, 'tenant-a'))
      .rejects.toMatchObject({ code: 'PERIOD_VERSION_LOCK_FAILED' });
  });

  it('incrementa la versión bajo el advisory lock de la transacción', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1) };

    await expect(advanceAccountingPeriodVersion(tx, 'tenant-a')).resolves.toBeUndefined();
    expect(String(tx.$executeRaw.mock.calls[0]?.[0])).toContain('version" = "periodo_contable_versiones"."version" + 1');
  });
});
