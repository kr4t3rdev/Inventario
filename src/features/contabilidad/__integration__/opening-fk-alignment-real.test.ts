/**
 * @description Verifica la retirada de la FK redundante preservando el vínculo tenant/período.
 * @returns Evidencia PostgreSQL de rechazo cross-tenant, cascade válido y guard fail-closed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
const path = 'prisma/migrations/20261012090000_align_formal_schema_baseline/migration.sql';
const migration = existsSync(path) ? readFileSync(path, 'utf8') : '';

/**
 * @description Crea fixtures temporales y ejecuta la migración de alineación.
 * @param {'valid' | 'absent' | 'wrong'} composite - Forma de la FK compuesta del fixture.
 * @param {string} after - Verificación posterior dentro de la sesión aislada.
 * @param {boolean} stopOnError - Detiene el proceso o permite verificar rollback.
 * @returns Resultado del proceso PostgreSQL y objetos JSON de verificación.
 */
function run(composite: 'valid' | 'absent' | 'wrong', after: string, stopOnError = true) {
  const target = new URL(process.env.DATABASE_URL_TEST ?? '');
  const foreignKey = composite === 'valid'
    ? 'FOREIGN KEY ("tenantId", "periodoId") REFERENCES "periodos_contables"'
      + '("tenantId", "periodoId") ON DELETE CASCADE ON UPDATE CASCADE'
    : 'FOREIGN KEY ("tenantId") REFERENCES "periodos_contables"("tenantId") '
      + 'ON DELETE CASCADE ON UPDATE CASCADE';
  const fixture = `
SET search_path = pg_temp, public;
CREATE TEMP TABLE "periodos_contables" (
  "tenantId" TEXT UNIQUE, "periodoId" TEXT PRIMARY KEY, UNIQUE ("tenantId", "periodoId")
);
CREATE TEMP TABLE "apertura_periodos" (
  "aperturaId" TEXT PRIMARY KEY, "tenantId" TEXT, "periodoId" TEXT,
  CONSTRAINT "apertura_periodos_periodoId_fkey" FOREIGN KEY ("periodoId")
    REFERENCES "periodos_contables"("periodoId") ON DELETE CASCADE ON UPDATE CASCADE
);
${composite === 'absent' ? '' : `ALTER TABLE "apertura_periodos"
  ADD CONSTRAINT "apertura_periodos_periodoId_tenantId_fkey" ${foreignKey};`}
INSERT INTO "periodos_contables" VALUES ('tenant-a', 'period-a'), ('tenant-b', 'period-b');
INSERT INTO "apertura_periodos" VALUES ('opening', 'tenant-a', 'period-a');
`;
  const result = spawnSync('psql', ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
    encoding: 'utf8', timeout: 20_000,
    input: fixture + (stopOnError ? '' : '\\set ON_ERROR_STOP off\n') + migration + after,
    env: {
      ...process.env, PGHOST: target.hostname, PGPORT: target.port || '5432',
      PGUSER: decodeURIComponent(target.username), PGPASSWORD: decodeURIComponent(target.password),
      PGDATABASE: target.pathname.slice(1), PGOPTIONS: '',
    },
  });
  return { ...result, json: result.stdout.split('\n').filter(line => line.startsWith('{'))
    .map(line => JSON.parse(line) as Record<string, unknown>) };
}

const inspect = `
SELECT jsonb_build_object(
  'legacy', (SELECT count(*) FROM pg_constraint
    WHERE conrelid = '"apertura_periodos"'::regclass
      AND conname = 'apertura_periodos_periodoId_fkey'),
  'composite', (SELECT count(*) FROM pg_constraint
    WHERE conrelid = '"apertura_periodos"'::regclass
      AND conname = 'apertura_periodos_periodoId_tenantId_fkey'),
  'openings', (SELECT count(*) FROM "apertura_periodos")
);
`;

describe('alineación de FK de apertura: PostgreSQL', () => {
  it('elimina solo la FK redundante, conserva aislamiento/cascade y admite replay', () => {
    const checkIsolation = `
DO $$
DECLARE violated TEXT;
BEGIN
  BEGIN
    INSERT INTO "apertura_periodos" VALUES ('cross', 'tenant-b', 'period-a');
    RAISE EXCEPTION 'CROSS_TENANT_ACCEPTED';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    IF violated <> 'apertura_periodos_periodoId_tenantId_fkey' THEN
      RAISE EXCEPTION 'WRONG_GUARD';
    END IF;
  END;
END $$;
`;
    const result = run('valid', inspect + checkIsolation + migration
      + 'DELETE FROM "periodos_contables" WHERE "periodoId" = \'period-a\';\n' + inspect);
    expect(result.status, result.stderr).toBe(0);
    expect(result.json[0]).toMatchObject({ legacy: 0, composite: 1, openings: 1 });
    expect(result.json[1]).toMatchObject({ legacy: 0, composite: 1, openings: 0 });
  });

  it.each(['absent', 'wrong'] as const)('rechaza FK compuesta %s y conserva la protección',
    (composite) => {
      const result = run(composite, inspect, false);
      expect(result.stderr).toContain('OPENING_COMPOSITE_FK_NOT_VERIFIED');
      expect(result.json[0]).toMatchObject({ legacy: 1, openings: 1 });
    });
});
