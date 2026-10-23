import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20261022130000_add_production_vales_and_history/migration.sql',
);

describe('production vales and history schema contract', () => {
  it('declares nullable issue-location provenance on vale items', () => {
    const valeItem = schema.split('model ValeSalidaItem {')[1]?.split('\n}')[0] ?? '';
    expect(valeItem).toMatch(/sourceTipoUbicacion\s+String\?/);
    expect(valeItem).toMatch(/sourceUbicacionId\s+String\?/);
  });

  it('creates only the three additive runtime tables with exact location snapshot columns', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE "OrdenProduccionHistorial"');
    expect(sql).toContain('CREATE TABLE "ValeSalida"');
    expect(sql).toContain('CREATE TABLE "ValeSalidaItem"');
    expect(sql).toMatch(/"sourceTipoUbicacion" TEXT,\s*"sourceUbicacionId" TEXT,/);
    expect(sql).toContain('"estado" TEXT NOT NULL DEFAULT \'COMPLETADO\'');
    expect(sql).toContain('"id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text');
    expect(sql).toContain('REFERENCES "tenants"("tenantId")');
    expect(sql).toContain('ValeSalidaItem_productoId_fkey');
    expect(sql).toContain('ValeSalidaItem_valeSalidaId_fkey');
    expect(sql).toContain('ValeSalidaItem_tenantId_fkey');
    expect(sql).toContain('CREATE INDEX "ValeSalidaItem_tenantId_idx"');
    expect(sql).toContain('CREATE INDEX "ValeSalida_tenantId_idx"');
    expect(sql).not.toMatch(/\b(?:DROP|ALTER)\s+(?:TABLE|TYPE|COLUMN)\b/i);
    expect(sql).not.toMatch(/\bIF\s+NOT\s+EXISTS\b/i);
    expect(sql).not.toContain('BackupType');
    expect(sql).not.toContain('BackupStatus');
  });
});
