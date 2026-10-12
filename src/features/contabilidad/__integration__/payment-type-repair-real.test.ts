/**
 * @description Ensaya la reparación SQL local con fixtures temporales y fallo físico de auditoría.
 * @returns Evidencia de preservación financiera, reintento y rollback transaccional.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
const target = new URL(process.env.DATABASE_URL_TEST ?? '');
const database = `tcp_r6_prod_clone_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}_trial9`;
const env = {
  ...process.env, PGHOST: target.hostname, PGPORT: target.port || '5432',
  PGUSER: decodeURIComponent(target.username), PGPASSWORD: decodeURIComponent(target.password),
  PGDATABASE: database, PGOPTIONS: '',
};
const repair = readFileSync('scripts/ops/rehearse-payment-type-tenant-repair.sql', 'utf8');
const fixture = `
CREATE TEMP TABLE "TipoPago" (
  "tipoId" TEXT PRIMARY KEY, "tenantId" TEXT, "nombre" TEXT, "descripcion" TEXT,
  "requiereCuenta" BOOLEAN, "cuentaDefecto" TEXT, "isActive" BOOLEAN,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP
);
CREATE TEMP TABLE "CuentaBancaria" ("cuentaId" TEXT, "tenantId" TEXT, "saldo" NUMERIC);
CREATE TEMP TABLE "ReconciliacionVenta" (
  "reconciliacionId" TEXT, "tenantId" TEXT, "tipoPagoId" TEXT, "cuentaId" TEXT,
  "monto" NUMERIC, "moneda" TEXT, "observaciones" TEXT
);
CREATE TEMP TABLE "ReconciliacionServicio" (LIKE "ReconciliacionVenta");
CREATE TEMP TABLE "ReconciliacionGasto" (LIKE "ReconciliacionVenta");
CREATE TEMP TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY, "entidad" TEXT, "entidadId" TEXT, "accion" TEXT,
  "usuarioId" TEXT, "detalles" JSONB
);
INSERT INTO "TipoPago" ("tipoId", "tenantId", "nombre", "descripcion",
  "requiereCuenta", "cuentaDefecto", "isActive", "updatedAt")
VALUES ('source', 'owner', 'Pago heredado', 'Configuración', false, 'owner-account', true, now());
INSERT INTO "CuentaBancaria" VALUES ('account', 'target', 100), ('owner-account', 'owner', 200);
INSERT INTO "ReconciliacionVenta" VALUES
  ('sale', 'target', 'source', 'account', 1.2345, 'USD', 'No modificar'),
  ('owner-sale', 'owner', 'source', 'owner-account', 2.5, 'CUP', 'Propietario');
INSERT INTO "ReconciliacionServicio" VALUES
  ('service', 'target', 'source', 'account', 3.4567, 'USD', 'No modificar');
INSERT INTO "ReconciliacionGasto" VALUES
  ('expense', 'target', 'source', 'account', 4.5678, 'USD', 'No modificar');
CREATE TEMP TABLE before_accounts AS SELECT * FROM "CuentaBancaria";
CREATE TEMP TABLE before_source AS SELECT * FROM "TipoPago";
CREATE TEMP TABLE before_financial AS
  SELECT "reconciliacionId", "tenantId", "cuentaId", "monto", "moneda", "observaciones"
    FROM "ReconciliacionVenta"
  UNION ALL SELECT "reconciliacionId", "tenantId", "cuentaId", "monto", "moneda", "observaciones"
    FROM "ReconciliacionServicio"
  UNION ALL SELECT "reconciliacionId", "tenantId", "cuentaId", "monto", "moneda", "observaciones"
    FROM "ReconciliacionGasto";
`;
const verify = `
SELECT jsonb_build_object(
  'types', (SELECT count(*) FROM "TipoPago"), 'audits', (SELECT count(*) FROM "AuditLog"),
  'sourceUnchanged', (SELECT jsonb_agg(t) FROM before_source t) =
    (SELECT jsonb_agg(t) FROM "TipoPago" t WHERE "tipoId" = 'source'),
  'accountsUnchanged', (SELECT jsonb_agg(t ORDER BY "cuentaId") FROM before_accounts t) =
    (SELECT jsonb_agg(t ORDER BY "cuentaId") FROM "CuentaBancaria" t),
  'financialUnchanged', NOT EXISTS (
    SELECT * FROM before_financial EXCEPT SELECT * FROM (
      SELECT "reconciliacionId", "tenantId", "cuentaId", "monto", "moneda", "observaciones"
        FROM "ReconciliacionVenta"
      UNION ALL SELECT "reconciliacionId", "tenantId", "cuentaId", "monto", "moneda", "observaciones"
        FROM "ReconciliacionServicio"
      UNION ALL SELECT "reconciliacionId", "tenantId", "cuentaId", "monto", "moneda", "observaciones"
        FROM "ReconciliacionGasto"
    ) current_rows
  ),
  'ownerType', (SELECT "tipoPagoId" FROM "ReconciliacionVenta"
    WHERE "reconciliacionId" = 'owner-sale'),
  'targetDefaultCleared', (SELECT "cuentaDefecto" IS NULL FROM "TipoPago"
    WHERE "tenantId" = 'target')
);
`;

/**
 * @description Ejecuta una sesión aislada y devuelve sus líneas JSON.
 * @param {string} input - Script y fixtures sintéticos.
 * @param {string} expectedDatabase - Identidad esperada del destino local.
 * @returns Resultado y objetos JSON emitidos.
 */
