import { describe, expect, it } from 'vitest';

import {
  ACCOUNTING_OVERRIDE_FEATURE_KEYS,
  buildAccountingFeatureToggleStates,
  mergeAccountingFeatureOverrides,
} from '../license-feature-overrides';

describe('mergeAccountingFeatureOverrides', () => {
  it('mezcla solo las claves contables y preserva overrides ajenos', () => {
    const result = mergeAccountingFeatureOverrides(
      {
        productos: true,
        'reportes-financieros': false,
      },
      {
        'transferencias-bancarias': true,
        'ajustes-bancarios': true,
      },
    );

    expect(result).toEqual({
      productos: true,
      'reportes-financieros': false,
      'transferencias-bancarias': true,
      'ajustes-bancarios': true,
    });
  });

  it('solo expone claves contables soportadas', () => {
    expect(ACCOUNTING_OVERRIDE_FEATURE_KEYS).toContain('transferencias-bancarias');
    expect(ACCOUNTING_OVERRIDE_FEATURE_KEYS).toContain('ajustes-bancarios');
    expect(ACCOUNTING_OVERRIDE_FEATURE_KEYS).not.toContain('productos');
  });

  it('calcula estado efectivo heredado y override explícito para la UI', () => {
    const states = buildAccountingFeatureToggleStates(
      {
        'transferencias-bancarias': false,
        'reportes-financieros': true,
      },
      {
        'transferencias-bancarias': true,
      },
    );

    expect(states.find((item) => item.key === 'transferencias-bancarias')).toEqual({
      key: 'transferencias-bancarias',
      enabled: true,
      inherited: false,
    });
    expect(states.find((item) => item.key === 'reportes-financieros')).toEqual({
      key: 'reportes-financieros',
      enabled: true,
      inherited: true,
    });
  });
});
