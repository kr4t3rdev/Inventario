CREATE TABLE "periodo_contable_versiones" (
  "tenantId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "periodo_contable_versiones_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "periodo_contable_versiones_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "periodo_contable_versiones" ("tenantId", "version")
SELECT DISTINCT "tenantId", 0
FROM "periodos_contables"
ON CONFLICT ("tenantId") DO NOTHING;
