-- AS-05 ola 2: denormalización de tenantId en modelos de auditoría/reportes.
-- Aditiva y reversible: columnas nullable + índices. Estos modelos no tienen
-- escritores ni lectores en el código actual (tablas inactivas); el backfill
-- (scripts/backfill/dead-audit-models-tenant.ts) solo cuenta filas y las
-- clasifica como huérfanas porque no existe vínculo resoluble al tenant:
-- creadoPor/generadoPor son userId (un usuario puede pertenecer a varios
-- tenants) y entidadTipo/entidadId es polimórfico sin writers que lo pueblen.
-- Las filas históricas quedan con tenantId NULL por diseño (fail-closed: no se
-- exponen bajo enforcement). NOT NULL solo si algún día el 100% es resoluble
-- y existen writers con escritura dual desde el contexto.

ALTER TABLE "AlertHistory"
  ADD COLUMN "tenantId" TEXT;

CREATE INDEX "AlertHistory_tenantId_idx"
  ON "AlertHistory"("tenantId");

ALTER TABLE "ReportHistory"
  ADD COLUMN "tenantId" TEXT;

CREATE INDEX "ReportHistory_tenantId_idx"
  ON "ReportHistory"("tenantId");

ALTER TABLE "ScheduledReport"
  ADD COLUMN "tenantId" TEXT;

CREATE INDEX "ScheduledReport_tenantId_idx"
  ON "ScheduledReport"("tenantId");

ALTER TABLE "ScenarioSimulation"
  ADD COLUMN "tenantId" TEXT;

CREATE INDEX "ScenarioSimulation_tenantId_idx"
  ON "ScenarioSimulation"("tenantId");
