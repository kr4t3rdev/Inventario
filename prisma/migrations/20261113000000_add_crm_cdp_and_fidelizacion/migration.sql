-- ============================================================================
-- Migration: Add CRM CDP and Fidelización modules
-- Date: 2026-11-13
-- Description: Adds 19 new models for CRM, Loyalty, Coupons, Analytics,
--              and Automation. Enriches Cliente model with CDP fields.
-- ============================================================================

-- ============================================================================
-- 1. Enrich Cliente model with CDP fields
-- ============================================================================

ALTER TABLE "Cliente" ADD COLUMN "email" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "emailSecondary" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "telefonoSecondary" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "fechaNacimiento" TIMESTAMP(3);
ALTER TABLE "Cliente" ADD COLUMN "genero" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "preferenciasComunicacion" JSONB;
ALTER TABLE "Cliente" ADD COLUMN "consentimientos" JSONB;
ALTER TABLE "Cliente" ADD COLUMN "segmento" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "tags" JSONB;
ALTER TABLE "Cliente" ADD COLUMN "canalPreferido" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "ultimaCompra" TIMESTAMP(3);
ALTER TABLE "Cliente" ADD COLUMN "totalComprado" INTEGER;
ALTER TABLE "Cliente" ADD COLUMN "cantidadCompras" INTEGER;
ALTER TABLE "Cliente" ADD COLUMN "clv" DOUBLE PRECISION;
ALTER TABLE "Cliente" ADD COLUMN "metadata" JSONB;

-- Unique constraint on email
CREATE UNIQUE INDEX "Cliente_email_key" ON "Cliente"("email");
CREATE INDEX "Cliente_email_idx" ON "Cliente"("email");
CREATE INDEX "Cliente_segmento_idx" ON "Cliente"("segmento");
CREATE INDEX "Cliente_ultimaCompra_idx" ON "Cliente"("ultimaCompra");
CREATE INDEX "Cliente_tenantId_segmento_idx" ON "Cliente"("tenantId", "segmento");

-- ============================================================================
-- 2. CRM: Segmentación
-- ============================================================================

CREATE TABLE "SegmentoCliente" (
    "segmentoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "reglas" JSONB NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "clientesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SegmentoCliente_pkey" PRIMARY KEY ("segmentoId")
);

CREATE TABLE "ClienteSegmento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "segmentoId" TEXT NOT NULL,
    "asignadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asignadoPor" TEXT NOT NULL,
    CONSTRAINT "ClienteSegmento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClienteDuplicado" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientePrincipal" TEXT NOT NULL,
    "clientesFusionados" TEXT[],
    "criteriosMatch" JSONB NOT NULL,
    "resueltoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoPor" TEXT,
    CONSTRAINT "ClienteDuplicado_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SegmentoCliente_tenantId_activo_idx" ON "SegmentoCliente"("tenantId", "activo");
CREATE UNIQUE INDEX "ClienteSegmento_clienteId_segmentoId_key" ON "ClienteSegmento"("clienteId", "segmentoId");
CREATE INDEX "ClienteSegmento_tenantId_segmentoId_idx" ON "ClienteSegmento"("tenantId", "segmentoId");
CREATE INDEX "ClienteDuplicado_tenantId_idx" ON "ClienteDuplicado"("tenantId");

-- ============================================================================
-- 3. Loyalty Engine
-- ============================================================================

CREATE TABLE "ProgramaLealtad" (
    "programaId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "puntosPorPeso" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "puntosMinimos" INTEGER NOT NULL DEFAULT 1000,
    "valorCanje" INTEGER NOT NULL DEFAULT 100,
    "reglas" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgramaLealtad_pkey" PRIMARY KEY ("programaId")
);

CREATE TABLE "TierLealtad" (
    "tierId" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "umbralGasto" INTEGER NOT NULL,
    "umbralFrecuencia" INTEGER,
    "beneficios" JSONB NOT NULL,
    "color" TEXT,
    "icono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "TierLealtad_pkey" PRIMARY KEY ("tierId")
);

CREATE TABLE "HistorialPuntos" (
    "historialId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "puntos" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "referenciaId" TEXT,
    "saldoAcumulado" INTEGER NOT NULL,
    "idempotenciaKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistorialPuntos_pkey" PRIMARY KEY ("historialId")
);

CREATE TABLE "ClienteLealtad" (
    "clienteLealtadId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "tierId" TEXT,
    "saldoPuntos" INTEGER NOT NULL DEFAULT 0,
    "puntosGanados" INTEGER NOT NULL DEFAULT 0,
    "puntosCanjeados" INTEGER NOT NULL DEFAULT 0,
    "puntosExpirados" INTEGER NOT NULL DEFAULT 0,
    "tierActual" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClienteLealtad_pkey" PRIMARY KEY ("clienteLealtadId")
);

