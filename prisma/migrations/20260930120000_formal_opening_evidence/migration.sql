-- Additive reviewed-opening persistence foundation. Legacy headers get no revision and cannot be approved by header fields.
ALTER TABLE "apertura_periodos"
  ADD COLUMN "monedaFuncional" TEXT NOT NULL DEFAULT 'CUP';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "apertura_periodos" AS opening
    LEFT JOIN "periodos_contables" AS period
      ON period."tenantId" = opening."tenantId"
     AND period."periodoId" = opening."periodoId"
    WHERE period."periodoId" IS NULL
  ) THEN
    RAISE EXCEPTION 'opening_tenant_period_consistency_guard: existing opening tenant/period mismatch';
  END IF;
END $$;

CREATE UNIQUE INDEX "apertura_periodos_tenantId_periodoId_aperturaId_key"
  ON "apertura_periodos"("tenantId", "periodoId", "aperturaId");
CREATE UNIQUE INDEX "apertura_periodos_tenantId_periodoId_key"
  ON "apertura_periodos"("tenantId", "periodoId");

ALTER TABLE "apertura_periodos"
  ADD CONSTRAINT "apertura_periodos_periodoId_tenantId_fkey"
    FOREIGN KEY ("tenantId", "periodoId") REFERENCES "periodos_contables"("tenantId", "periodoId")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "apertura_revisiones" (
  "revisionId" TEXT NOT NULL,
  "aperturaId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "periodoId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "fechaCorte" TIMESTAMP(3) NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
  "presentadaPor" TEXT,
  "presentadaAt" TIMESTAMP(3),
  "revisadaPor" TEXT,
  "revisadaAt" TIMESTAMP(3),
  "digestVersion" INTEGER,
  "digestSha256" TEXT,
  "evidenciaVersion" INTEGER,
  "evidenciaSha256" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "apertura_revisiones_pkey" PRIMARY KEY ("revisionId"),
  CONSTRAINT "apertura_revisiones_status_check"
    CHECK ("estado" IN ('BORRADOR', 'PRESENTADA', 'APROBADA', 'RETIRADA')),
  CONSTRAINT "apertura_revisiones_version_check" CHECK ("version" > 0),
  CONSTRAINT "apertura_revisiones_digest_sha256_check"
    CHECK ("digestSha256" IS NULL OR "digestSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "apertura_revisiones_evidence_sha256_check"
    CHECK ("evidenciaSha256" IS NULL OR "evidenciaSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "apertura_revisiones_submission_metadata_check"
    CHECK (
      ("estado" = 'BORRADOR' AND "presentadaPor" IS NULL AND "presentadaAt" IS NULL
        AND "revisadaPor" IS NULL AND "revisadaAt" IS NULL)
      OR ("estado" IN ('PRESENTADA', 'APROBADA', 'RETIRADA')
        AND "presentadaPor" IS NOT NULL AND "presentadaAt" IS NOT NULL
        AND "digestVersion" > 0 AND "digestSha256" IS NOT NULL
        AND "evidenciaVersion" > 0 AND "evidenciaSha256" IS NOT NULL)
    ),
  CONSTRAINT "apertura_revisiones_approval_metadata_check"
    CHECK ("estado" <> 'APROBADA' OR
      ("revisadaPor" IS NOT NULL AND "revisadaAt" IS NOT NULL AND "revisadaPor" <> "presentadaPor")),
  CONSTRAINT "apertura_revisiones_opening_fkey"
    FOREIGN KEY ("tenantId", "periodoId", "aperturaId")
    REFERENCES "apertura_periodos"("tenantId", "periodoId", "aperturaId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "apertura_revisiones_period_fkey"
    FOREIGN KEY ("tenantId", "periodoId")
    REFERENCES "periodos_contables"("tenantId", "periodoId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "apertura_revisiones_tenant_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "apertura_revisiones_aperturaId_version_key"
  ON "apertura_revisiones"("aperturaId", "version");
CREATE UNIQUE INDEX "opening_revision_composite_key"
  ON "apertura_revisiones"("tenantId", "periodoId", "aperturaId", "revisionId");
CREATE INDEX "apertura_revisiones_tenantId_periodoId_estado_idx"
  ON "apertura_revisiones"("tenantId", "periodoId", "estado");

CREATE TABLE "lineas_apertura_periodo" (
  "lineaId" TEXT NOT NULL,
  "aperturaId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "periodoId" TEXT NOT NULL,
  "fechaEfectiva" TIMESTAMP(3) NOT NULL,
  "lado" TEXT NOT NULL,
  "rolCuenta" TEXT NOT NULL,
  "cuentaId" TEXT,
  "monedaNativa" TEXT NOT NULL,
  "importeNativo" DECIMAL(20,4) NOT NULL,
  "monedaFuncional" TEXT NOT NULL DEFAULT 'CUP',
  "importeFuncional" DECIMAL(20,4),
  "tasaCambio" DECIMAL(20,10),
  "fechaTasaCambio" TIMESTAMP(3),
  "fuenteTasaCambio" TEXT,
  "fuenteSnapshot" JSONB,
  "fxCatalogRateId" TEXT,
  "fxFingerprint" TEXT,
  "fuenteTipo" TEXT NOT NULL,
  "fuenteId" TEXT,
  "evidenciaVersion" INTEGER NOT NULL,
  "evidenciaSha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lineas_apertura_periodo_pkey" PRIMARY KEY ("lineaId")
);

CREATE UNIQUE INDEX "opening_line_revision_identity_key"
  ON "lineas_apertura_periodo"("tenantId", "periodoId", "revisionId", "lineaId");
CREATE INDEX "lineas_apertura_periodo_aperturaId_fechaEfectiva_idx"
  ON "lineas_apertura_periodo"("aperturaId", "fechaEfectiva");
CREATE INDEX "lineas_apertura_periodo_tenantId_periodoId_monedaNativa_idx"
  ON "lineas_apertura_periodo"("tenantId", "periodoId", "monedaNativa");
CREATE INDEX "lineas_apertura_periodo_tenantId_periodoId_rolCuenta_idx"
  ON "lineas_apertura_periodo"("tenantId", "periodoId", "rolCuenta");

ALTER TABLE "lineas_apertura_periodo"
  ADD CONSTRAINT "lineas_apertura_periodo_aperturaId_tenantId_periodoId_fkey"
    FOREIGN KEY ("tenantId", "periodoId", "aperturaId") REFERENCES "apertura_periodos"("tenantId", "periodoId", "aperturaId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lineas_apertura_periodo_periodoId_tenantId_fkey"
    FOREIGN KEY ("tenantId", "periodoId") REFERENCES "periodos_contables"("tenantId", "periodoId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lineas_apertura_periodo_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lineas_apertura_periodo"
  ADD CONSTRAINT "lineas_apertura_periodo_fx_evidence_complete_check"
  CHECK (
    (
      "monedaNativa" = 'CUP' AND "monedaFuncional" = 'CUP'
      AND "importeFuncional" = "importeNativo"
      AND ("tasaCambio" IS NULL OR "tasaCambio" = 1)
      AND "fechaTasaCambio" IS NULL AND "fuenteTasaCambio" IS NULL AND "fxFingerprint" IS NULL
    )
    OR
    (
      "monedaNativa" <> 'CUP' AND "monedaFuncional" = 'CUP'
      AND "importeFuncional" IS NULL AND "tasaCambio" IS NULL
      AND "fechaTasaCambio" IS NULL AND "fuenteTasaCambio" IS NULL AND "fxFingerprint" IS NULL
    )
    OR
    (
      "monedaNativa" <> 'CUP' AND "monedaFuncional" = 'CUP'
      AND "importeFuncional" IS NOT NULL AND "tasaCambio" > 0
      AND "fechaTasaCambio" IS NOT NULL AND "fuenteTasaCambio" IS NOT NULL AND "fxFingerprint" IS NOT NULL
    )
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
    CHECK ("lado" IN ('DEBE', 'HABER')),
  ADD CONSTRAINT "lineas_apertura_periodo_revisionId_fkey"
    FOREIGN KEY ("tenantId", "periodoId", "aperturaId", "revisionId")
    REFERENCES "apertura_revisiones"("tenantId", "periodoId", "aperturaId", "revisionId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "guard_apertura_revision_lifecycle"() RETURNS trigger AS $$
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

CREATE TRIGGER "apertura_revisiones_protect_lifecycle"
  BEFORE INSERT OR UPDATE OR DELETE ON "apertura_revisiones"
  FOR EACH ROW EXECUTE FUNCTION "guard_apertura_revision_lifecycle"();

CREATE FUNCTION "guard_apertura_revision_lines"() RETURNS trigger AS $$
DECLARE
  revision_status TEXT;
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

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
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

CREATE TRIGGER "apertura_revisiones_lineas_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "lineas_apertura_periodo"
  FOR EACH ROW EXECUTE FUNCTION "guard_apertura_revision_lines"();
