-- Ajuste unificado y toma física de inventario.
CREATE TABLE "AjusteInventario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipoUbicacion" TEXT NOT NULL,
    "ubicacionId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "cantidadTeorica" INTEGER NOT NULL,
    "cantidadContada" INTEGER NOT NULL,
    "diferencia" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL,
    "costoTotal" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'APLICADO',
    "origenMermaId" TEXT,
    "origenValeId" TEXT,
    "origenConteoId" TEXT,
    "compensaMovimientoId" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AjusteInventario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConteoInventario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipoUbicacion" TEXT NOT NULL,
    "ubicacionId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "iniciadoPorId" TEXT,
    "conciliadoPorId" TEXT,
    "conciliadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConteoInventario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConteoLinea" (
    "id" TEXT NOT NULL,
    "conteoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "teorico" INTEGER NOT NULL,
    "conteo1" INTEGER,
    "conteo2" INTEGER,
    "contadoFinal" INTEGER,
    "usuario1Id" TEXT,
    "usuario2Id" TEXT,
    "ajusteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConteoLinea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AjusteInventario_tenantId_estado_idx" ON "AjusteInventario"("tenantId", "estado");
CREATE INDEX "AjusteInventario_tenantId_productoId_idx" ON "AjusteInventario"("tenantId", "productoId");
CREATE INDEX "AjusteInventario_tenantId_origenConteoId_idx" ON "AjusteInventario"("tenantId", "origenConteoId");
CREATE INDEX "ConteoInventario_tenantId_estado_idx" ON "ConteoInventario"("tenantId", "estado");
CREATE INDEX "ConteoInventario_tenantId_ubicacionId_idx" ON "ConteoInventario"("tenantId", "ubicacionId");
CREATE UNIQUE INDEX "ConteoLinea_conteoId_productoId_key" ON "ConteoLinea"("conteoId", "productoId");
CREATE INDEX "ConteoLinea_tenantId_idx" ON "ConteoLinea"("tenantId");

ALTER TABLE "AjusteInventario"
    ADD CONSTRAINT "AjusteInventario_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConteoInventario"
    ADD CONSTRAINT "ConteoInventario_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConteoLinea"
    ADD CONSTRAINT "ConteoLinea_conteoId_fkey"
    FOREIGN KEY ("conteoId") REFERENCES "ConteoInventario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConteoLinea"
    ADD CONSTRAINT "ConteoLinea_ajusteId_fkey"
    FOREIGN KEY ("ajusteId") REFERENCES "AjusteInventario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
