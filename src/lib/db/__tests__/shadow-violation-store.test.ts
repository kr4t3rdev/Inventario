import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getShadowViolationSnapshot,
  recordShadowViolation,
  resetShadowViolationStore,
} from '@/lib/db/shadow-violation-store';
import { interceptOperation, setViolationReporter } from '@/lib/db/scoped-prisma';

describe('AS-04 shadow violation store', () => {
  beforeEach(() => {
    resetShadowViolationStore();
  });

  afterEach(() => {
    setViolationReporter(null);
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('conserva las 500 violaciones más recientes y cuenta las descartadas', () => {
    for (let index = 0; index < 501; index += 1) {
      recordShadowViolation({
        kind: 'missing-context',
        model: `Modelo${index}`,
        operation: 'findMany',
        mode: 'shadow',
      });
    }

    const snapshot = getShadowViolationSnapshot();

    expect(snapshot.totalCaptured).toBe(501);
    expect(snapshot.dropped).toBe(1);
    expect(snapshot.reports).toHaveLength(500);
    expect(snapshot.reports[0]?.model).toBe('Modelo1');
    expect(snapshot.reports.at(-1)?.model).toBe('Modelo500');
  });

  it('devuelve una copia que no permite mutar el buffer interno', () => {
    recordShadowViolation({
      kind: 'tenant-mismatch',
      model: 'Venta',
      operation: 'create',
      mode: 'shadow',
    });

    const first = getShadowViolationSnapshot();
    first.reports.length = 0;

    expect(getShadowViolationSnapshot().reports).toHaveLength(1);
  });

  it('el reporter por defecto escribe en consola y en el buffer', () => {
    vi.stubEnv('TENANT_ISOLATION_MODE', 'shadow');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setViolationReporter(null);

    interceptOperation('Venta', 'findMany', { where: {} });

    expect(warn).toHaveBeenCalledWith(
      '[tenant-isolation]',
      expect.stringContaining('missing-context'),
    );
    expect(getShadowViolationSnapshot().reports).toEqual([
      expect.objectContaining({ kind: 'missing-context', model: 'Venta' }),
    ]);
  });
});