CREATE TABLE "MisionLealtad" (
    "misionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "reglas" JSONB NOT NULL,
    "recompensaPuntos" INTEGER NOT NULL,
    "validoDesde" TIMESTAMP(3) NOT NULL,
    "validoHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vecesMaximo" INTEGER,
    CONSTRAINT "MisionLealtad_pkey" PRIMARY KEY ("misionId")
);

CREATE TABLE "ProgresoMision" (
    "progresoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "misionId" TEXT NOT NULL,
    "progreso" INTEGER NOT NULL DEFAULT 0,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "completadoEn" TIMESTAMP(3),
    CONSTRAINT "ProgresoMision_pkey" PRIMARY KEY ("progresoId")
);

CREATE TABLE "ReferidoLealtad" (
    "referidoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigoReferral" TEXT NOT NULL,
    "refirienteId" TEXT NOT NULL,
    "referidoClienteId" TEXT,
    "estado" TEXT NOT NULL,
    "incentivoRefiriente" INTEGER NOT NULL,
    "incentivoReferido" INTEGER NOT NULL,
    "puntosRefiriente" BOOLEAN NOT NULL DEFAULT false,
    "puntosReferido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferidoLealtad_pkey" PRIMARY KEY ("referidoId")
);

CREATE UNIQUE INDEX "ProgramaLealtad_tenantId_nombre_key" ON "ProgramaLealtad"("tenantId", "nombre");
CREATE INDEX "ProgramaLealtad_tenantId_activo_idx" ON "ProgramaLealtad"("tenantId", "activo");
CREATE UNIQUE INDEX "TierLealtad_programaId_nombre_key" ON "TierLealtad"("programaId", "nombre");
CREATE INDEX "TierLealtad_programaId_orden_idx" ON "TierLealtad"("programaId", "orden");
CREATE UNIQUE INDEX "HistorialPuntos_tenantId_idempotenciaKey_key" ON "HistorialPuntos"("tenantId", "idempotenciaKey");
CREATE INDEX "HistorialPuntos_tenantId_clienteId_idx" ON "HistorialPuntos"("tenantId", "clienteId");
CREATE INDEX "HistorialPuntos_programaId_idx" ON "HistorialPuntos"("programaId");
CREATE UNIQUE INDEX "ClienteLealtad_clienteId_key" ON "ClienteLealtad"("clienteId");
CREATE INDEX "ClienteLealtad_tenantId_idx" ON "ClienteLealtad"("tenantId");
CREATE INDEX "MisionLealtad_tenantId_activo_idx" ON "MisionLealtad"("tenantId", "activo");
CREATE UNIQUE INDEX "ProgresoMision_clienteId_misionId_key" ON "ProgresoMision"("clienteId", "misionId");
CREATE INDEX "ProgresoMision_tenantId_clienteId_idx" ON "ProgresoMision"("tenantId", "clienteId");
CREATE UNIQUE INDEX "ReferidoLealtad_tenantId_codigoReferral_key" ON "ReferidoLealtad"("tenantId", "codigoReferral");
CREATE UNIQUE INDEX "ReferidoLealtad_referidoClienteId_key" ON "ReferidoLealtad"("referidoClienteId");
CREATE INDEX "ReferidoLealtad_tenantId_refirienteId_idx" ON "ReferidoLealtad"("tenantId", "refirienteId");

-- ============================================================================
-- 4. Cupones y Promociones
-- ============================================================================

CREATE TABLE "Cupon" (
    "cuponId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "descripcion" TEXT,
    "usoMinimo" INTEGER,
    "usoMaximo" INTEGER,
    "vecesMaximo" INTEGER,
    "vecesPorCliente" INTEGER,
    "validoDesde" TIMESTAMP(3) NOT NULL,
    "validoHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "aplicableA" TEXT,
    "filtros" JSONB,
    "canalAplicacion" TEXT,
    "segmentoTarget" TEXT,
    "canalTarget" TEXT,
    "vecesUsado" INTEGER NOT NULL DEFAULT 0,
    "tasaRedencion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impactoAov" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cupon_pkey" PRIMARY KEY ("cuponId")
);

CREATE TABLE "CuponUso" (
    "usoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cuponId" TEXT NOT NULL,
    "clienteId" TEXT,
    "ventaId" TEXT NOT NULL,
    "descuentoAplicado" INTEGER NOT NULL,
    "canal" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CuponUso_pkey" PRIMARY KEY ("usoId")
);

