ALTER TABLE "AnticipoMovimiento"
    ADD COLUMN IF NOT EXISTS "cuentaId" TEXT,
    ADD COLUMN IF NOT EXISTS "tipoPagoId" TEXT,
    ADD COLUMN IF NOT EXISTS "montoFuncional" DECIMAL(65,30),
    ADD COLUMN IF NOT EXISTS "functionalCurrency" TEXT,
    ADD COLUMN IF NOT EXISTS "fxEvidenceFingerprint" TEXT;

ALTER TABLE "Anticipo"
    ADD COLUMN IF NOT EXISTS "montoFinanciado" DECIMAL(65,30) NOT NULL DEFAULT 0;
