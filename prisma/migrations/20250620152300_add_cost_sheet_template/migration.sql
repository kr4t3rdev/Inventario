-- CreateTable
CREATE TABLE "ProductoCostSheetTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "nombre" TEXT NOT NULL DEFAULT '',
    "costoMateriales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoManoObra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoIndirectos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margenObjetivo" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    "precioSugerido" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esActiva" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ProductoCostSheetTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoCostSheetTemplate_productoId_esActiva_key" ON "ProductoCostSheetTemplate"("productoId", "esActiva");

-- CreateIndex
CREATE INDEX "ProductoCostSheetTemplate_tenantId_idx" ON "ProductoCostSheetTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "ProductoCostSheetTemplate_productoId_idx" ON "ProductoCostSheetTemplate"("productoId");
