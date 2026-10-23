BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE "reviews" (
  "reviewId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "isPositive" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reviews_pkey" PRIMARY KEY ("reviewId"),
  CONSTRAINT "reviews_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reviews_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "review_prompts" (
  "promptId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "promptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),

  CONSTRAINT "review_prompts_pkey" PRIMARY KEY ("promptId"),
  CONSTRAINT "review_prompts_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_prompts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "reviews_tenantId_userId_key" ON "reviews"("tenantId", "userId");
CREATE INDEX "reviews_tenantId_isApproved_idx" ON "reviews"("tenantId", "isApproved");
CREATE INDEX "reviews_tenantId_isPositive_isApproved_idx"
  ON "reviews"("tenantId", "isPositive", "isApproved");
CREATE INDEX "review_prompts_tenantId_userId_promptedAt_idx"
  ON "review_prompts"("tenantId", "userId", "promptedAt");

COMMIT;
