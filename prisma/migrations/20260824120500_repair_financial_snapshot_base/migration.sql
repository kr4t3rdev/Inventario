-- Restore the accounting-period and snapshot tables that were already used by
-- later migrations but were missing from the historical migration chain.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoPeriodo') THEN
    CREATE TYPE "TipoPeriodo" AS ENUM ('DIARIO', 'MENSUAL', 'ANUAL', 'TRIMESTRAL', 'SEMESTRAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoPeriodo') THEN
    CREATE TYPE "EstadoPeriodo" AS ENUM ('BORRADOR', 'ABIERTO', 'EN_CIERRE', 'CERRADO', 'APROBADO', 'REABIERTO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventoAuditoria') THEN
    CREATE TYPE "EventoAuditoria" AS ENUM ('APERTURA', 'CIERRE', 'REAPERTURA', 'APROBACION', 'BLOQUEO', 'ERROR', 'INTENTO_BYPASS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ModoContable') THEN
    CREATE TYPE "ModoContable" AS ENUM ('CAJA', 'DEVENGO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CategoriaPeriodo') THEN
    CREATE TYPE "CategoriaPeriodo" AS ENUM ('ORDINARIO', 'EXTRAORDINARIO', 'RECTIFICATIVO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "periodos_contables" (
  "periodoId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "tipo" "TipoPeriodo" NOT NULL,
  "fechaInicio" TIMESTAMP(3) NOT NULL,
  "fechaFin" TIMESTAMP(3) NOT NULL,
  "estado" "EstadoPeriodo" NOT NULL DEFAULT 'BORRADOR',
  "motivoReapertura" TEXT,
  "cerradoPor" TEXT,
  "cerradoAt" TIMESTAMP(3),
  "aprobadoPor" TEXT,
  "aprobadoAt" TIMESTAMP(3),
  "observaciones" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "hashIntegridad" TEXT,
  "resumenJson" JSONB,
  "abiertoPorId" TEXT,
  "aperturaAutomatica" BOOLEAN NOT NULL DEFAULT false,
  "codigo" TEXT,
  "fechaApertura" TIMESTAMP(3),
  "fechaReapertura" TIMESTAMP(3),
  "periodoPadreId" TEXT,
  "reabiertoPorId" TEXT,
  "segundoAprobadorId" TEXT,
  "categoria" "CategoriaPeriodo" NOT NULL DEFAULT 'ORDINARIO',
  "modoContable" "ModoContable" NOT NULL DEFAULT 'CAJA',
  CONSTRAINT "periodos_contables_pkey" PRIMARY KEY ("periodoId")
);

CREATE TABLE IF NOT EXISTS "snapshot_periodos" (
  "snapshotId" TEXT NOT NULL,
  "periodoId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "baseCajaJson" JSONB,
  "baseDevengoJson" JSONB,
  "resumenJson" JSONB,
  "hashIntegridad" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "snapshot_periodos_pkey" PRIMARY KEY ("snapshotId")
);

CREATE TABLE IF NOT EXISTS "apertura_periodos" (
  "aperturaId" TEXT NOT NULL,
  "periodoId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "origenPeriodoId" TEXT,
  "saldoCajaInicial" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "saldoBancoInicial" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "saldoCuentasCobrarInicial" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "saldoCuentasPagarInicial" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "saldoInventarioInicial" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "saldoCapitalInicial" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "saldoResultadoAcumInicial" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "detalleJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "apertura_periodos_pkey" PRIMARY KEY ("aperturaId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "apertura_periodos_periodoId_key" ON "apertura_periodos"("periodoId");

CREATE TABLE IF NOT EXISTS "saldos_snapshot" (
  "snapshotId" TEXT NOT NULL,
  "periodoId" TEXT NOT NULL,
  "cuentaBancariaId" TEXT NOT NULL,
  "saldo" DOUBLE PRECISION NOT NULL,
  "moneda" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saldos_snapshot_pkey" PRIMARY KEY ("snapshotId")
);

CREATE TABLE IF NOT EXISTS "auditoria_periodos" (
  "auditoriaId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "periodoId" TEXT NOT NULL,
  "evento" "EventoAuditoria" NOT NULL,
  "actor" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "entidadAfectada" TEXT,
  "motivo" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auditoria_periodos_pkey" PRIMARY KEY ("auditoriaId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "periodos_contables_tenantId_codigo_key"
  ON "periodos_contables"("tenantId", "codigo");
CREATE INDEX IF NOT EXISTS "periodos_contables_tenantId_estado_idx"
  ON "periodos_contables"("tenantId", "estado");
CREATE INDEX IF NOT EXISTS "periodos_contables_tenantId_periodoPadreId_idx"
  ON "periodos_contables"("tenantId", "periodoPadreId");
CREATE UNIQUE INDEX IF NOT EXISTS "snapshot_periodos_periodoId_version_key"
  ON "snapshot_periodos"("periodoId", "version");
CREATE INDEX IF NOT EXISTS "snapshot_periodos_periodoId_createdAt_idx"
  ON "snapshot_periodos"("periodoId", "createdAt");
CREATE INDEX IF NOT EXISTS "saldos_snapshot_periodoId_idx" ON "saldos_snapshot"("periodoId");
CREATE INDEX IF NOT EXISTS "saldos_snapshot_cuentaBancariaId_idx" ON "saldos_snapshot"("cuentaBancariaId");
CREATE INDEX IF NOT EXISTS "auditoria_periodos_periodoId_idx" ON "auditoria_periodos"("periodoId");
CREATE INDEX IF NOT EXISTS "auditoria_periodos_tenantId_timestamp_idx"
  ON "auditoria_periodos"("tenantId", "timestamp");
CREATE INDEX IF NOT EXISTS "auditoria_periodos_evento_idx" ON "auditoria_periodos"("evento");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'periodos_contables_tenantId_fkey') THEN
    ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'periodos_contables_periodoPadreId_fkey') THEN
    ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_periodoPadreId_fkey"
      FOREIGN KEY ("periodoPadreId") REFERENCES "periodos_contables"("periodoId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'snapshot_periodos_periodoId_fkey') THEN
    ALTER TABLE "snapshot_periodos" ADD CONSTRAINT "snapshot_periodos_periodoId_fkey"
      FOREIGN KEY ("periodoId") REFERENCES "periodos_contables"("periodoId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'apertura_periodos_periodoId_fkey') THEN
    ALTER TABLE "apertura_periodos" ADD CONSTRAINT "apertura_periodos_periodoId_fkey"
      FOREIGN KEY ("periodoId") REFERENCES "periodos_contables"("periodoId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'apertura_periodos_tenantId_fkey') THEN
    ALTER TABLE "apertura_periodos" ADD CONSTRAINT "apertura_periodos_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saldos_snapshot_periodoId_fkey') THEN
    ALTER TABLE "saldos_snapshot" ADD CONSTRAINT "saldos_snapshot_periodoId_fkey"
      FOREIGN KEY ("periodoId") REFERENCES "periodos_contables"("periodoId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auditoria_periodos_periodoId_fkey') THEN
    ALTER TABLE "auditoria_periodos" ADD CONSTRAINT "auditoria_periodos_periodoId_fkey"
      FOREIGN KEY ("periodoId") REFERENCES "periodos_contables"("periodoId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auditoria_periodos_tenantId_fkey') THEN
    ALTER TABLE "auditoria_periodos" ADD CONSTRAINT "auditoria_periodos_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
