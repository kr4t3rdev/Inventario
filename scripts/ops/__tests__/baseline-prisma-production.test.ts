import { describe, expect, it } from 'vitest';

import {
  buildResolveCommands,
  getBaselineMigrationNames,
} from '../baseline-prisma-production';

describe('getBaselineMigrationNames', () => {
  it('returns all historical migrations before live baseline cutover', () => {
    const names = getBaselineMigrationNames([
      '20250501000000_add_tenant_models',
      '20260703113000_add_feature_overrides_to_tenant_license',
    ]);

    expect(names).toEqual([
      '20250501000000_add_tenant_models',
      '20260703113000_add_feature_overrides_to_tenant_license',
    ]);
  });
});

describe('buildResolveCommands', () => {
  it('builds prisma migrate resolve commands in order', () => {
    expect(
      buildResolveCommands([
        '20250514033506_init',
        '20260703113000_add_feature_overrides_to_tenant_license',
      ]),
    ).toEqual([
      'pnpm prisma migrate resolve --applied 20250514033506_init',
      'pnpm prisma migrate resolve --applied 20260703113000_add_feature_overrides_to_tenant_license',
    ]);
  });
});
