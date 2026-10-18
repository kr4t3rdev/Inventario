-- A-1 (correcciones-urgentes-2-datos): cascadas destructivas del catálogo → no destructivas.
-- Endurece las FK que permitían destruir el catálogo al borrar un punto de
-- venta o una categoría (hallazgo "cascade gemelo" de la re-auditoría).

-- Producto.puntoDeVenta: Cascade → SetNull (FK nullable: desvincula, no destruye).
ALTER TABLE "Producto" DROP CONSTRAINT "Producto_puntoDeVentaId_fkey";
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_puntoDeVentaId_fkey" FOREIGN KEY ("puntoDeVentaId") REFERENCES "PuntoDeVenta"("pvId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Producto.categoria: Cascade → Restrict (FK requerido; deleteCategoriaAction bloquea con productos).
ALTER TABLE "Producto" DROP CONSTRAINT "Producto_categoriaId_fkey";
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("catId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Categoria.parent: Cascade → Restrict (el guard impide borrar con subcategorías).
ALTER TABLE "Categoria" DROP CONSTRAINT "Categoria_parentId_fkey";
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Categoria"("catId") ON DELETE RESTRICT ON UPDATE CASCADE;
