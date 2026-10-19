-- CTF-5: configuración de contratos por tenant (una fila por tenant).
-- Revisar manualmente; producción aplica el schema con PRISMA_MIGRATION_MODE=db-push.

-- CreateTable
CREATE TABLE "ConfiguracionContratos" (
    "configId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "diasAvisoVencimiento" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionContratos_pkey" PRIMARY KEY ("configId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionContratos_tenantId_key" ON "ConfiguracionContratos"("tenantId");

-- AddForeignKey
ALTER TABLE "ConfiguracionContratos" ADD CONSTRAINT "ConfiguracionContratos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
