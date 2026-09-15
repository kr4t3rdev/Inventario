ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "onboardingType" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingStatus" TEXT DEFAULT 'pending_email_verification',
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
