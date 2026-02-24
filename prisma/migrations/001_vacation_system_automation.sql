-- Migración para sistema automático de vacaciones
-- Ejecutar este script en la base de datos para agregar los campos necesarios

-- Agregar campos nuevos a la tabla Empleado
ALTER TABLE "Empleado" 
ADD COLUMN "fechaContratacion" TIMESTAMP,
ADD COLUMN "esTiempoCompleto" BOOLEAN DEFAULT true,
ADD COLUMN "diasVacacionesAnuales" INTEGER DEFAULT 15;

-- Crear tabla para registro de acumulación de vacaciones
CREATE TABLE "VacationAccrual" (
  "accrualId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "periodo" TEXT NOT NULL,
  "diasAcumulados" INTEGER NOT NULL,
  "diasPorAntiguedad" INTEGER NOT NULL,
  "diasPorTiempoTrabajado" INTEGER NOT NULL,
  "tipoAcumulacion" TEXT NOT NULL,
  "fechaCalculo" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "procesado" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VacationAccrual_pkey" PRIMARY KEY ("accrualId")
);

-- Agregar foreign key constraint
ALTER TABLE "VacationAccrual" 
ADD CONSTRAINT "VacationAccrual_employeeId_fkey" 
FOREIGN KEY ("employeeId") REFERENCES "Empleado"("empleadoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Crear índices para mejorar performance
CREATE INDEX "VacationAccrual_employeeId_idx" ON "VacationAccrual"("employeeId");
CREATE INDEX "VacationAccrual_periodo_idx" ON "VacationAccrual"("periodo");
CREATE INDEX "VacationAccrual_procesado_idx" ON "VacationAccrual"("procesado");

-- Actualizar empleados existentes con fecha de contratación basada en createdAt
UPDATE "Empleado" 
SET "fechaContratacion" = "createdAt" 
WHERE "fechaContratacion" IS NULL;

-- Crear índices adicionales
CREATE INDEX "Empleado_fechaContratacion_idx" ON "Empleado"("fechaContratacion");