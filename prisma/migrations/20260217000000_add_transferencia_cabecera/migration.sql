-- Create TransferenciaCabecera table
CREATE TABLE "TransferenciaCabecera" (
    "cabeceraId" TEXT NOT NULL,
    "numeroTransferencia" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "tipoOrigen" TEXT NOT NULL,
    "origenId" TEXT NOT NULL,
    "tipoDestino" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "descripcion" TEXT,
    "creadoPorId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferenciaCabecera_pkey" PRIMARY KEY ("cabeceraId")
);

-- Create TransferenciaItem table
CREATE TABLE "TransferenciaItem" (
    "itemId" TEXT NOT NULL,
    "cabeceraId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "cantidadRecibida" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TransferenciaItem_pkey" PRIMARY KEY ("itemId")
);

-- Create unique index on numeroTransferencia
CREATE UNIQUE INDEX "TransferenciaCabecera_numeroTransferencia_key" ON "TransferenciaCabecera"("numeroTransferencia");

-- Create indexes
CREATE INDEX "TransferenciaCabecera_estado_idx" ON "TransferenciaCabecera"("estado");
CREATE INDEX "TransferenciaCabecera_origenId_idx" ON "TransferenciaCabecera"("origenId");
CREATE INDEX "TransferenciaCabecera_destinoId_idx" ON "TransferenciaCabecera"("destinoId");
CREATE INDEX "TransferenciaCabecera_createdAt_idx" ON "TransferenciaCabecera"("createdAt");
CREATE INDEX "TransferenciaCabecera_deletedAt_idx" ON "TransferenciaCabecera"("deletedAt");
CREATE INDEX "TransferenciaItem_cabeceraId_idx" ON "TransferenciaItem"("cabeceraId");
CREATE INDEX "TransferenciaItem_productoId_idx" ON "TransferenciaItem"("productoId");

-- Add foreign key constraints
ALTER TABLE "TransferenciaCabecera" ADD CONSTRAINT "TransferenciaCabecera_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransferenciaItem" ADD CONSTRAINT "TransferenciaItem_cabeceraId_fkey" FOREIGN KEY ("cabeceraId") REFERENCES "TransferenciaCabecera"("cabeceraId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferenciaItem" ADD CONSTRAINT "TransferenciaItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
