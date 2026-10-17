BEGIN;

ALTER TYPE "RolCuenta" ADD VALUE 'INTERESES_MORATORIOS_GANADOS';
ALTER TYPE "RolCuenta" ADD VALUE 'GASTOS_MORATORIOS';
ALTER TYPE "ReglaMontoEvento" ADD VALUE 'INTERESES_MORATORIOS';

ALTER TABLE "PrestamoCash"
  ADD COLUMN "ordinaryAnnualRate" DECIMAL(20, 10),
  ADD COLUMN "moratoryAnnualRate" DECIMAL(20, 10),
  ADD COLUMN "cashInterestPolicyVersion" INTEGER,
  ADD COLUMN "cashInterestGrantDate" DATE,
  ADD COLUMN "cashInterestMaturityDate" DATE,
  ADD COLUMN "cashInterestAccruedThroughDate" DATE,
  ADD COLUMN "cashInterestPrincipalRemaining" DECIMAL(20, 4),
  ADD COLUMN "cashInterestOrdinaryCarry" DECIMAL(38, 18),
  ADD COLUMN "cashInterestMoratoryCarry" DECIMAL(38, 18);

ALTER TABLE "DeudaCash"
  ADD COLUMN "ordinaryAnnualRate" DECIMAL(20, 10),
  ADD COLUMN "moratoryAnnualRate" DECIMAL(20, 10),
  ADD COLUMN "cashInterestPolicyVersion" INTEGER,
  ADD COLUMN "cashInterestGrantDate" DATE,
  ADD COLUMN "cashInterestMaturityDate" DATE,
  ADD COLUMN "cashInterestAccruedThroughDate" DATE,
  ADD COLUMN "cashInterestPrincipalRemaining" DECIMAL(20, 4),
  ADD COLUMN "cashInterestOrdinaryCarry" DECIMAL(38, 18),
  ADD COLUMN "cashInterestMoratoryCarry" DECIMAL(38, 18);

ALTER TABLE "PrestamoCash"
  ADD CONSTRAINT "PrestamoCash_cashInterestPolicy_check" CHECK (
    "cashInterestPolicyVersion" IS NULL OR (
      "cashInterestPolicyVersion" = 1
      AND "ordinaryAnnualRate" IS NOT NULL AND "ordinaryAnnualRate" >= 0
      AND "moratoryAnnualRate" IS NOT NULL AND "moratoryAnnualRate" >= 0
      AND "cashInterestGrantDate" IS NOT NULL
      AND "cashInterestAccruedThroughDate" IS NOT NULL
      AND "cashInterestPrincipalRemaining" IS NOT NULL
      AND "cashInterestPrincipalRemaining" >= 0
      AND "cashInterestOrdinaryCarry" IS NOT NULL AND "cashInterestOrdinaryCarry" >= 0
      AND "cashInterestMoratoryCarry" IS NOT NULL AND "cashInterestMoratoryCarry" >= 0
    )
  );

ALTER TABLE "DeudaCash"
  ADD CONSTRAINT "DeudaCash_cashInterestPolicy_check" CHECK (
    "cashInterestPolicyVersion" IS NULL OR (
      "cashInterestPolicyVersion" = 1
      AND "ordinaryAnnualRate" IS NOT NULL AND "ordinaryAnnualRate" >= 0
      AND "moratoryAnnualRate" IS NOT NULL AND "moratoryAnnualRate" >= 0
      AND "cashInterestGrantDate" IS NOT NULL
      AND "cashInterestAccruedThroughDate" IS NOT NULL
      AND "cashInterestPrincipalRemaining" IS NOT NULL
      AND "cashInterestPrincipalRemaining" >= 0
      AND "cashInterestOrdinaryCarry" IS NOT NULL AND "cashInterestOrdinaryCarry" >= 0
      AND "cashInterestMoratoryCarry" IS NOT NULL AND "cashInterestMoratoryCarry" >= 0
    )
  );

ALTER TABLE "ReconciliacionVenta"
  ADD CONSTRAINT "ReconciliacionVenta_tenant_reconciliacion_key"
  UNIQUE ("tenantId", "reconciliacionId");

