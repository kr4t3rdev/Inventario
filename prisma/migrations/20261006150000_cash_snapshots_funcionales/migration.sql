-- Snapshots funcionales cash: congelan el estado funcional (saldo pendiente en
-- moneda funcional + evidencia FX) de las CxC de préstamos cash y las CxP de
-- deudas cash en un punto del tiempo, para auditoría y conciliación histórica.
-- El snapshot NO reconvierte: congela los montos funcionales ya persistidos.
CREATE TABLE "cash_snapshots" (
    "snapshotId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "origenId" TEXT NOT NULL,
    "cuentaPorCobrarId" TEXT,
    "cuentaPorPagarId" TEXT,
    "monedaFuncional" TEXT NOT NULL,
    "montoDeudaFuncional" DECIMAL(20, 4) NOT NULL,
    "montoPagadoFuncional" DECIMAL(20, 4) NOT NULL,
    "saldoFuncional" DECIMAL(20, 4) NOT NULL,
    "tasaCambio" DECIMAL(20, 10),
    "rateEffectiveAt" TIMESTAMP(3),
    "fxEvidenceFingerprint" TEXT,
    "fechaCorte" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodoId" TEXT,
    "motivo" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_snapshots_pkey" PRIMARY KEY ("snapshotId")
);

ALTER TABLE "cash_snapshots" ADD CONSTRAINT "cash_snapshots_idempotencyKey_key" UNIQUE ("idempotencyKey");
ALTER TABLE "cash_snapshots" ADD CONSTRAINT "cash_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_snapshots" ADD CONSTRAINT "cash_snapshots_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos_contables"("periodoId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "cash_snapshots_tenantId_fechaCorte_idx" ON "cash_snapshots"("tenantId", "fechaCorte");
CREATE INDEX "cash_snapshots_tenantId_tipo_origenId_idx" ON "cash_snapshots"("tenantId", "tipo", "origenId");
