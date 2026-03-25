-- CreateTable
CREATE TABLE "MiEmpresa" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombre" TEXT NOT NULL DEFAULT 'Mi Empresa',
    "propietario" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "carnetIdentidad" TEXT,
    "nit" TEXT,
    "licenciaOperacion" TEXT,
    "logoUrl" TEXT,
    "cuentaBancariaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MiEmpresa_cuentaBancariaId_key" ON "MiEmpresa"("cuentaBancariaId");

-- AddForeignKey
ALTER TABLE "MiEmpresa" ADD CONSTRAINT "MiEmpresa_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "CuentaBancaria"("cuentaId") ON DELETE SET NULL ON UPDATE CASCADE;