CREATE TABLE "cash_payment_interest_allocations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reconciliacionId" TEXT NOT NULL,
  "asientoId" TEXT,
  "obligationType" TEXT NOT NULL,
  "policyVersion" INTEGER NOT NULL,
  "grantDate" DATE NOT NULL,
  "maturityDate" DATE,
  "paymentDate" DATE NOT NULL,
  "accrualCheckpointDate" DATE NOT NULL,
  "ordinaryElapsedDays" INTEGER NOT NULL,
  "moratoryElapsedDays" INTEGER NOT NULL,
  "ordinaryAnnualRate" DECIMAL(20, 10) NOT NULL,
  "moratoryAnnualRate" DECIMAL(20, 10) NOT NULL,
  "principalBefore" DECIMAL(20, 4) NOT NULL,
  "overduePrincipalBefore" DECIMAL(20, 4) NOT NULL,
  "ordinaryCarryBefore" DECIMAL(38, 18) NOT NULL,
  "moratoryCarryBefore" DECIMAL(38, 18) NOT NULL,
  "ordinaryAccruedThisPeriod" DECIMAL(38, 18) NOT NULL,
  "moratoryAccruedThisPeriod" DECIMAL(38, 18) NOT NULL,
  "paymentAmount" DECIMAL(20, 4) NOT NULL,
  "moratoryAllocated" DECIMAL(20, 4) NOT NULL,
  "ordinaryAllocated" DECIMAL(20, 4) NOT NULL,
  "principalAllocated" DECIMAL(20, 4) NOT NULL,
  "principalAfter" DECIMAL(20, 4) NOT NULL,
  "ordinaryCarryAfter" DECIMAL(38, 18) NOT NULL,
  "moratoryCarryAfter" DECIMAL(38, 18) NOT NULL,
  "functionalAmount" DECIMAL(20, 4) NOT NULL,
  "moratoryFunctional" DECIMAL(20, 4) NOT NULL,
  "ordinaryFunctional" DECIMAL(20, 4) NOT NULL,
  "principalFunctional" DECIMAL(20, 4) NOT NULL,
  "functionalCurrency" TEXT NOT NULL,
  "fxEvidenceFingerprint" TEXT,
  "eventFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_payment_interest_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_payment_interest_allocations_obligation_check"
    CHECK ("obligationType" IN ('loan', 'debt') AND "policyVersion" = 1),
  CONSTRAINT "cash_payment_interest_allocations_nonnegative_check"
    CHECK (
      "ordinaryElapsedDays" >= 0 AND "moratoryElapsedDays" >= 0
      AND "ordinaryAnnualRate" >= 0 AND "moratoryAnnualRate" >= 0
      AND "principalBefore" >= 0 AND "overduePrincipalBefore" >= 0
      AND "overduePrincipalBefore" <= "principalBefore"
      AND "ordinaryCarryBefore" >= 0 AND "moratoryCarryBefore" >= 0
      AND "ordinaryAccruedThisPeriod" >= 0 AND "moratoryAccruedThisPeriod" >= 0
      AND "paymentAmount" > 0 AND "moratoryAllocated" >= 0
      AND "ordinaryAllocated" >= 0 AND "principalAllocated" >= 0
      AND "principalAfter" >= 0 AND "ordinaryCarryAfter" >= 0
      AND "moratoryCarryAfter" >= 0
      AND "functionalAmount" > 0 AND "moratoryFunctional" >= 0
      AND "ordinaryFunctional" >= 0 AND "principalFunctional" >= 0
    ),
  CONSTRAINT "cash_payment_interest_allocations_conservation_check"
    CHECK (
      "moratoryAllocated" + "ordinaryAllocated" + "principalAllocated" = "paymentAmount"
      AND "principalBefore" - "principalAllocated" = "principalAfter"
      AND "moratoryFunctional" + "ordinaryFunctional" + "principalFunctional" = "functionalAmount"
    ),
  CONSTRAINT "cash_payment_interest_allocations_tenant_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_payment_interest_allocations_reconciliation_fkey"
    FOREIGN KEY ("tenantId", "reconciliacionId")
    REFERENCES "ReconciliacionVenta"("tenantId", "reconciliacionId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_payment_interest_allocations_asiento_fkey"
    FOREIGN KEY ("tenantId", "asientoId")
    REFERENCES "asientos"("tenantId", "asientoId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "cash_payment_interest_allocations_tenant_id_key"
  ON "cash_payment_interest_allocations"("tenantId", "id");
CREATE UNIQUE INDEX "cash_payment_interest_allocations_tenant_reconciliation_key"
  ON "cash_payment_interest_allocations"("tenantId", "reconciliacionId");
CREATE UNIQUE INDEX "cash_payment_interest_allocations_tenant_asiento_key"
  ON "cash_payment_interest_allocations"("tenantId", "asientoId");
CREATE INDEX "cash_payment_interest_allocations_tenant_payment_date_idx"
  ON "cash_payment_interest_allocations"("tenantId", "paymentDate");

CREATE FUNCTION "reject_cash_payment_interest_allocation_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'cash payment interest allocation is immutable'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cash_payment_interest_allocations_append_only"
  BEFORE UPDATE OR DELETE ON "cash_payment_interest_allocations"
  FOR EACH ROW EXECUTE FUNCTION "reject_cash_payment_interest_allocation_mutation"();

COMMIT;
