-- AlterTable
ALTER TABLE "asientos" ADD COLUMN     "replayRunId" TEXT;

-- CreateTable
CREATE TABLE "contabilidad_replay_preflights" (
    "replayPreflightId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "digestVersion" INTEGER NOT NULL,
    "digest" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contabilidad_replay_preflights_pkey" PRIMARY KEY ("replayPreflightId")
);

-- CreateTable
CREATE TABLE "contabilidad_replay_approvals" (
    "replayApprovalId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "replayPreflightId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "digestVersion" INTEGER NOT NULL,
    "digest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contabilidad_replay_approvals_pkey" PRIMARY KEY ("replayApprovalId")
);

-- CreateTable
CREATE TABLE "contabilidad_replay_runs" (
    "replayRunId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "replayPreflightId" TEXT NOT NULL,
    "replayApprovalId" TEXT NOT NULL,
    "startedByUserId" TEXT NOT NULL,
    "digestVersion" INTEGER NOT NULL,
    "digest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "postedCount" INTEGER NOT NULL DEFAULT 0,
    "omittedCount" INTEGER NOT NULL DEFAULT 0,
    "ambiguousCount" INTEGER NOT NULL DEFAULT 0,
    "noFxCount" INTEGER NOT NULL DEFAULT 0,
    "noCostCount" INTEGER NOT NULL DEFAULT 0,
    "outOfPeriodCount" INTEGER NOT NULL DEFAULT 0,
    "diagnostic" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contabilidad_replay_runs_pkey" PRIMARY KEY ("replayRunId")
);

-- CreateIndex
CREATE INDEX "contabilidad_replay_preflights_tenantId_periodoId_generated_idx" ON "contabilidad_replay_preflights"("tenantId", "periodoId", "generatedAt");

-- CreateIndex
CREATE INDEX "contabilidad_replay_preflights_tenantId_expiresAt_status_idx" ON "contabilidad_replay_preflights"("tenantId", "expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contab_replay_preflight_id_key" ON "contabilidad_replay_preflights"("tenantId", "replayPreflightId");

-- CreateIndex
CREATE UNIQUE INDEX "contab_replay_preflight_requester_key" ON "contabilidad_replay_preflights"("tenantId", "replayPreflightId", "requestedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "contab_replay_preflight_digest_key" ON "contabilidad_replay_preflights"("tenantId", "replayPreflightId", "requestedByUserId", "digestVersion", "digest");

-- CreateIndex
CREATE INDEX "contabilidad_replay_approvals_tenantId_approvedByUserId_app_idx" ON "contabilidad_replay_approvals"("tenantId", "approvedByUserId", "approvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "contabilidad_replay_approvals_tenantId_replayApprovalId_key" ON "contabilidad_replay_approvals"("tenantId", "replayApprovalId");

-- CreateIndex
CREATE UNIQUE INDEX "contab_replay_approval_preflight_key" ON "contabilidad_replay_approvals"("tenantId", "replayPreflightId");

-- CreateIndex
CREATE UNIQUE INDEX "contab_replay_approval_actor_key" ON "contabilidad_replay_approvals"("tenantId", "replayPreflightId", "requestedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "contab_replay_approval_binding_key" ON "contabilidad_replay_approvals"("tenantId", "replayPreflightId", "replayApprovalId");

-- CreateIndex
CREATE UNIQUE INDEX "contab_replay_approval_preflight_digest_key" ON "contabilidad_replay_approvals"("tenantId", "replayPreflightId", "requestedByUserId", "digestVersion", "digest");

-- CreateIndex
CREATE UNIQUE INDEX "contab_replay_approval_digest_binding_key" ON "contabilidad_replay_approvals"("tenantId", "replayPreflightId", "replayApprovalId", "digestVersion", "digest");

-- CreateIndex
CREATE INDEX "contabilidad_replay_runs_tenantId_replayPreflightId_started_idx" ON "contabilidad_replay_runs"("tenantId", "replayPreflightId", "startedAt");

-- CreateIndex
CREATE INDEX "contabilidad_replay_runs_tenantId_status_startedAt_idx" ON "contabilidad_replay_runs"("tenantId", "status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "contabilidad_replay_runs_tenantId_replayRunId_key" ON "contabilidad_replay_runs"("tenantId", "replayRunId");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_contables_tenantId_periodoId_key" ON "periodos_contables"("tenantId", "periodoId");

-- CreateIndex
CREATE INDEX "asientos_tenantId_replayRunId_idx" ON "asientos"("tenantId", "replayRunId");

-- AddForeignKey
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_tenantId_replayRunId_fkey" FOREIGN KEY ("tenantId", "replayRunId") REFERENCES "contabilidad_replay_runs"("tenantId", "replayRunId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_replay_preflights" ADD CONSTRAINT "contabilidad_replay_preflights_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_replay_preflights" ADD CONSTRAINT "contabilidad_replay_preflights_tenantId_periodoId_fkey" FOREIGN KEY ("tenantId", "periodoId") REFERENCES "periodos_contables"("tenantId", "periodoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_replay_preflights" ADD CONSTRAINT "contabilidad_replay_preflights_tenantId_requestedByUserId_fkey" FOREIGN KEY ("tenantId", "requestedByUserId") REFERENCES "tenant_memberships"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_replay_approvals" ADD CONSTRAINT "contabilidad_replay_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_replay_approvals" ADD CONSTRAINT "contabilidad_replay_approvals_tenantId_replayPreflightId_r_fkey" FOREIGN KEY ("tenantId", "replayPreflightId", "requestedByUserId", "digestVersion", "digest") REFERENCES "contabilidad_replay_preflights"("tenantId", "replayPreflightId", "requestedByUserId", "digestVersion", "digest") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_replay_approvals" ADD CONSTRAINT "contabilidad_replay_approvals_tenantId_requestedByUserId_fkey" FOREIGN KEY ("tenantId", "requestedByUserId") REFERENCES "tenant_memberships"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_replay_approvals" ADD CONSTRAINT "contabilidad_replay_approvals_tenantId_approvedByUserId_fkey" FOREIGN KEY ("tenantId", "approvedByUserId") REFERENCES "tenant_memberships"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_replay_runs" ADD CONSTRAINT "contabilidad_replay_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_replay_runs" ADD CONSTRAINT "contabilidad_replay_runs_tenantId_replayPreflightId_fkey" FOREIGN KEY ("tenantId", "replayPreflightId") REFERENCES "contabilidad_replay_preflights"("tenantId", "replayPreflightId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_replay_runs" ADD CONSTRAINT "contabilidad_replay_runs_tenantId_replayPreflightId_replay_fkey" FOREIGN KEY ("tenantId", "replayPreflightId", "replayApprovalId", "digestVersion", "digest") REFERENCES "contabilidad_replay_approvals"("tenantId", "replayPreflightId", "replayApprovalId", "digestVersion", "digest") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabilidad_replay_runs" ADD CONSTRAINT "contabilidad_replay_runs_tenantId_startedByUserId_fkey" FOREIGN KEY ("tenantId", "startedByUserId") REFERENCES "tenant_memberships"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Keep approvals bound to a different requester at the database boundary.
ALTER TABLE "contabilidad_replay_approvals"
ADD CONSTRAINT "contab_replay_approval_different_actor_check"
CHECK ("requestedByUserId" <> "approvedByUserId");

-- The agreed preflight lifetime is exactly 24 hours from snapshot generation.
ALTER TABLE "contabilidad_replay_preflights"
ADD CONSTRAINT "contab_replay_preflight_24h_expiry_check"
CHECK ("expiresAt" = "generatedAt" + INTERVAL '24 hours');
