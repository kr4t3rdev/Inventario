-- Accounting movement report read index.
-- Lock risk: Prisma 6.19.1 executes migration SQL inside a transaction, which is
-- incompatible with CREATE INDEX CONCURRENTLY. This single non-concurrent index
-- may briefly block writes on the target table; apply during a low-traffic window.
CREATE INDEX IF NOT EXISTS "ReconciliacionGasto_tenantId_cuentaId_fechaReconciliacion_idx" ON "ReconciliacionGasto"("tenantId", "cuentaId", "fechaReconciliacion");
