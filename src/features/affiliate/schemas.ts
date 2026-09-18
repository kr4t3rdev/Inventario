import { z } from 'zod';

import { REFERRAL_ALLOWED_FEATURE_KEYS } from './services/perk-service';

export const generateReferralCodeSchema = z.object({}).optional();

export const registerReferralFromCodeSchema = z.object({
  referralCode: z.string().trim().min(3).max(64),
});

export const confirmReferredTenantPaymentSchema = z.object({
  referralId: z.string().trim().min(1).optional(),
  referredTenantId: z.string().trim().min(1).optional(),
  sourceTenantLicenseId: z.string().trim().min(1),
}).refine((value) => Boolean(value.referralId || value.referredTenantId), {
  message: 'Se requiere referralId o referredTenantId',
  path: ['referralId'],
});

export const applyAffiliateCreditsToLicensePreviewSchema = z.object({
  tenantLicenseId: z.string().trim().min(1),
});

export const assignReferralPerkSchema = z.object({
  perkGrantId: z.string().trim().min(1),
  tenantLicenseId: z.string().trim().min(1),
  featureKey: z.enum(REFERRAL_ALLOWED_FEATURE_KEYS as [string, ...string[]]),
});

export const requestCustomReferralPerkSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(500),
});

export const reviewCustomReferralPerkSchema = z.object({
  referralPerkRequestId: z.string().trim().min(1),
  status: z.enum(['approved', 'rejected']),
  adminNotes: z.string().trim().max(500).optional(),
});

export type RegisterReferralFromCodeInput = z.infer<typeof registerReferralFromCodeSchema>;
export type ConfirmReferredTenantPaymentInput = z.infer<typeof confirmReferredTenantPaymentSchema>;
export type ApplyAffiliateCreditsToLicensePreviewInput = z.infer<typeof applyAffiliateCreditsToLicensePreviewSchema>;
export type AssignReferralPerkInput = z.infer<typeof assignReferralPerkSchema>;
export type RequestCustomReferralPerkInput = z.infer<typeof requestCustomReferralPerkSchema>;
export type ReviewCustomReferralPerkInput = z.infer<typeof reviewCustomReferralPerkSchema>;