CREATE TABLE "CuponABTest" (
    "abTestId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuponId" TEXT NOT NULL,
    "variante" TEXT NOT NULL,
    "segmentoTarget" TEXT,
    "enviadoA" INTEGER NOT NULL DEFAULT 0,
    "redimidoPor" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CuponABTest_pkey" PRIMARY KEY ("abTestId")
);

CREATE UNIQUE INDEX "Cupon_tenantId_codigo_key" ON "Cupon"("tenantId", "codigo");
CREATE INDEX "Cupon_tenantId_activo_idx" ON "Cupon"("tenantId", "activo");
CREATE INDEX "Cupon_tenantId_segmentoTarget_idx" ON "Cupon"("tenantId", "segmentoTarget");
CREATE INDEX "CuponUso_tenantId_cuponId_idx" ON "CuponUso"("tenantId", "cuponId");
CREATE INDEX "CuponUso_clienteId_idx" ON "CuponUso"("clienteId");
CREATE INDEX "CuponABTest_tenantId_activo_idx" ON "CuponABTest"("tenantId", "activo");

-- ============================================================================
-- 5. Analytics de Comportamiento
-- ============================================================================

CREATE TABLE "ClienteAnalytics" (
    "analyticsId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "ultimaCompra" TIMESTAMP(3),
    "diasDesdeUltima" INTEGER,
    "totalCompras" INTEGER NOT NULL DEFAULT 0,
    "totalGastado" INTEGER NOT NULL DEFAULT 0,
    "ticketPromedio" INTEGER,
    "segmentoRfm" TEXT,
    "scoreLealtad" INTEGER,
    "clv" DOUBLE PRECISION,
    "clvProyectado" DOUBLE PRECISION,
    "categoriasFrecuentes" JSONB,
    "productosFrecuentes" JSONB,
    "canalPreferido" TEXT,
    "probabilidadChurn" DOUBLE PRECISION,
    "senalesChurn" JSONB,
    "cohorteAdquisicion" TEXT,
    "diasHastaSegunda" INTEGER,
    "repeatPurchaseRate" DOUBLE PRECISION,
    "redemptionRate" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClienteAnalytics_pkey" PRIMARY KEY ("analyticsId")
);

CREATE TABLE "BasketAnalysis" (
    "basketId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoA" TEXT NOT NULL,
    "productoB" TEXT NOT NULL,
    "coocurrencias" INTEGER NOT NULL DEFAULT 0,
    "soporte" DOUBLE PRECISION NOT NULL,
    "confianza" DOUBLE PRECISION NOT NULL,
    "levantamiento" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BasketAnalysis_pkey" PRIMARY KEY ("basketId")
);

CREATE TABLE "CohorteAnalytics" (
    "cohorteId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "canalAdquisicion" TEXT,
    "totalClientes" INTEGER NOT NULL DEFAULT 0,
    "retencionMes1" DOUBLE PRECISION,
    "retencionMes2" DOUBLE PRECISION,
    "retencionMes3" DOUBLE PRECISION,
    "ltvPromedio" DOUBLE PRECISION,
    "aovPromedio" DOUBLE PRECISION,
    "diasHastaSegunda" DOUBLE PRECISION,
    "churnRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CohorteAnalytics_pkey" PRIMARY KEY ("cohorteId")
);

CREATE UNIQUE INDEX "ClienteAnalytics_clienteId_key" ON "ClienteAnalytics"("clienteId");
CREATE INDEX "ClienteAnalytics_tenantId_idx" ON "ClienteAnalytics"("tenantId");
CREATE INDEX "ClienteAnalytics_segmentoRfm_idx" ON "ClienteAnalytics"("segmentoRfm");
CREATE INDEX "ClienteAnalytics_cohorteAdquisicion_idx" ON "ClienteAnalytics"("cohorteAdquisicion");
CREATE UNIQUE INDEX "BasketAnalysis_tenantId_productoA_productoB_key" ON "BasketAnalysis"("tenantId", "productoA", "productoB");
CREATE INDEX "BasketAnalysis_tenantId_idx" ON "BasketAnalysis"("tenantId");
CREATE UNIQUE INDEX "CohorteAnalytics_tenantId_periodo_canalAdquisicion_key" ON "CohorteAnalytics"("tenantId", "periodo", "canalAdquisicion");
CREATE INDEX "CohorteAnalytics_tenantId_idx" ON "CohorteAnalytics"("tenantId");

-- ============================================================================
-- 6. Automatización y Triggers
-- ============================================================================

