CREATE TABLE "purchase_receipt_invoice_allocations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "compraDocumentoItemId" TEXT NOT NULL,
    "recepcionItemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costoUnitarioSnapshot" INTEGER,
    "fifoMonedaOrigen" TEXT,
    "fifoFechaFuente" TIMESTAMP(3),
    "fifoMonedaFuncional" TEXT,
    "fifoCostoFuncional" DECIMAL(20,4),
    "fifoTasaCambio" DECIMAL(20,10),
    "fifoFechaTasa" TIMESTAMP(3),
    "fifoEvidenciaFx" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipt_invoice_allocations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "purchase_allocations"
ADD COLUMN "purchaseReceiptInvoiceAllocationId" TEXT;

CREATE UNIQUE INDEX "purchase_receipt_invoice_allocations_tenantId_id_key"
ON "purchase_receipt_invoice_allocations"("tenantId", "id");

CREATE UNIQUE INDEX "purchase_receipt_invoice_allocations_tenantId_id_recepcionItemId_key"
ON "purchase_receipt_invoice_allocations"("tenantId", "id", "recepcionItemId");

CREATE UNIQUE INDEX "purchase_receipt_invoice_allocations_tenantId_compraDocumentoItemId_recepcionItemId_key"
ON "purchase_receipt_invoice_allocations"("tenantId", "compraDocumentoItemId", "recepcionItemId");

CREATE INDEX "purchase_receipt_invoice_allocations_tenantId_recepcionItemId_idx"
ON "purchase_receipt_invoice_allocations"("tenantId", "recepcionItemId");

CREATE INDEX "purchase_allocations_tenantId_purchaseReceiptInvoiceAllocationId_idx"
ON "purchase_allocations"("tenantId", "purchaseReceiptInvoiceAllocationId");

ALTER TABLE "purchase_receipt_invoice_allocations"
ADD CONSTRAINT "purchase_receipt_invoice_allocations_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_receipt_invoice_allocations"
ADD CONSTRAINT "purchase_receipt_invoice_allocations_tenantId_compraDocumentoItemId_fkey"
FOREIGN KEY ("tenantId", "compraDocumentoItemId")
REFERENCES "CompraDocumentoItem"("tenantId", "compraDocumentoItemId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_receipt_invoice_allocations"
ADD CONSTRAINT "purchase_receipt_invoice_allocations_tenantId_recepcionItemId_fkey"
FOREIGN KEY ("tenantId", "recepcionItemId")
REFERENCES "RecepcionItem"("tenantId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_allocations"
ADD CONSTRAINT "purchase_allocations_tenantId_purchaseReceiptInvoiceAllocationId_recepcionItemId_fkey"
FOREIGN KEY ("tenantId", "purchaseReceiptInvoiceAllocationId", "recepcionItemId")
REFERENCES "purchase_receipt_invoice_allocations"("tenantId", "id", "recepcionItemId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_allocations"
ADD CONSTRAINT "purchase_allocations_invoice_link_requires_receipt_check"
CHECK ("purchaseReceiptInvoiceAllocationId" IS NULL OR "recepcionItemId" IS NOT NULL);
