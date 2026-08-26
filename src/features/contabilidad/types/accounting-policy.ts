export type AccountingPolicyOrigin = 'ONBOARDING' | 'DEMO' | 'TENANT_UI' | 'ROLLOUT';

export type EvidenceClassification = 'NONE' | 'PRESENT' | 'REVIEW_REQUIRED';

export type ProvisioningResult = 'CREATED' | 'UPDATED' | 'NO_OP' | 'CONFLICT' | 'BLOCKED';

export interface EvidenceCounts {
  checkpoints: number;
  snapshots: number;
  sales: number;
  services: number;
  expenses: number;
}

export interface AccountingPolicyEvidenceResult {
  classification: EvidenceClassification;
  counts: EvidenceCounts | null;
}

export interface ProvisionAccountingPolicyInput {
  tenantId: string;
  functionalCurrencyCode: string;
  actorUserId: string;
  origin: AccountingPolicyOrigin;
  reason: string;
  correlationId: string;
  expectedEvidence?: EvidenceClassification;
  manifestHash?: string;
  platformApproverUserId?: string;
  tenantApprovalId?: string;
}
