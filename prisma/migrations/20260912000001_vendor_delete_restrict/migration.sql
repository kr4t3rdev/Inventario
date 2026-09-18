-- Bloquea el borrado en cascada de proveedores (B-03).
-- Segunda línea de defensa: la base de datos rechaza el borrado cuando el
-- proveedor tiene historia (productos, compras o gastos de compra).
-- La aplicación valida antes con deleteVendorAction (código PROVEEDOR_EN_USO).
-- OrdenCompra ya era Restrict y las FKs opcionales (CompraServicio, Contrato,
-- CuentaPorPagar, Anticipo) quedan en su política por defecto (SetNull);
-- la guarda de aplicación también las cuenta para informar al usuario.

ALTER TABLE "Producto" DROP CONSTRAINT "Producto_vendorId_fkey";
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GastoCompra" DROP CONSTRAINT "GastoCompra_vendorId_fkey";
ALTER TABLE "GastoCompra" ADD CONSTRAINT "GastoCompra_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompraProducto" DROP CONSTRAINT "CompraProducto_proveedorId_fkey";
ALTER TABLE "CompraProducto" ADD CONSTRAINT "CompraProducto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompraDocumento" DROP CONSTRAINT "CompraDocumento_proveedorId_fkey";
ALTER TABLE "CompraDocumento" ADD CONSTRAINT "CompraDocumento_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;
