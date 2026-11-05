CREATE UNIQUE INDEX "Categoria_tenantId_catId_key" ON "Categoria"("tenantId", "catId");

CREATE TABLE "ReglaPutaway" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoId" TEXT,
    "categoriaId" TEXT,
    "ubicacionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReglaPutaway_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReglaPutaway_scope_check" CHECK (
        ("productoId" IS NOT NULL AND "categoriaId" IS NULL) OR
        ("productoId" IS NULL AND "categoriaId" IS NOT NULL)
    ),
    CONSTRAINT "ReglaPutaway_tenantId_fkey" FOREIGN KEY ("tenantId")
        REFERENCES "Tenant"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReglaPutaway_producto_tenant_fkey" FOREIGN KEY ("tenantId", "productoId")
        REFERENCES "Producto"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReglaPutaway_categoria_tenant_fkey" FOREIGN KEY ("tenantId", "categoriaId")
        REFERENCES "Categoria"("tenantId", "catId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReglaPutaway_ubicacion_tenant_fkey" FOREIGN KEY ("tenantId", "ubicacionId")
        REFERENCES "Ubicacion"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReglaPutaway_tenantId_productoId_key" ON "ReglaPutaway"("tenantId", "productoId");
CREATE UNIQUE INDEX "ReglaPutaway_tenantId_categoriaId_key" ON "ReglaPutaway"("tenantId", "categoriaId");
CREATE INDEX "ReglaPutaway_tenantId_ubicacionId_idx" ON "ReglaPutaway"("tenantId", "ubicacionId");
