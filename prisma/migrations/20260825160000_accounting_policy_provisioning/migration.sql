-- Persistencia operacional aditiva. Esta migración no asigna monedas funcionales.
ALTER TABLE "User"
ADD COLUMN "pendingFunctionalCurrencyCode" TEXT;

CREATE TABLE "accounting_policy_rollout_runs" (
  "runId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "manifestHash" TEXT,
  "status" TEXT NOT NULL,
  "executorUserId" TEXT NOT NULL,
  "approverUserId" TEXT,
  "reason" TEXT NOT NULL,
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "accounting_policy_rollout_runs_pkey" PRIMARY KEY ("runId")
);

CREATE TABLE "accounting_policy_rollout_entries" (
  "entryId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "functionalCurrencyCode" TEXT,
  "expectedClassification" TEXT,
  "observedClassification" TEXT NOT NULL,
  "projectedResult" TEXT,
  "finalResult" TEXT,
  "existingCurrencyCode" TEXT,
  "tenantApprovalId" TEXT,
  "safeError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accounting_policy_rollout_entries_pkey" PRIMARY KEY ("entryId")
);

CREATE TABLE "accounting_policy_tenant_approvals" (
  "approvalId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "functionalCurrencyCode" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "correlationId" TEXT NOT NULL,
  "approvalHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_policy_tenant_approvals_pkey" PRIMARY KEY ("approvalId")
);

CREATE INDEX "accounting_policy_rollout_runs_mode_status_createdAt_idx"
ON "accounting_policy_rollout_runs"("mode", "status", "createdAt");
CREATE INDEX "accounting_policy_rollout_runs_manifestHash_mode_status_idx"
ON "accounting_policy_rollout_runs"("manifestHash", "mode", "status");
CREATE UNIQUE INDEX "accounting_policy_rollout_entries_runId_tenantId_key"
ON "accounting_policy_rollout_entries"("runId", "tenantId");
CREATE INDEX "accounting_policy_rollout_entries_tenantId_createdAt_idx"
ON "accounting_policy_rollout_entries"("tenantId", "createdAt");
CREATE UNIQUE INDEX "accounting_policy_tenant_approvals_tenantId_functionalCurrencyCode_approvalHash_key"
ON "accounting_policy_tenant_approvals"("tenantId", "functionalCurrencyCode", "approvalHash");
CREATE INDEX "accounting_policy_tenant_approvals_tenantId_status_expiresAt_idx"
ON "accounting_policy_tenant_approvals"("tenantId", "status", "expiresAt");

ALTER TABLE "accounting_policy_rollout_entries"
ADD CONSTRAINT "accounting_policy_rollout_entries_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "accounting_policy_rollout_runs"("runId")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounting_policy_rollout_entries"
ADD CONSTRAINT "accounting_policy_rollout_entries_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_policy_tenant_approvals"
ADD CONSTRAINT "accounting_policy_tenant_approvals_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;
