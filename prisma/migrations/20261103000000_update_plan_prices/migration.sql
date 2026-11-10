-- Set the new monthly list and referral prices without changing license or
-- payment snapshots already recorded for tenants.
ALTER TABLE "Plan"
ADD COLUMN "referralDiscountUsd" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "Plan"
SET "precio" = 30, "referralDiscountUsd" = 5
WHERE lower("nombre") = 'básico' OR lower("nombre") = 'basico';

UPDATE "Plan"
SET "precio" = 60, "referralDiscountUsd" = 10
WHERE lower("nombre") = 'profesional';

UPDATE "Plan"
SET "precio" = 90, "referralDiscountUsd" = 15
WHERE lower("nombre") IN ('empresarial', 'enterprise');
