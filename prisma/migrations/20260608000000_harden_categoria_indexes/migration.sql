-- CreateIndex
CREATE INDEX IF NOT EXISTS "Categoria_tenantId_parentId_idx" ON "Categoria"("tenantId", "parentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Producto_tenantId_subcategoriaId_idx" ON "Producto"("tenantId", "subcategoriaId");
