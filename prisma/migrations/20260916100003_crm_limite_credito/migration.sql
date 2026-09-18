-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "limiteCredito" INTEGER;

-- CreateTable
CREATE TABLE "cobro_notas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "causa" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cobro_notas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cobro_notas_tenantId_clienteId_idx" ON "cobro_notas"("tenantId", "clienteId");

-- AddForeignKey
ALTER TABLE "cobro_notas" ADD CONSTRAINT "cobro_notas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobro_notas" ADD CONSTRAINT "cobro_notas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

