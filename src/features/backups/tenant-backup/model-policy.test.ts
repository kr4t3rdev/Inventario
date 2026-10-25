import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getModelPolicy,
  inspectPolicyCoverage,
  inspectBusinessManifestCoverage,
  findUnsupportedRestoreCycles,
  matchesDeclaredChildOwnerPath,
  TENANT_BACKUP_BUSINESS_MANIFEST,
} from './model-policy';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const schemaModelNames = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]);

describe('tenant backup model policy contract', () => {
  it('classifies every current schema model exactly once and rejects unknown additions', () => {
    expect(schemaModelNames).toHaveLength(156);
    const coverage = inspectPolicyCoverage(schemaModelNames.map((name) => ({ name })));

    expect(coverage.unknownModels).toEqual([]);
    expect(coverage.unregisteredModels).toEqual([]);
    expect(coverage.duplicatePolicies).toEqual([]);
    const classificationCounts = schemaModelNames.reduce<Record<string, number>>((counts, name) => {
      const kind = getModelPolicy(name)?.kind ?? 'unknown';
      counts[kind] = (counts[kind] ?? 0) + 1;
      return counts;
    }, {});
    expect(classificationCounts).toEqual({
      'tenant-direct': 94,
      'tenant-child': 16,
      'reference-only': 10,
      excluded: 36,
    });
    expect(inspectPolicyCoverage(schemaModelNames.slice(1).map((name) => ({ name })))
      .unregisteredModels).toContain(schemaModelNames[0]);
    expect(inspectPolicyCoverage([
      ...schemaModelNames.map((name) => ({ name })),
      { name: 'UnreviewedFutureModel' },
    ]).unknownModels)
      .toEqual(['UnreviewedFutureModel']);
  });

  it('keeps each expected business model in the independent manifest with explicit disposition', () => {
    expect(TENANT_BACKUP_BUSINESS_MANIFEST).toHaveLength(110);
    expect(new Set(TENANT_BACKUP_BUSINESS_MANIFEST.map((entry) => entry.model)).size).toBe(110);
    for (const entry of TENANT_BACKUP_BUSINESS_MANIFEST) {
      const policy = getModelPolicy(entry.model);
      expect(policy, entry.model).toBeDefined();
      expect(entry.rationale.trim().length, entry.model).toBeGreaterThan(0);
      expect(entry.productImpact.trim().length, entry.model).toBeGreaterThan(0);
      expect(['tenant-direct', 'tenant-child']).toContain(policy?.kind);
      expect(entry.disposition).toBe('candidate');
    }
  });

  it('rejects an all-excluded policy for business models and denies unknown model lookups', () => {
    const excludedPolicies = TENANT_BACKUP_BUSINESS_MANIFEST.map((entry) => ({
      model: entry.model,
      kind: 'excluded' as const,
      ownerPath: 'none; excluded',
      rationale: 'Test fixture forces an invalid blanket exclusion.',
      protectedEvidenceCandidate: false,
    }));

    expect(inspectBusinessManifestCoverage(TENANT_BACKUP_BUSINESS_MANIFEST, excludedPolicies)
      .ineligibleBusinessModels).toHaveLength(110);
    expect(inspectBusinessManifestCoverage(TENANT_BACKUP_BUSINESS_MANIFEST, [])
      .missingBusinessModels).toHaveLength(110);
    expect(getModelPolicy('UnreviewedFutureModel')).toBeUndefined();
  });

  it('keeps custom contract type rows tenant-scoped without attributing legacy NULL ownership', () => {
    const entry = TENANT_BACKUP_BUSINESS_MANIFEST.find(({ model }) => model === 'TipoContratoCustom');
    const policy = getModelPolicy('TipoContratoCustom');

    expect(entry?.disposition).toBe('candidate');
    expect(policy?.kind).toBe('tenant-direct');
    expect(policy?.ownerPath).toContain('exclude legacy NULL rows');
  });

  it('records unit conversions as tenant-owned backup candidates without enabling restore', () => {
    const entry = TENANT_BACKUP_BUSINESS_MANIFEST.find(({ model }) => model === 'UnidadConversion');
    const policy = getModelPolicy('UnidadConversion');

    expect(entry?.disposition).toBe('candidate');
    expect(entry?.rationale).toContain('UnidadConversion');
    expect(entry?.rationale).toContain('only after relation and field validation');
    expect(entry?.productImpact).toContain('restore');
    expect(policy?.kind).toBe('tenant-direct');
    expect(policy?.ownerPath).toContain('tenantId');
    expect(policy?.rationale).toContain('tenantId');
    expect(policy?.rationale).toContain('Producto');
    expect(policy?.rationale).toContain('Unidad');
  });

  it('classifies contract configuration as business data and records complete child paths', () => {
    expect(getModelPolicy('ConfiguracionContratos')?.kind).toBe('tenant-direct');
    expect(TENANT_BACKUP_BUSINESS_MANIFEST.some(
      ({ model }) => model === 'ConfiguracionContratos',
    )).toBe(true);
    expect(getModelPolicy('OfertaItem')?.ownerPath).toBe(
      'Oferta.tenantId AND optional Producto.tenantId AND optional Servicios.tenantId',
    );
    expect(getModelPolicy('DevolucionVentaItem')?.ownerPath).toBe(
      'DevolucionVenta.tenantId AND DevolucionVenta.ventaId -> Venta.tenantId AND DevolucionVenta.ventaId === ventaItem.ventaId AND ventaItem.venta.tenantId AND ventaItem.producto.tenantId AND productoId === ventaItem.productoId',
    );
  });

  it('keeps global references read-only and protected evidence explicitly marked', () => {
    expect(getModelPolicy('ReferralPerkCatalog')?.kind).toBe('reference-only');
    expect(getModelPolicy('StockMoveLine')?.protectedEvidenceCandidate).toBe(true);
    expect(getModelPolicy('FinancialAuxiliaryCheckpoint')?.protectedEvidenceCandidate).toBe(true);
  });

  it('requires an explicit owner path for child-owned models', () => {
    const children = schemaModelNames
      .map((name) => getModelPolicy(name))
      .filter((policy) => policy?.kind === 'tenant-child');

    expect(children.length).toBeGreaterThan(0);
    for (const policy of children) {
      expect(policy.ownerPath.trim().length, policy.model).toBeGreaterThan(0);
    }
    expect(matchesDeclaredChildOwnerPath('VentaItem', 'Venta.tenantId AND Producto.tenantId'))
      .toBe(true);
    expect(matchesDeclaredChildOwnerPath('VentaItem', 'Producto.tenantId')).toBe(false);
    expect(matchesDeclaredChildOwnerPath('Unidad', 'tenantId')).toBe(false);
  });

  it('fails closed when selected models intersect an unsupported relation cycle', () => {
    expect(findUnsupportedRestoreCycles(['OrdenReparacion'])).toContainEqual([
      'OrdenReparacion', 'Venta',
    ]);
    expect(findUnsupportedRestoreCycles(['Unidad'])).toEqual([]);
  });
});