function run(input: string, expectedDatabase = database) {
  const result = spawnSync('psql', ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1',
    '-v', `expected_database=${expectedDatabase}`], {
    env, encoding: 'utf8', input, timeout: 20_000,
  });
  const json = result.stdout.split('\n').filter(line => line.startsWith('{'))
    .map(line => JSON.parse(line) as Record<string, unknown>);
  return { ...result, json };
}

describe('reparación de TipoPago — ensayo PostgreSQL local', () => {
  beforeAll(() => {
    expect(target.hostname).toBe('127.0.0.1');
    expect(target.port).toBe('5433');
    const result = spawnSync('createdb', ['-w', '--template=template0', database], {
      env: { ...env, PGDATABASE: 'postgres' }, encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
  });
  afterAll(() => {
    const result = spawnSync('dropdb', ['-w', database], {
      env: { ...env, PGDATABASE: 'postgres' }, encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
  });

  it('repara tres adaptadores, conserva finanzas y el reintento no duplica', () => {
    const result = run(fixture + repair + repair + verify);
    expect(result.status, result.stderr).toBe(0);
    expect(result.json[0]).toMatchObject({ createdPaymentTypes: 1, repairedReferences: 3,
      auditRows: 4 });
    expect(result.json[1]).toMatchObject({ createdPaymentTypes: 0, repairedReferences: 0,
      auditRows: 0 });
    expect(result.json[2]).toMatchObject({ types: 2, audits: 4, sourceUnchanged: true,
      accountsUnchanged: true, financialUnchanged: true, ownerType: 'source',
      targetDefaultCleared: true });
  });

  it('rollback físico tardío si AuditLog falla tras crear y reparar referencias', () => {
    const failpoint = `
CREATE FUNCTION pg_temp.fail_repair_audit() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM "TipoPago") <> 2
    OR (SELECT "tipoPagoId" FROM "ReconciliacionVenta" WHERE "reconciliacionId" = 'sale')
      = 'source'
    OR (SELECT "tipoPagoId" FROM "ReconciliacionServicio") = 'source'
    OR (SELECT "tipoPagoId" FROM "ReconciliacionGasto") = 'source'
    THEN RAISE EXCEPTION 'FAILPOINT_TOO_EARLY'; END IF;
  PERFORM 1 / 0;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER fail_repair_audit BEFORE INSERT ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_repair_audit();
`;
    const result = run(fixture + failpoint + '\\set ON_ERROR_STOP off\n' + repair + verify
      + 'DROP TRIGGER fail_repair_audit ON "AuditLog";\n\\set ON_ERROR_STOP on\n'
      + repair + verify);
    expect(result.stderr).toContain('division by zero');
    expect(result.stderr).not.toContain('FAILPOINT_TOO_EARLY');
    expect(result.json[0]).toMatchObject({ types: 1, audits: 0, sourceUnchanged: true,
      accountsUnchanged: true, financialUnchanged: true });
    expect(result.status, result.stderr).toBe(0);
    expect(result.json[1]).toMatchObject({ createdPaymentTypes: 1, repairedReferences: 3,
      auditRows: 4 });
    expect(result.json[2]).toMatchObject({ types: 2, audits: 4, sourceUnchanged: true,
      accountsUnchanged: true, financialUnchanged: true });
  });

  it('rechaza una identidad distinta antes de la reparación', () => {
    const result = run(fixture + repair, 'railway');
    expect(result.status).toBe(3);
    expect(result.stderr).toContain('R6_REPAIR_REQUIRES_ISOLATED_LOCAL_TRIAL');
  });

  it.each([
    ['cuenta cruzada', 'UPDATE "CuentaBancaria" SET "tenantId" = \'other\' '
      + 'WHERE "cuentaId" = \'account\';', 'INVALID_REFERENCE_OR_ACCOUNT_TENANT'],
    ['tipo con cuenta obligatoria', 'UPDATE "TipoPago" SET "requiereCuenta" = true;',
      'REQUIRED_ACCOUNT_TYPE_NEEDS_REVIEW'],
    ['configuración de cuenta nula', 'UPDATE "TipoPago" SET "requiereCuenta" = NULL;',
      'REQUIRED_ACCOUNT_TYPE_NEEDS_REVIEW'],
    ['tipo huérfano', 'DELETE FROM "TipoPago";', 'INVALID_REFERENCE_OR_ACCOUNT_TENANT'],
    ['tipo homónimo propio', `INSERT INTO "TipoPago" ("tipoId", "tenantId", "nombre")
      VALUES ('existing', 'target', 'Pago heredado');`, 'EXISTING_NAMED_TYPE_NEEDS_REVIEW'],
    ['colisión de identidad', `INSERT INTO "TipoPago" ("tipoId", "tenantId", "nombre")
      VALUES ('r6_tipo_pago_' || md5(jsonb_build_array('target'::text, 'source'::text)::text),
        'other', 'Otro pago');`, 'TARGET_ID_CONFLICT'],
    ['dos fuentes homónimas', `INSERT INTO "TipoPago" ("tipoId", "tenantId", "nombre",
      "requiereCuenta", "isActive") VALUES ('second', 'owner', 'Pago heredado', false, true);
      UPDATE "ReconciliacionServicio" SET "tipoPagoId" = 'second';`,
      'MULTIPLE_SOURCE_TYPES_NEED_REVIEW'],
  ])('rechaza %s antes de modificar', (_name, mutation, expected) => {
    const result = run(fixture + mutation + repair);
    expect(result.status).toBe(3);
    expect(result.stderr).toContain(`R6_REPAIR_${expected}`);
  });
});
