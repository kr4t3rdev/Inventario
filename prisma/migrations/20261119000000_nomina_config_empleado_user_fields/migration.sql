ALTER TABLE "Empleado"
  ADD COLUMN "ci" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "banco" TEXT,
  ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "Empleado_userId_key" ON "Empleado"("userId");

ALTER TABLE "Empleado"
  ADD CONSTRAINT "Empleado_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("userId")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NominaConfig" (
  "tenantId" TEXT NOT NULL,
  "tarifaHoraExtra" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
  "horasMensualesEstandar" INTEGER NOT NULL DEFAULT 192,
  "monedaPago" TEXT NOT NULL DEFAULT 'CUP',
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NominaConfig_pkey" PRIMARY KEY ("tenantId")
);

ALTER TABLE "NominaConfig"
  ADD CONSTRAINT "NominaConfig_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
