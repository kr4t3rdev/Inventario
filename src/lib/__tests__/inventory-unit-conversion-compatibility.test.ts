import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isCompatibleUnitConversion } from '../inventory-unit-conversion-compatibility';

const context = {
  tenantId: 'tenant-1',
  productId: 'product-1',
  stockUnitId: 'unit-kg',
  stockUnitDimension: 'MASS' as const,
  sourceTenantId: 'tenant-1',
  sourceUnitId: 'unit-g',
  sourceUnitDimension: 'MASS' as const,
  conversionTenantId: 'tenant-1',
  conversionProductId: 'product-1',
  conversionStockUnitId: 'unit-kg',
  factorToStock: '0.001',
};

describe('isCompatibleUnitConversion', () => {
  it('accepts a positive conversion for the same product, tenant, base and dimension', () => {
    expect(isCompatibleUnitConversion(context)).toBe(true);
  });

  it('requires factor one when the source unit is already the stock unit', () => {
    const sameUnit = { ...context, sourceUnitId: 'unit-kg' };

    expect(isCompatibleUnitConversion({ ...sameUnit, factorToStock: '2' })).toBe(false);
    expect(isCompatibleUnitConversion({ ...sameUnit, factorToStock: '1' })).toBe(true);
  });

  it('rejects a conversion owned by another tenant or product', () => {
    expect(isCompatibleUnitConversion({ ...context, conversionTenantId: 'tenant-2' })).toBe(false);
    expect(isCompatibleUnitConversion({ ...context, sourceTenantId: 'tenant-2' })).toBe(false);
    expect(isCompatibleUnitConversion({ ...context, conversionProductId: 'product-2' })).toBe(false);
  });

  it('rejects a conversion bound to a stale stock unit or a different dimension', () => {
    expect(isCompatibleUnitConversion({ ...context, conversionStockUnitId: 'unit-lb' })).toBe(false);
    expect(isCompatibleUnitConversion({ ...context, sourceUnitDimension: 'VOLUME' })).toBe(false);
  });

  it('rejects unknown dimensions and nonpositive or nonfinite factors', () => {
    expect(isCompatibleUnitConversion({ ...context, stockUnitDimension: 'UNKNOWN' })).toBe(false);
    expect(isCompatibleUnitConversion({ ...context, factorToStock: '0' })).toBe(false);
    expect(isCompatibleUnitConversion({ ...context, factorToStock: '-1' })).toBe(false);
    expect(isCompatibleUnitConversion({ ...context, factorToStock: 'Infinity' })).toBe(false);
    expect(isCompatibleUnitConversion({ ...context, factorToStock: '1e3' })).toBe(false);
    expect(isCompatibleUnitConversion({ ...context, factorToStock: '0.000000001' })).toBe(false);
    expect(isCompatibleUnitConversion({ ...context, factorToStock: '10000000000' })).toBe(false);
  });

  it('allows only an explicit factor-one identity when legacy dimensions are unknown', () => {
    const legacyIdentity = {
      ...context,
      stockUnitDimension: 'UNKNOWN' as const,
      sourceUnitDimension: 'UNKNOWN' as const,
      sourceUnitId: 'unit-kg',
      factorToStock: '1',
    };

    expect(isCompatibleUnitConversion(legacyIdentity)).toBe(true);
    expect(isCompatibleUnitConversion({ ...legacyIdentity, factorToStock: '2' })).toBe(false);
    expect(isCompatibleUnitConversion({ ...legacyIdentity, sourceUnitId: 'unit-other' })).toBe(false);
  });
});

describe('product unit conversion migration contract', () => {
  it('statically requires bounded DDL lock waiting inside one explicit transaction', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20261024100000_product_unit_conversions/migration.sql',
      ),
      'utf8',
    );

    expect(migration.trimStart()).toMatch(/^(?:--[^\n]*\n)*BEGIN;/);
    expect(migration).toContain("SET LOCAL lock_timeout = '5s';");
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).not.toContain('RESET lock_timeout');
  });

});
