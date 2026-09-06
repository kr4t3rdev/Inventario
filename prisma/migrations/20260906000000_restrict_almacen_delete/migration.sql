-- Bloquea el borrado en cascada de almacenes (CU-04).
-- Segunda línea de defensa: la base de datos rechaza el borrado con dependencias.
-- La aplicación valida antes con deleteAlmacenAction (código ALMACEN_EN_USO).

ALTER TABLE "Producto" DROP CONSTRAINT "Producto_almacenId_fkey";
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("almacenId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Merma" DROP CONSTRAINT "Merma_almacenId_fkey";
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("almacenId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PuntoDeVenta" DROP CONSTRAINT "PuntoDeVenta_almacenId_fkey";
ALTER TABLE "PuntoDeVenta" ADD CONSTRAINT "PuntoDeVenta_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("almacenId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transferencia" DROP CONSTRAINT "Transferencia_origenId_fkey";
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "Almacen"("almacenId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transferencia" DROP CONSTRAINT "Transferencia_destinoId_fkey";
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Almacen"("almacenId") ON DELETE RESTRICT ON UPDATE CASCADE;
