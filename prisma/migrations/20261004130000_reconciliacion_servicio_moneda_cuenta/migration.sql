ALTER TABLE "ReconciliacionServicio"
  ADD COLUMN "montoCuenta" DECIMAL(20, 4),
  ADD COLUMN "monedaCuenta" TEXT,
  ADD COLUMN "cuentaOrigenId" TEXT,
  ADD COLUMN "montoCuentaOrigen" DECIMAL(20, 4),
  ADD COLUMN "monedaCuentaOrigen" TEXT;

ALTER TABLE "ReconciliacionServicio"
  ADD CONSTRAINT "ReconciliacionServicio_accountAmountPair_check"
  CHECK (
    ("montoCuenta" IS NULL AND "monedaCuenta" IS NULL)
    OR
    ("montoCuenta" IS NOT NULL AND "montoCuenta" > 0
      AND "monedaCuenta" IS NOT NULL AND btrim("monedaCuenta") <> '')
  ),
  ADD CONSTRAINT "ReconciliacionServicio_sourceAccountAmountPair_check"
  CHECK (
    ("cuentaOrigenId" IS NULL AND "montoCuentaOrigen" IS NULL AND "monedaCuentaOrigen" IS NULL)
    OR
    ("cuentaOrigenId" IS NOT NULL AND "montoCuentaOrigen" IS NOT NULL
      AND "montoCuentaOrigen" > 0
      AND "monedaCuentaOrigen" IS NOT NULL AND btrim("monedaCuentaOrigen") <> '')
  );
