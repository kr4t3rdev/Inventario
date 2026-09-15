-- CreateTable: PurchaseAllocation (FIFO tracking)
CREATE TABLE "purchase_allocations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "compraDocumentoItemId" TEXT NOT NULL,
    "ventaItemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "purchase_allocations_compraDocumentoItemId_idx" ON "purchase_allocations"("compraDocumentoItemId");
CREATE INDEX "purchase_allocations_ventaItemId_idx" ON "purchase_allocations"("ventaItemId");
CREATE INDEX "purchase_allocations_tenantId_idx" ON "purchase_allocations"("tenantId");

-- AddForeignKeys
ALTER TABLE "purchase_allocations" ADD CONSTRAINT "purchase_allocations_compraDocumentoItemId_fkey" FOREIGN KEY ("compraDocumentoItemId") REFERENCES "CompraDocumentoItem"("compraDocumentoItemId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_allocations" ADD CONSTRAINT "purchase_allocations_ventaItemId_fkey" FOREIGN KEY ("ventaItemId") REFERENCES "venta_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_allocations" ADD CONSTRAINT "purchase_allocations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
