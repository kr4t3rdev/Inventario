-- Checkpoint contable formal: evidencia durable del reporte con procedencia en el mayor formal.
BEGIN;

-- CreateTable
CREATE TABLE "contabilidad_checkpoints_formales" (
    "checkpointId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "ledgerHash" TEXT NOT NULL,
    "replayRunId" TEXT,
    "payload" JSONB NOT NULL,
    "hashIntegridad" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contabilidad_checkpoints_formales_pkey" PRIMARY KEY ("checkpointId")
);

-- CreateIndex
CREATE INDEX "contabilidad_checkpoints_formales_tenantId_periodoId_cutoffAt_idx" ON "contabilidad_checkpoints_formales"("tenantId", "periodoId", "cutoffAt");

-- CreateIndex
CREATE UNIQUE INDEX "contabilidad_checkpoints_formales_tenantId_checkpointId_key" ON "contabilidad_checkpoints_formales"("tenantId", "checkpointId");

-- AddForeignKey
ALTER TABLE "contabilidad_checkpoints_formales" ADD CONSTRAINT "contabilidad_checkpoints_formales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_checkpoints_formales" ADD CONSTRAINT "contabilidad_checkpoints_formales_tenantId_periodoId_fkey" FOREIGN KEY ("tenantId", "periodoId") REFERENCES "periodos_contables"("tenantId", "periodoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_checkpoints_formales" ADD CONSTRAINT "contabilidad_checkpoints_formales_tenantId_replayRunId_fkey" FOREIGN KEY ("tenantId", "replayRunId") REFERENCES "contabilidad_replay_runs"("tenantId", "replayRunId") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
