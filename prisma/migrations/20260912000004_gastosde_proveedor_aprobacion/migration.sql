-- B-04: proveedor con FK y flujo de aprobación en gastos de explotación.
-- proveedorId enlaza al catálogo (Restrict: borrar proveedor con gastos queda
-- bloqueado por la guarda de deleteVendorAction). El string proveedor se mantiene
-- como texto visible/legacy.
-- estado por defecto APROBADO: los registros históricos no cambian de
-- comportamiento; el código nuevo crea PENDIENTE explícitamente.

ALTER TABLE "GastosDE" ADD COLUMN "proveedorId" TEXT;
ALTER TABLE "GastosDE" ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'APROBADO';
ALTER TABLE "GastosDE" ADD COLUMN "aprobadoPorId" TEXT;

ALTER TABLE "GastosDE" ADD CONSTRAINT "GastosDE_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GastosDE" ADD CONSTRAINT "GastosDE_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "GastosDE_proveedorId_idx" ON "GastosDE"("proveedorId");
