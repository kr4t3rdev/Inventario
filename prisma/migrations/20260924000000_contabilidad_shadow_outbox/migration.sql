-- Aditiva: evidencia del shadow confirmada junto con la operación de negocio.
CREATE TABLE "shadow_posteo_outbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipoEvento" TEXT NOT NULL,
    "origenTipo" TEXT NOT NULL,
    "origenId" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "causa" TEXT,
    "duracionMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregadoAt" TIMESTAMP(3),
    CONSTRAINT "shadow_posteo_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shadow_posteo_outbox_entregadoAt_createdAt_idx"
    ON "shadow_posteo_outbox"("entregadoAt", "createdAt");
CREATE INDEX "shadow_posteo_outbox_tenantId_tipoEvento_estado_idx"
    ON "shadow_posteo_outbox"("tenantId", "tipoEvento", "estado");
CREATE UNIQUE INDEX "shadow_posteo_outbox_tenantId_tipoEvento_origenTipo_origenI_key"
    ON "shadow_posteo_outbox"("tenantId", "tipoEvento", "origenTipo", "origenId");
