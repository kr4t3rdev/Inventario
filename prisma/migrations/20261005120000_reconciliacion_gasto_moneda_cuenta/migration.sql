-- FX-3: snapshot nativo de cuenta en ReconciliacionGasto
-- Refleja el débito tal como salió de la cuenta en su propia moneda.
ALTER TABLE "ReconciliacionGasto"
  ADD COLUMN "montoCuenta" DECIMAL(20, 4),
  ADD COLUMN "monedaCuenta" TEXT;

-- Paridad atómica: snapshot nulo o completo (monto positivo, moneda no vacía).
-- Predicado idéntico al guard de la DB desechable de integración.
ALTER TABLE "ReconciliacionGasto"
  ADD CONSTRAINT "ReconciliacionGasto_accountAmountPair_check" CHECK (
    ("montoCuenta" IS NULL AND "monedaCuenta" IS NULL)
    OR (
      "montoCuenta" IS NOT NULL AND "monedaCuenta" IS NOT NULL
      AND "montoCuenta" > 0 AND btrim("monedaCuenta") <> ''
    )
  );
