import { execFileSync } from 'node:child_process';
import { assertDisposableDatabase } from './disposable-database.mjs';

const databaseUrl = assertDisposableDatabase(process.env);

const guards = String.raw`
SELECT pg_advisory_xact_lock(hashtext('tcp:disposable-integration-sql-guards'));

CREATE OR REPLACE FUNCTION stock_move_line_inmutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'StockMoveLine es apendicular: no se permite %; registre un movimiento compensatorio', TG_OP;
END;
$$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'stock_move_line_no_update'
      AND tgrelid = '"StockMoveLine"'::regclass AND NOT tgisinternal
  ) THEN
    EXECUTE 'CREATE TRIGGER stock_move_line_no_update BEFORE UPDATE ON "StockMoveLine" FOR EACH ROW EXECUTE FUNCTION stock_move_line_inmutable()';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'stock_move_line_no_delete'
      AND tgrelid = '"StockMoveLine"'::regclass AND NOT tgisinternal
  ) THEN
    EXECUTE 'CREATE TRIGGER stock_move_line_no_delete BEFORE DELETE ON "StockMoveLine" FOR EACH ROW EXECUTE FUNCTION stock_move_line_inmutable()';
  END IF;
END $$;

ALTER TABLE "ReconciliacionVenta"
  ADD COLUMN IF NOT EXISTS "montoCuenta" DECIMAL(20, 4),
  ADD COLUMN IF NOT EXISTS "monedaCuenta" TEXT,
  ADD COLUMN IF NOT EXISTS "cuentaOrigenId" TEXT,
  ADD COLUMN IF NOT EXISTS "montoCuentaOrigen" DECIMAL(20, 4),
  ADD COLUMN IF NOT EXISTS "monedaCuentaOrigen" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contab_replay_approval_different_actor_check'
      AND conrelid = '"contabilidad_replay_approvals"'::regclass
  ) THEN
    ALTER TABLE "contabilidad_replay_approvals"
      ADD CONSTRAINT contab_replay_approval_different_actor_check
      CHECK ("requestedByUserId" <> "approvedByUserId");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contab_replay_preflight_24h_expiry_check'
      AND conrelid = '"contabilidad_replay_preflights"'::regclass
  ) THEN
    ALTER TABLE "contabilidad_replay_preflights"
      ADD CONSTRAINT contab_replay_preflight_24h_expiry_check
      CHECK ("expiresAt" = "generatedAt" + INTERVAL '24 hours');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ReconciliacionServicio_idempotencyPair_check'
      AND conrelid = '"ReconciliacionServicio"'::regclass
  ) THEN
    ALTER TABLE "ReconciliacionServicio"
      ADD CONSTRAINT "ReconciliacionServicio_idempotencyPair_check"
      CHECK (
        ("idempotencyKey" IS NULL AND "idempotencyHash" IS NULL)
        OR
        ("idempotencyKey" IS NOT NULL AND "idempotencyHash" ~ '^[0-9a-f]{64}$')
      );
  END IF;
  ALTER TABLE "ReconciliacionServicio"
    DROP CONSTRAINT IF EXISTS "ReconciliacionServicio_accountAmountPair_check";
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ReconciliacionServicio_accountAmountPair_check'
      AND conrelid = '"ReconciliacionServicio"'::regclass
  ) THEN
    ALTER TABLE "ReconciliacionServicio"
      ADD CONSTRAINT "ReconciliacionServicio_accountAmountPair_check"
      CHECK (
        ("montoCuenta" IS NULL AND "monedaCuenta" IS NULL)
        OR
        ("montoCuenta" IS NOT NULL AND "montoCuenta" > 0
          AND "monedaCuenta" IS NOT NULL AND btrim("monedaCuenta") <> '')
      );
  END IF;
  ALTER TABLE "ReconciliacionServicio"
    DROP CONSTRAINT IF EXISTS "ReconciliacionServicio_sourceAccountAmountPair_check";
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ReconciliacionServicio_sourceAccountAmountPair_check'
      AND conrelid = '"ReconciliacionServicio"'::regclass
  ) THEN
    ALTER TABLE "ReconciliacionServicio"
      ADD CONSTRAINT "ReconciliacionServicio_sourceAccountAmountPair_check"
      CHECK (
        ("cuentaOrigenId" IS NULL AND "montoCuentaOrigen" IS NULL AND "monedaCuentaOrigen" IS NULL)
        OR
        ("cuentaOrigenId" IS NOT NULL AND "montoCuentaOrigen" IS NOT NULL
          AND "montoCuentaOrigen" > 0
          AND "monedaCuentaOrigen" IS NOT NULL AND btrim("monedaCuentaOrigen") <> '')
      );
  END IF;
  ALTER TABLE "ReconciliacionVenta"
    DROP CONSTRAINT IF EXISTS "ReconciliacionVenta_accountAmountPair_check",
    DROP CONSTRAINT IF EXISTS "ReconciliacionVenta_sourceAccountAmountPair_check";
  ALTER TABLE "ReconciliacionVenta"
    ADD CONSTRAINT "ReconciliacionVenta_accountAmountPair_check"
    CHECK (
      ("montoCuenta" IS NULL AND "monedaCuenta" IS NULL)
      OR
      ("montoCuenta" IS NOT NULL AND "montoCuenta" > 0
        AND "monedaCuenta" IS NOT NULL AND btrim("monedaCuenta") <> '')
    ),
    ADD CONSTRAINT "ReconciliacionVenta_sourceAccountAmountPair_check"
    CHECK (
      ("cuentaOrigenId" IS NULL AND "montoCuentaOrigen" IS NULL AND "monedaCuentaOrigen" IS NULL)
      OR
      ("cuentaOrigenId" IS NOT NULL AND "montoCuentaOrigen" IS NOT NULL
        AND "montoCuentaOrigen" > 0
        AND "monedaCuentaOrigen" IS NOT NULL AND btrim("monedaCuentaOrigen") <> '')
    );

  -- FX-3: paridad atómica del snapshot de cuenta nativa en ReconciliacionGasto.
  ALTER TABLE "ReconciliacionGasto"
    DROP CONSTRAINT IF EXISTS "ReconciliacionGasto_accountAmountPair_check";
  ALTER TABLE "ReconciliacionGasto"
    ADD CONSTRAINT "ReconciliacionGasto_accountAmountPair_check"
    CHECK (
      ("montoCuenta" IS NULL AND "monedaCuenta" IS NULL)
      OR
      ("montoCuenta" IS NOT NULL AND "montoCuenta" > 0
        AND "monedaCuenta" IS NOT NULL AND btrim("monedaCuenta") <> '')
    );

  ALTER TABLE "lineas_apertura_periodo"
    DROP CONSTRAINT IF EXISTS "lineas_apertura_periodo_fx_evidence_complete_check",
    DROP CONSTRAINT IF EXISTS "lineas_apertura_periodo_evidencia_sha256_check",
    DROP CONSTRAINT IF EXISTS "lineas_apertura_periodo_fx_fingerprint_sha256_check",
    DROP CONSTRAINT IF EXISTS "lineas_apertura_periodo_catalog_rate_evidence_check",
    DROP CONSTRAINT IF EXISTS "lineas_apertura_periodo_lado_check";
  ALTER TABLE "lineas_apertura_periodo"
    ADD CONSTRAINT "lineas_apertura_periodo_fx_evidence_complete_check"
    CHECK (
      ("monedaNativa" = 'CUP' AND "monedaFuncional" = 'CUP'
        AND "importeFuncional" = "importeNativo"
        AND ("tasaCambio" IS NULL OR "tasaCambio" = 1)
        AND "fechaTasaCambio" IS NULL AND "fuenteTasaCambio" IS NULL AND "fxFingerprint" IS NULL)
      OR
      ("monedaNativa" <> 'CUP' AND "monedaFuncional" = 'CUP'
        AND "importeFuncional" IS NULL AND "tasaCambio" IS NULL
        AND "fechaTasaCambio" IS NULL AND "fuenteTasaCambio" IS NULL AND "fxFingerprint" IS NULL)
      OR
      ("monedaNativa" <> 'CUP' AND "monedaFuncional" = 'CUP'
        AND "importeFuncional" IS NOT NULL AND "tasaCambio" > 0
        AND "fechaTasaCambio" IS NOT NULL AND "fuenteTasaCambio" IS NOT NULL
        AND "fxFingerprint" IS NOT NULL)
    ),
    ADD CONSTRAINT "lineas_apertura_periodo_evidencia_sha256_check"
      CHECK ("evidenciaSha256" ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "lineas_apertura_periodo_fx_fingerprint_sha256_check"
      CHECK ("fxFingerprint" IS NULL OR "fxFingerprint" ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "lineas_apertura_periodo_catalog_rate_evidence_check"
      CHECK (
        "fxCatalogRateId" IS NULL
        OR ("monedaNativa" <> 'CUP' AND "monedaFuncional" = 'CUP'
          AND "importeFuncional" IS NOT NULL AND "tasaCambio" > 0
          AND "fechaTasaCambio" IS NOT NULL AND "fuenteTasaCambio" IS NOT NULL
          AND "fxFingerprint" IS NOT NULL AND "fuenteSnapshot" IS NOT NULL)
      ),
    ADD CONSTRAINT "lineas_apertura_periodo_lado_check"
      CHECK ("lado" IN ('DEBE', 'HABER'));
END $$;

CREATE OR REPLACE FUNCTION "guard_apertura_revision_lifecycle"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."estado" <> 'BORRADOR' THEN
      RAISE EXCEPTION 'opening revisions must be created as drafts';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'opening revisions are append-only';
  END IF;
  IF NEW."revisionId" IS DISTINCT FROM OLD."revisionId"
    OR NEW."aperturaId" IS DISTINCT FROM OLD."aperturaId"
    OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."periodoId" IS DISTINCT FROM OLD."periodoId"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'opening revision identity is immutable';
  END IF;
  IF OLD."estado" = 'BORRADOR' AND NEW."estado" = 'BORRADOR' THEN
    RETURN NEW;
  END IF;
  IF OLD."estado" = 'BORRADOR' AND NEW."estado" = 'PRESENTADA' THEN
    IF NEW."revisadaPor" IS NOT NULL OR NEW."revisadaAt" IS NOT NULL THEN
      RAISE EXCEPTION 'draft presentation cannot include reviewer fields';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."estado" = 'PRESENTADA' AND NEW."estado" IN ('APROBADA', 'RETIRADA') THEN
    IF NEW."presentadaPor" IS DISTINCT FROM OLD."presentadaPor"
      OR NEW."presentadaAt" IS DISTINCT FROM OLD."presentadaAt"
      OR NEW."digestVersion" IS DISTINCT FROM OLD."digestVersion"
      OR NEW."digestSha256" IS DISTINCT FROM OLD."digestSha256"
      OR NEW."evidenciaVersion" IS DISTINCT FROM OLD."evidenciaVersion"
      OR NEW."evidenciaSha256" IS DISTINCT FROM OLD."evidenciaSha256" THEN
      RAISE EXCEPTION 'submitted opening evidence digest is immutable';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'invalid opening revision lifecycle transition: % -> %', OLD."estado", NEW."estado";
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'apertura_revisiones_protect_lifecycle'
      AND tgrelid = '"apertura_revisiones"'::regclass AND NOT tgisinternal
  ) THEN
    EXECUTE 'CREATE TRIGGER apertura_revisiones_protect_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON "apertura_revisiones" FOR EACH ROW EXECUTE FUNCTION "guard_apertura_revision_lifecycle"()';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "guard_apertura_revision_lines"() RETURNS trigger AS $$
DECLARE revision_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT "estado" INTO revision_status FROM "apertura_revisiones"
    WHERE "tenantId" = NEW."tenantId" AND "periodoId" = NEW."periodoId"
      AND "aperturaId" = NEW."aperturaId" AND "revisionId" = NEW."revisionId"
    FOR UPDATE;
  ELSE
    SELECT "estado" INTO revision_status FROM "apertura_revisiones"
    WHERE "tenantId" = OLD."tenantId" AND "periodoId" = OLD."periodoId"
      AND "aperturaId" = OLD."aperturaId" AND "revisionId" = OLD."revisionId"
    FOR UPDATE;
  END IF;
  IF revision_status IS DISTINCT FROM 'BORRADOR' THEN
    RAISE EXCEPTION 'submitted opening revision evidence lines are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW."lineaId" IS DISTINCT FROM OLD."lineaId"
    OR NEW."aperturaId" IS DISTINCT FROM OLD."aperturaId"
    OR NEW."revisionId" IS DISTINCT FROM OLD."revisionId"
    OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."periodoId" IS DISTINCT FROM OLD."periodoId"
  ) THEN
    RAISE EXCEPTION 'opening line revision identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'apertura_revisiones_lineas_immutable'
      AND tgrelid = '"lineas_apertura_periodo"'::regclass AND NOT tgisinternal
  ) THEN
    EXECUTE 'CREATE TRIGGER apertura_revisiones_lineas_immutable BEFORE INSERT OR UPDATE OR DELETE ON "lineas_apertura_periodo" FOR EACH ROW EXECUTE FUNCTION "guard_apertura_revision_lines"()';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION reject_approved_financial_snapshot_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD."status" = 'APPROVED')
    OR (TG_OP = 'UPDATE' AND OLD."status" = 'APPROVED') THEN
    RAISE EXCEPTION 'approved financial snapshots are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."status" = 'APPROVED' AND (
    NEW."schemaVersion" IS DISTINCT FROM 3 OR NEW."approvedAt" IS NULL
    OR NEW."approvedBy" IS NULL OR NEW."resumenJson" IS NULL OR NEW."hashIntegridad" IS NULL
  ) THEN
    RAISE EXCEPTION 'approved v3 snapshots require final evidence and approval metadata'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'snapshot_periodos_approved_immutable_update'
    AND NOT tgisinternal) THEN
    CREATE TRIGGER "snapshot_periodos_approved_immutable_update"
      BEFORE UPDATE ON "snapshot_periodos" FOR EACH ROW
      EXECUTE FUNCTION reject_approved_financial_snapshot_mutation();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'snapshot_periodos_approved_immutable_delete'
    AND NOT tgisinternal) THEN
    CREATE TRIGGER "snapshot_periodos_approved_immutable_delete"
      BEFORE DELETE ON "snapshot_periodos" FOR EACH ROW
      EXECUTE FUNCTION reject_approved_financial_snapshot_mutation();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION reject_fx_evidence_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'FX evidence is immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fx_evidence_immutable_update'
    AND NOT tgisinternal) THEN
    CREATE TRIGGER "fx_evidence_immutable_update" BEFORE UPDATE ON "fx_evidence"
      FOR EACH ROW EXECUTE FUNCTION reject_fx_evidence_mutation();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fx_evidence_immutable_delete'
    AND NOT tgisinternal) THEN
    CREATE TRIGGER "fx_evidence_immutable_delete" BEFORE DELETE ON "fx_evidence"
      FOR EACH ROW EXECUTE FUNCTION reject_fx_evidence_mutation();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION reject_financial_auxiliary_checkpoint_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'financial auxiliary checkpoints are immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'financial_auxiliary_checkpoints_immutable_update'
    AND NOT tgisinternal) THEN
    CREATE TRIGGER "financial_auxiliary_checkpoints_immutable_update"
      BEFORE UPDATE ON "financial_auxiliary_checkpoints" FOR EACH ROW
      EXECUTE FUNCTION reject_financial_auxiliary_checkpoint_mutation();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'financial_auxiliary_checkpoints_immutable_delete'
    AND NOT tgisinternal) THEN
    CREATE TRIGGER "financial_auxiliary_checkpoints_immutable_delete"
      BEFORE DELETE ON "financial_auxiliary_checkpoints" FOR EACH ROW
      EXECUTE FUNCTION reject_financial_auxiliary_checkpoint_mutation();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION reject_used_functional_currency_change() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."functionalCurrencyCode" IS DISTINCT FROM OLD."functionalCurrencyCode" AND (
    EXISTS (SELECT 1 FROM "financial_auxiliary_checkpoints" c WHERE c."tenantId" = OLD."tenantId")
    OR EXISTS (
      SELECT 1 FROM "snapshot_periodos" s
      JOIN "periodos_contables" p ON p."periodoId" = s."periodoId"
      WHERE p."tenantId" = OLD."tenantId" AND p."estado" = 'APROBADO'
    )
    OR EXISTS (SELECT 1 FROM "ReconciliacionVenta" r
      WHERE r."tenantId" = OLD."tenantId" AND r."fxEvidenceVersion" = 1)
    OR EXISTS (SELECT 1 FROM "ReconciliacionServicio" r
      WHERE r."tenantId" = OLD."tenantId" AND r."fxEvidenceVersion" = 1)
    OR EXISTS (SELECT 1 FROM "ReconciliacionGasto" r
      WHERE r."tenantId" = OLD."tenantId" AND r."fxEvidenceVersion" = 1)
  ) THEN
    RAISE EXCEPTION 'functional currency is immutable after accounting evidence exists'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgname = 'tenant_accounting_policy_currency_immutable_after_evidence'
      AND NOT tgisinternal) THEN
    CREATE TRIGGER "tenant_accounting_policy_currency_immutable_after_evidence"
      BEFORE UPDATE ON "tenant_accounting_policies" FOR EACH ROW
      EXECUTE FUNCTION reject_used_functional_currency_change();
  END IF;
END $$;
`;

try {
  execFileSync('psql', [
    databaseUrl,
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    '--single-transaction',
    '--command',
    guards,
  ], { stdio: 'inherit' });
} catch {
  process.stderr.write(
    'No se pudieron preparar los guards SQL en la DB desechable de integración.\n',
  );
  process.exitCode = 1;
}
