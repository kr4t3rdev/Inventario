ALTER TABLE "apertura_periodo_solicitudes" ADD COLUMN "cuentasBancarias" JSONB;
ALTER TABLE "CuentaBancaria" ADD COLUMN "cuentaContableInicialId" TEXT;
ALTER TABLE "CuentaBancaria" ADD CONSTRAINT "CuentaBancaria_apertura_cuenta_fkey" FOREIGN KEY ("tenantId", "cuentaContableInicialId") REFERENCES "cuentas_contables" ("tenantId", "cuentaContableId") ON DELETE RESTRICT ON UPDATE CASCADE;
