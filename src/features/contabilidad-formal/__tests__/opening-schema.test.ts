import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migrationRoot = join(process.cwd(), 'prisma/migrations');
const migrationDir = readdirSync(migrationRoot).find((name) =>
  name.endsWith('_formal_opening_evidence'),
);
const migration = migrationDir
  ? readFileSync(join(migrationRoot, migrationDir, 'migration.sql'), 'utf8')
  : '';

describe('formal opening persistence contract', () => {
  it('keeps approval authority on append-only revisions, not mutable opening headers', () => {
    const model = schema.match(/model AperturaPeriodo \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(model).not.toMatch(/\b(estadoRevision|presentadaPor|presentadaAt|revisadaPor|revisadaAt|digestVersion|digestSha256|evidenciaVersion|evidenciaSha256)\b/);
    expect(model).toContain('monedaFuncional');
    const revision = schema.match(/model AperturaRevision \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(revision).toContain('estado');
    expect(revision).toContain('presentadaPor');
    expect(revision).toContain('revisadaPor');
    expect(revision).toContain('digestSha256');
    expect(revision).toContain('evidenciaSha256');
  });

  it('stores opening lines with tenant-period identity, precise amounts, and optional FX provenance', () => {
    const model = schema.match(/model LineaAperturaPeriodo \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(model).toContain('tenantId');
    expect(model).toContain('periodoId');
    expect(model).toContain('fechaEfectiva');
    expect(model).toMatch(/lado\s+String\s*\n/);
    expect(model).not.toMatch(/lado\s+String[^\n]*@default/);
    expect(model).toContain('rolCuenta');
    expect(model).toContain('cuentaId');
    expect(model).toContain('monedaNativa');
    expect(model).toMatch(/importeNativo\s+Decimal\s+@db\.Decimal\(20, 4\)/);
    expect(model).toMatch(/importeFuncional\s+Decimal\?\s+@db\.Decimal\(20, 4\)/);
    expect(model).toMatch(/tasaCambio\s+Decimal\?\s+@db\.Decimal\(20, 10\)/);
    expect(model).toContain('fuenteTipo');
    expect(model).toContain('fuenteId');
    expect(model).toContain('evidenciaVersion');
    expect(model).toContain('evidenciaSha256');
    expect(model).toContain('fxFingerprint');
    expect(model).toContain('fuenteSnapshot');
    expect(model).toContain('fxCatalogRateId');
    expect(model).toContain('revisionId');
    expect(model).toContain('@@unique([tenantId, periodoId, revisionId, lineaId], map: "opening_line_revision_identity_key")');
    expect(model).toContain('revisionId');
    expect(model).toContain('references: [tenantId, periodoId, aperturaId]');
    const header = schema.match(/model AperturaPeriodo \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(header).toContain('@@unique([tenantId, periodoId, aperturaId])');
    expect(header).toContain('references: [tenantId, periodoId]');
    expect(header).toContain('revisiones');
    const revision = schema.match(/model AperturaRevision \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(revision).toContain('fechaCorte');
    expect(revision).toMatch(/fechaCorte\s+DateTime\s*\n/);
    expect(revision).toContain('@@unique([aperturaId, version])');
    expect(revision).toContain('digestSha256');
    expect(revision).toContain('estado');
    expect(revision).toContain('references: [tenantId, periodoId, aperturaId]');
    expect(revision).toContain('map: "opening_revision_composite_key"');
  });

  it('ships only additive SQL and leaves existing opening rows unapproved', () => {
    expect(migration).not.toBe('');
    expect(migration).toMatch(/ADD COLUMN "monedaFuncional" TEXT NOT NULL DEFAULT 'CUP'/);
    expect(migration).not.toMatch(/ADD COLUMN "(?:estadoRevision|presentadaPor|presentadaAt|revisadaPor|revisadaAt|digestVersion|digestSha256|evidenciaVersion|evidenciaSha256)"/);
    expect(migration).toMatch(/CREATE TABLE "lineas_apertura_periodo"/);
    expect(migration).toMatch(/DECIMAL\(20,4\)/i);
    expect(migration).toMatch(/DECIMAL\(20,10\)/i);
    expect(migration).toContain('lineas_apertura_periodo_fx_evidence_complete_check');
    expect(migration).toContain('"lado" TEXT NOT NULL');
    expect(migration).toContain('lineas_apertura_periodo_lado_check');
    expect(migration).toContain('"fuenteSnapshot" JSONB');
    expect(migration).toContain('"fxCatalogRateId" TEXT');
    expect(migration).toContain('lineas_apertura_periodo_catalog_rate_evidence_check');
    expect(migration).toContain('CREATE TABLE "apertura_revisiones"');
    expect(migration).toContain('"fechaCorte" TIMESTAMP(3) NOT NULL');
    expect(migration).toMatch(/"lado" TEXT NOT NULL,/);
    expect(migration).not.toMatch(/"fechaCorte" TIMESTAMP\(3\) NOT NULL DEFAULT/);
    expect(migration).toContain('opening_line_revision_identity_key');
    expect(migration).toContain('opening_revision_composite_key');
    expect(migration).toContain('apertura_revisiones_lineas_immutable');
    expect(migration).toContain('apertura_revisiones_protect_lifecycle');
    expect(migration).toContain('lineas_apertura_periodo_revisionId_fkey');
    expect(migration).toContain('apertura_periodos_tenantId_periodoId_aperturaId_key');
    expect(migration).toContain('lineas_apertura_periodo_aperturaId_tenantId_periodoId_fkey');
    expect(migration).toContain('apertura_periodos_periodoId_tenantId_fkey');
    expect(migration).toContain('sha256_check');
    expect(migration).toContain('opening_tenant_period_consistency_guard');
    expect(migration).toContain('"tasaCambio" > 0');
    expect(migration).not.toMatch(/INSERT INTO "apertura_revisiones"/);
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN)/i);
  });
});
