import { describe, expect, it } from 'vitest';

import { FEATURE_REGISTRY } from '../feature-registry';

describe('feature moneda-principal-cambio', () => {
  it('está registrado en el catálogo para controlar el cambio por plan', () => {
    expect(FEATURE_REGISTRY).toContainEqual(
      expect.objectContaining({
        key: 'moneda-principal-cambio',
        category: 'financiero',
      }),
    );
  });
});
