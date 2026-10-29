CREATE TABLE "apertura_periodo_solicitudes" (
    "solicitudId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoPeriodo" NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "observaciones" TEXT,
    "categoria" "CategoriaPeriodo" NOT NULL DEFAULT 'ORDINARIO',
    "modoContable" "ModoContable" NOT NULL DEFAULT 'CAJA',
    "functionalCurrencyCode" TEXT NOT NULL,
    "lineas" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "solicitadaPor" TEXT NOT NULL,
    "aprobadaPor" TEXT,
    "hashAprobacion" TEXT,
    "aprobadaAt" TIMESTAMP(3),
    "consumidaAt" TIMESTAMP(3),
    "periodoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "apertura_periodo_solicitudes_pkey" PRIMARY KEY ("solicitudId")
);
CREATE UNIQUE INDEX "apertura_periodo_solicitudes_periodoId_key" ON "apertura_periodo_solicitudes"("periodoId");
CREATE INDEX "apertura_periodo_solicitudes_tenantId_estado_createdAt_idx" ON "apertura_periodo_solicitudes"("tenantId", "estado", "createdAt");
ALTER TABLE "apertura_periodo_solicitudes" ADD CONSTRAINT "apertura_periodo_solicitudes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- NULL means unknown/not classified. Do not represent unassigned manual balances as zero.
ALTER TABLE "apertura_periodos"
    ALTER COLUMN "saldoCajaInicial" DROP NOT NULL,
    ALTER COLUMN "saldoCajaInicial" DROP DEFAULT,
    ALTER COLUMN "saldoBancoInicial" DROP NOT NULL,
    ALTER COLUMN "saldoBancoInicial" DROP DEFAULT,
    ALTER COLUMN "saldoCuentasCobrarInicial" DROP NOT NULL,
    ALTER COLUMN "saldoCuentasCobrarInicial" DROP DEFAULT,
    ALTER COLUMN "saldoCuentasPagarInicial" DROP NOT NULL,
    ALTER COLUMN "saldoCuentasPagarInicial" DROP DEFAULT,
    ALTER COLUMN "saldoInventarioInicial" DROP NOT NULL,
    ALTER COLUMN "saldoInventarioInicial" DROP DEFAULT,
    ALTER COLUMN "saldoCapitalInicial" DROP NOT NULL,
    ALTER COLUMN "saldoCapitalInicial" DROP DEFAULT,
    ALTER COLUMN "saldoResultadoAcumInicial" DROP NOT NULL,
    ALTER COLUMN "saldoResultadoAcumInicial" DROP DEFAULT;
