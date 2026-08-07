-- DropTable: sistema de licencias legacy pre-multi-tenant (modelos Licencia y LicenciaAudit).
-- Ningún otro modelo referencia estas tablas. LicenciaAudit referencia a Licencia,
-- por lo que se elimina primero. DROP TABLE remueve también sus índices y constraints.

DROP TABLE "LicenciaAudit";
DROP TABLE "Licencia";
