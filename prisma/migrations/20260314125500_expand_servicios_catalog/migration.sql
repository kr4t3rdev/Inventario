-- Expandir catálogo de servicios para clasificador comercial
ALTER TABLE "Servicios"
ADD COLUMN "codigoInterno" VARCHAR(11),
ADD COLUMN "codigoNegocio" VARCHAR(40),
ADD COLUMN "proveedorCodigo" VARCHAR(2),
ADD COLUMN "idSeccionCodigo" VARCHAR(2),
ADD COLUMN "especificoCodigo" VARCHAR(4),
ADD COLUMN "surtidoCodigo" VARCHAR(4),
ADD COLUMN "dcCodigo" VARCHAR(1),
ADD COLUMN "precioCosto" INTEGER,
ADD COLUMN "precioVenta" INTEGER,
ADD COLUMN "categoriaId" TEXT,
ADD COLUMN "subcategoriaId" TEXT,
ADD COLUMN "unidadId" TEXT,
ADD COLUMN "vendorId" TEXT,
ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Backward compatibility con campos existentes
ALTER TABLE "Servicios"
ALTER COLUMN "precio" SET DEFAULT 0;

ALTER TABLE "Servicios"
ALTER COLUMN "descripcion" DROP NOT NULL;

CREATE UNIQUE INDEX "Servicios_codigoInterno_key" ON "Servicios"("codigoInterno");
CREATE UNIQUE INDEX "Servicios_codigoNegocio_key" ON "Servicios"("codigoNegocio");
CREATE INDEX "Servicios_deletedAt_idx" ON "Servicios"("deletedAt");
CREATE INDEX "Servicios_nombre_idx" ON "Servicios"("nombre");
CREATE INDEX "Servicios_codigoNegocio_idx" ON "Servicios"("codigoNegocio");
CREATE INDEX "Servicios_vendorId_idx" ON "Servicios"("vendorId");

ALTER TABLE "Servicios"
ADD CONSTRAINT "Servicios_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "Vendor"("vendorId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Catálogo de servicios recibidos (egresos)
CREATE TABLE "CompraServicio" (
  "compraServicioId" TEXT NOT NULL,
  "servicioId" TEXT NOT NULL,
  "proveedorId" TEXT,
  "numeroFactura" TEXT,
  "costoUnitario" INTEGER NOT NULL,
  "cantidad" INTEGER NOT NULL DEFAULT 1,
  "total" INTEGER NOT NULL,
  "formaPago" TEXT NOT NULL,
  "estado" TEXT NOT NULL,
  "descripcion" TEXT,
  "fechaServicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaVencimiento" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CompraServicio_pkey" PRIMARY KEY ("compraServicioId")
);

CREATE INDEX "CompraServicio_deletedAt_idx" ON "CompraServicio"("deletedAt");
CREATE INDEX "CompraServicio_servicioId_idx" ON "CompraServicio"("servicioId");
CREATE INDEX "CompraServicio_proveedorId_idx" ON "CompraServicio"("proveedorId");
CREATE INDEX "CompraServicio_estado_idx" ON "CompraServicio"("estado");

ALTER TABLE "CompraServicio"
ADD CONSTRAINT "CompraServicio_servicioId_fkey"
FOREIGN KEY ("servicioId") REFERENCES "Servicios"("servicioId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompraServicio"
ADD CONSTRAINT "CompraServicio_proveedorId_fkey"
FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompraServicio"
ADD CONSTRAINT "CompraServicio_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompraServicio"
ADD CONSTRAINT "CompraServicio_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