CREATE TABLE "TriggerAutomatizacion" (
    "triggerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "condiciones" JSONB NOT NULL,
    "accion" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "canal" TEXT NOT NULL,
    "delayMinutos" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vecesMaximo" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TriggerAutomatizacion_pkey" PRIMARY KEY ("triggerId")
);

CREATE TABLE "TriggerEjecucion" (
    "ejecucionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "eventoData" JSONB NOT NULL,
    "estado" TEXT NOT NULL,
    "enviadoEn" TIMESTAMP(3),
    "error" TEXT,
    CONSTRAINT "TriggerEjecucion_pkey" PRIMARY KEY ("ejecucionId")
);

CREATE TABLE "WebhookLealtad" (
    "webhookId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "eventos" TEXT[],
    "secreto" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoEstado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebhookLealtad_pkey" PRIMARY KEY ("webhookId")
);

CREATE INDEX "TriggerAutomatizacion_tenantId_activo_idx" ON "TriggerAutomatizacion"("tenantId", "activo");
CREATE INDEX "TriggerEjecucion_tenantId_triggerId_idx" ON "TriggerEjecucion"("tenantId", "triggerId");
CREATE INDEX "TriggerEjecucion_clienteId_idx" ON "TriggerEjecucion"("clienteId");
CREATE INDEX "WebhookLealtad_tenantId_activo_idx" ON "WebhookLealtad"("tenantId", "activo");

-- ============================================================================
-- 7. Foreign Keys
-- ============================================================================

ALTER TABLE "SegmentoCliente" ADD CONSTRAINT "SegmentoCliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClienteSegmento" ADD CONSTRAINT "ClienteSegmento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClienteSegmento" ADD CONSTRAINT "ClienteSegmento_segmentoId_fkey" FOREIGN KEY ("segmentoId") REFERENCES "SegmentoCliente"("segmentoId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClienteDuplicado" ADD CONSTRAINT "ClienteDuplicado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgramaLealtad" ADD CONSTRAINT "ProgramaLealtad_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TierLealtad" ADD CONSTRAINT "TierLealtad_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ProgramaLealtad"("programaId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistorialPuntos" ADD CONSTRAINT "HistorialPuntos_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ProgramaLealtad"("programaId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClienteLealtad" ADD CONSTRAINT "ClienteLealtad_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClienteLealtad" ADD CONSTRAINT "ClienteLealtad_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ProgramaLealtad"("programaId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClienteLealtad" ADD CONSTRAINT "ClienteLealtad_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "TierLealtad"("tierId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MisionLealtad" ADD CONSTRAINT "MisionLealtad_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ProgramaLealtad"("programaId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgresoMision" ADD CONSTRAINT "ProgresoMision_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgresoMision" ADD CONSTRAINT "ProgresoMision_misionId_fkey" FOREIGN KEY ("misionId") REFERENCES "MisionLealtad"("misionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferidoLealtad" ADD CONSTRAINT "ReferidoLealtad_refirienteId_fkey" FOREIGN KEY ("refirienteId") REFERENCES "Cliente"("clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferidoLealtad" ADD CONSTRAINT "ReferidoLealtad_referidoClienteId_fkey" FOREIGN KEY ("referidoClienteId") REFERENCES "Cliente"("clienteId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Cupon" ADD CONSTRAINT "Cupon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuponUso" ADD CONSTRAINT "CuponUso_cuponId_fkey" FOREIGN KEY ("cuponId") REFERENCES "Cupon"("cuponId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuponABTest" ADD CONSTRAINT "CuponABTest_cuponId_fkey" FOREIGN KEY ("cuponId") REFERENCES "Cupon"("cuponId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClienteAnalytics" ADD CONSTRAINT "ClienteAnalytics_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClienteAnalytics" ADD CONSTRAINT "ClienteAnalytics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BasketAnalysis" ADD CONSTRAINT "BasketAnalysis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CohorteAnalytics" ADD CONSTRAINT "CohorteAnalytics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TriggerAutomatizacion" ADD CONSTRAINT "TriggerAutomatizacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TriggerEjecucion" ADD CONSTRAINT "TriggerEjecucion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TriggerEjecucion" ADD CONSTRAINT "TriggerEjecucion_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "TriggerAutomatizacion"("triggerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookLealtad" ADD CONSTRAINT "WebhookLealtad_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 8. Add relations to Tenant model (already exists, just document)
-- ============================================================================
-- The following relations are added to the Tenant model in schema.prisma:
-- segmentosCliente, clientesDuplicados, programasLealtad, cupones,
-- clienteAnalytics, basketAnalyses, cohortesAnalytics,
-- triggersAutomatizacion, webhooksLealtad

