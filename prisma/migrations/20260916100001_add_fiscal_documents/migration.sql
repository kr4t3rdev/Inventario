-- CreateEnum
CREATE TYPE "EstadoFiscalDocumento" AS ENUM ('PENDIENTE', 'PROCESANDO', 'TIMBRADA', 'RECHAZADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "taxIdCliente" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "codigoPostalFiscal" TEXT,
ADD COLUMN     "fiscalActivado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "razonSocial" TEXT,
ADD COLUMN     "regimenFiscal" TEXT,
ADD COLUMN     "taxId" TEXT;

-- CreateTable
CREATE TABLE "fiscal_documents" (
    "fiscalDocumentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "jurisdiccion" TEXT NOT NULL DEFAULT 'LOCAL',
    "tipoDocumento" TEXT NOT NULL DEFAULT 'FACTURA',
    "estado" "EstadoFiscalDocumento" NOT NULL DEFAULT 'PENDIENTE',
    "uuidExterno" TEXT,
    "xml" TEXT,
    "folio" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_documents_pkey" PRIMARY KEY ("fiscalDocumentId")
);

-- CreateTable
CREATE TABLE "fiscal_emision_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fiscalDocumentId" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "detalle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_emision_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_documents_facturaId_key" ON "fiscal_documents"("facturaId");

-- CreateIndex
CREATE INDEX "fiscal_documents_tenantId_estado_idx" ON "fiscal_documents"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "fiscal_documents_tenantId_createdAt_idx" ON "fiscal_documents"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "fiscal_emision_events_tenantId_fiscalDocumentId_createdAt_idx" ON "fiscal_emision_events"("tenantId", "fiscalDocumentId", "createdAt");

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("idFactura") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_emision_events" ADD CONSTRAINT "fiscal_emision_events_fiscalDocumentId_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "fiscal_documents"("fiscalDocumentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_emision_events" ADD CONSTRAINT "fiscal_emision_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

