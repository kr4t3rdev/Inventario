BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE "OrdenProduccionHistorial" (
  "ordenProduccionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "estadoAnterior" TEXT NOT NULL,
  "estadoNuevo" TEXT NOT NULL,
  "observaciones" TEXT,
  "usuarioId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,

  CONSTRAINT "OrdenProduccionHistorial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrdenProduccionHistorial_ordenProduccionId_fkey"
    FOREIGN KEY ("ordenProduccionId") REFERENCES "OrdenProduccion"("ordenProduccionId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrdenProduccionHistorial_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ValeSalida" (
  "valeSalidaId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "concepto" VARCHAR(200) NOT NULL,
  "observaciones" VARCHAR(1000),
  "estado" TEXT NOT NULL DEFAULT 'COMPLETADO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ValeSalida_pkey" PRIMARY KEY ("valeSalidaId"),
  CONSTRAINT "ValeSalida_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ValeSalidaItem" (
  "valeSalidaItemId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "valeSalidaId" TEXT NOT NULL,
  "productoId" TEXT NOT NULL,
  "cantidad" INTEGER NOT NULL,
  "sourceTipoUbicacion" TEXT,
  "sourceUbicacionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ValeSalidaItem_pkey" PRIMARY KEY ("valeSalidaItemId"),
  CONSTRAINT "ValeSalidaItem_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ValeSalidaItem_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ValeSalidaItem_valeSalidaId_fkey"
    FOREIGN KEY ("valeSalidaId") REFERENCES "ValeSalida"("valeSalidaId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OrdenProduccionHistorial_tenantId_idx" ON "OrdenProduccionHistorial"("tenantId");
CREATE INDEX "ValeSalida_tenantId_idx" ON "ValeSalida"("tenantId");
CREATE INDEX "ValeSalidaItem_tenantId_idx" ON "ValeSalidaItem"("tenantId");

COMMIT;
