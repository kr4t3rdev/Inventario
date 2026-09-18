import { afterEach, describe, expect, it, vi } from 'vitest';

import { isStrictFxReader, type FxReaderSource } from './fx-strict-readers';

const SOURCES: FxReaderSource[] = ['result', 'summary', 'movements', 'snapshot'];

describe('isStrictFxReader', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('está desactivado por defecto', () => {
    vi.stubEnv('FX_STRICT_READERS', undefined);
    for (const source of SOURCES) {
      expect(isStrictFxReader(source)).toBe(false);
    }
  });

  it('activa solo las fuentes de la allowlist', () => {
    vi.stubEnv('FX_STRICT_READERS', 'result, movements');
    expect(isStrictFxReader('result')).toBe(true);
    expect(isStrictFxReader('movements')).toBe(true);
    expect(isStrictFxReader('summary')).toBe(false);
    expect(isStrictFxReader('snapshot')).toBe(false);
  });

  it('soporta comodín global', () => {
    vi.stubEnv('FX_STRICT_READERS', '*');
    for (const source of SOURCES) {
      expect(isStrictFxReader(source)).toBe(true);
    }
  });
});
