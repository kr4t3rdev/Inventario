-- The formal ledger models existed in Prisma but had no migration baseline.
BEGIN;
-- Create the missing core only when absent so fresh CI and already-provisioned
-- installations converge without replacing tenant accounting data.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoCuentaContable' AND typnamespace = current_schema()::regnamespace) THEN
        CREATE TYPE "TipoCuentaContable" AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'COSTO', 'GASTO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NaturalezaCuenta' AND typnamespace = current_schema()::regnamespace) THEN
        CREATE TYPE "NaturalezaCuenta" AS ENUM ('DEUDORA', 'ACREEDORA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoDiario' AND typnamespace = current_schema()::regnamespace) THEN
        CREATE TYPE "TipoDiario" AS ENUM ('VENTAS', 'COMPRAS', 'CAJA', 'BANCOS', 'NOMINA', 'AJUSTES', 'APERTURA_CIERRE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoAsiento' AND typnamespace = current_schema()::regnamespace) THEN
        CREATE TYPE "EstadoAsiento" AS ENUM ('CONTABILIZADO', 'ANULADO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LadoAsiento' AND typnamespace = current_schema()::regnamespace) THEN
        CREATE TYPE "LadoAsiento" AS ENUM ('DEBE', 'HABER');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReglaMontoEvento' AND typnamespace = current_schema()::regnamespace) THEN
        CREATE TYPE "ReglaMontoEvento" AS ENUM ('TOTAL', 'MONTO_PAGADO', 'COSTO_FIFO', 'INTERESES', 'TOTAL_MENOS_INTERESES', 'DIFERENCIA_FX', 'TOTAL_MENOS_DIFERENCIA', 'TOTAL_MAS_DIFERENCIA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RolCuenta' AND typnamespace = current_schema()::regnamespace) THEN
        CREATE TYPE "RolCuenta" AS ENUM ('CAJA_PRINCIPAL', 'BANCOS', 'INVENTARIOS', 'CXC_CLIENTES', 'ANTICIPOS_CLIENTES', 'PRESTAMOS_OTORGADOS', 'CXP_PROVEEDORES', 'ANTICIPOS_PROVEEDORES', 'DEUDAS_RECIBIDAS', 'CAPITAL_SOCIAL', 'RESULTADOS_ACUMULADOS', 'RESULTADO_PERIODO', 'VENTAS_PRODUCTOS', 'VENTAS_SERVICIOS', 'OTROS_INGRESOS', 'INTERESES_GANADOS', 'DIFERENCIA_CAMBIARIA_INGRESO', 'COSTO_VENTAS', 'GASTOS_OPERATIVOS', 'GASTOS_NOMINA', 'GASTOS_FINANCIEROS', 'MERMAS', 'DIFERENCIA_CAMBIARIA_GASTO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEventoContable' AND typnamespace = current_schema()::regnamespace) THEN
        CREATE TYPE "TipoEventoContable" AS ENUM ('VENTA_SERVICIO_CREDITO', 'VENTA_CONTADO', 'VENTA_CREDITO', 'COBRO_CXC', 'COSTO_VENTA_DEVENGADO', 'DEVOLUCION_VENTA', 'VENTA_SERVICIO', 'COBRO_SERVICIO', 'COMPRA_CONTADO', 'COMPRA_CREDITO', 'PAGO_CXP', 'GASTO_CONTADO', 'GASTO_CREDITO', 'PAGO_GASTO_CREDITO', 'PAGO_NOMINA', 'ANTICIPO_CLIENTE_RECIBIDO', 'ANTICIPO_CLIENTE_APLICADO', 'ANTICIPO_PROVEEDOR_ENTREGADO', 'ANTICIPO_PROVEEDOR_APLICADO', 'PRESTAMO_OTORGADO', 'COBRO_PRESTAMO', 'DEUDA_RECIBIDA', 'PAGO_DEUDA', 'AJUSTE_BANCARIO_CARGO', 'AJUSTE_BANCARIO_ABONO', 'TRANSFERENCIA_BANCARIA', 'INYECCION_CAPITAL', 'PAGO_DEUDA_CAPITAL', 'MERMA_INVENTARIO', 'PRODUCCION_SALIDA', 'GASTO_CON_ANTICIPO_PROVEEDOR', 'DIFERENCIA_CAMBIARIA', 'APERTURA_PERIODO', 'CIERRE_PERIODO');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "cuentas_contables" (
    "cuentaContableId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuentaContable" NOT NULL,
    "naturaleza" "NaturalezaCuenta" NOT NULL,
    "padreId" TEXT,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "aceptaMovimiento" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "esDeSistema" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cuentas_contables_pkey" PRIMARY KEY ("cuentaContableId")
);

CREATE TABLE IF NOT EXISTS "diarios_contables" (
    "diarioId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoDiario" NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diarios_contables_pkey" PRIMARY KEY ("diarioId")
);

CREATE TABLE IF NOT EXISTS "asientos" (
    "asientoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "diarioId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoAsiento" NOT NULL DEFAULT 'CONTABILIZADO',
    "origenTipo" TEXT NOT NULL,
    "origenId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "hashAnterior" TEXT,
    "revertidoPorId" TEXT,
    "observaciones" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "asientos_pkey" PRIMARY KEY ("asientoId")
);

CREATE TABLE IF NOT EXISTS "asiento_lineas" (
    "lineaId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "asientoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "debe" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "haber" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "monedaOriginal" TEXT NOT NULL,
    "montoOriginal" DECIMAL(20,4) NOT NULL,
    "tasaCambio" DECIMAL(20,10),
    "fxEvidenceFingerprint" TEXT,
    "referencia" TEXT,
    CONSTRAINT "asiento_lineas_pkey" PRIMARY KEY ("lineaId")
);

CREATE TABLE IF NOT EXISTS "plantillas_asiento" (
    "plantillaId" TEXT NOT NULL,
    "evento" "TipoEventoContable" NOT NULL,
    "orden" INTEGER NOT NULL,
    "lado" "LadoAsiento" NOT NULL,
    "rolCuenta" "RolCuenta" NOT NULL,
    "montoRegla" "ReglaMontoEvento" NOT NULL,
    "condicion" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "plantillas_asiento_pkey" PRIMARY KEY ("plantillaId")
);

CREATE TABLE IF NOT EXISTS "cuentas_roles_tenant" (
    "cuentaRolId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rol" "RolCuenta" NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cuentas_roles_tenant_pkey" PRIMARY KEY ("cuentaRolId")
);

CREATE INDEX IF NOT EXISTS "cuentas_contables_tenantId_tipo_activa_idx" ON "cuentas_contables"("tenantId", "tipo", "activa");
CREATE INDEX IF NOT EXISTS "cuentas_contables_tenantId_padreId_idx" ON "cuentas_contables"("tenantId", "padreId");
CREATE UNIQUE INDEX IF NOT EXISTS "cuentas_contables_tenantId_codigo_key" ON "cuentas_contables"("tenantId", "codigo");
CREATE UNIQUE INDEX IF NOT EXISTS "cuentas_contables_tenantId_cuentaContableId_key" ON "cuentas_contables"("tenantId", "cuentaContableId");
CREATE INDEX IF NOT EXISTS "diarios_contables_tenantId_tipo_idx" ON "diarios_contables"("tenantId", "tipo");
CREATE UNIQUE INDEX IF NOT EXISTS "diarios_contables_tenantId_codigo_key" ON "diarios_contables"("tenantId", "codigo");
CREATE UNIQUE INDEX IF NOT EXISTS "diarios_contables_tenantId_diarioId_key" ON "diarios_contables"("tenantId", "diarioId");
CREATE INDEX IF NOT EXISTS "asientos_tenantId_fecha_idx" ON "asientos"("tenantId", "fecha");
CREATE INDEX IF NOT EXISTS "asientos_tenantId_periodoId_idx" ON "asientos"("tenantId", "periodoId");
CREATE INDEX IF NOT EXISTS "asientos_tenantId_hash_idx" ON "asientos"("tenantId", "hash");
CREATE UNIQUE INDEX IF NOT EXISTS "asientos_tenantId_asientoId_key" ON "asientos"("tenantId", "asientoId");
CREATE UNIQUE INDEX IF NOT EXISTS "asientos_tenantId_origenTipo_origenId_key" ON "asientos"("tenantId", "origenTipo", "origenId");
CREATE UNIQUE INDEX IF NOT EXISTS "asientos_diarioId_periodoId_numero_key" ON "asientos"("diarioId", "periodoId", "numero");
CREATE INDEX IF NOT EXISTS "asiento_lineas_asientoId_orden_idx" ON "asiento_lineas"("asientoId", "orden");
CREATE INDEX IF NOT EXISTS "asiento_lineas_tenantId_asientoId_orden_idx" ON "asiento_lineas"("tenantId", "asientoId", "orden");
CREATE INDEX IF NOT EXISTS "asiento_lineas_cuentaId_idx" ON "asiento_lineas"("cuentaId");
CREATE INDEX IF NOT EXISTS "asiento_lineas_tenantId_cuentaId_idx" ON "asiento_lineas"("tenantId", "cuentaId");
CREATE UNIQUE INDEX IF NOT EXISTS "plantillas_asiento_evento_orden_version_key" ON "plantillas_asiento"("evento", "orden", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "cuentas_roles_tenant_tenantId_rol_key" ON "cuentas_roles_tenant"("tenantId", "rol");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_contables_padreId_fkey' AND conrelid = 'cuentas_contables'::regclass) THEN
        ALTER TABLE "cuentas_contables" ADD CONSTRAINT "cuentas_contables_padreId_fkey" FOREIGN KEY ("tenantId", "padreId") REFERENCES "cuentas_contables"("tenantId", "cuentaContableId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_contables_tenantId_fkey' AND conrelid = 'cuentas_contables'::regclass) THEN
        ALTER TABLE "cuentas_contables" ADD CONSTRAINT "cuentas_contables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diarios_contables_tenantId_fkey' AND conrelid = 'diarios_contables'::regclass) THEN
        ALTER TABLE "diarios_contables" ADD CONSTRAINT "diarios_contables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asientos_tenant_diario_fkey' AND conrelid = 'asientos'::regclass) THEN
        ALTER TABLE "asientos" ADD CONSTRAINT "asientos_tenant_diario_fkey" FOREIGN KEY ("tenantId", "diarioId") REFERENCES "diarios_contables"("tenantId", "diarioId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asientos_periodoId_fkey' AND conrelid = 'asientos'::regclass) THEN
        ALTER TABLE "asientos" ADD CONSTRAINT "asientos_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos_contables"("periodoId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asientos_tenantId_fkey' AND conrelid = 'asientos'::regclass) THEN
        ALTER TABLE "asientos" ADD CONSTRAINT "asientos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asiento_lineas_tenant_asiento_fkey' AND conrelid = 'asiento_lineas'::regclass) THEN
        ALTER TABLE "asiento_lineas" ADD CONSTRAINT "asiento_lineas_tenant_asiento_fkey" FOREIGN KEY ("tenantId", "asientoId") REFERENCES "asientos"("tenantId", "asientoId") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asiento_lineas_tenant_cuenta_fkey' AND conrelid = 'asiento_lineas'::regclass) THEN
        ALTER TABLE "asiento_lineas" ADD CONSTRAINT "asiento_lineas_tenant_cuenta_fkey" FOREIGN KEY ("tenantId", "cuentaId") REFERENCES "cuentas_contables"("tenantId", "cuentaContableId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_roles_tenant_tenant_cuenta_fkey' AND conrelid = 'cuentas_roles_tenant'::regclass) THEN
        ALTER TABLE "cuentas_roles_tenant" ADD CONSTRAINT "cuentas_roles_tenant_tenant_cuenta_fkey" FOREIGN KEY ("tenantId", "cuentaId") REFERENCES "cuentas_contables"("tenantId", "cuentaContableId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_roles_tenant_tenantId_fkey' AND conrelid = 'cuentas_roles_tenant'::regclass) THEN
        ALTER TABLE "cuentas_roles_tenant" ADD CONSTRAINT "cuentas_roles_tenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Required shadow evidence table from the source migration subset. Shadow mode
-- remains disabled by default and this migration does not activate it.
CREATE TABLE "shadow_posteo_outbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipoEvento" TEXT NOT NULL,
    "origenTipo" TEXT NOT NULL,
    "origenId" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "causa" TEXT,
    "duracionMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregadoAt" TIMESTAMP(3),
    CONSTRAINT "shadow_posteo_outbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "shadow_posteo_outbox_entregadoAt_createdAt_idx"
    ON "shadow_posteo_outbox"("entregadoAt", "createdAt");
CREATE INDEX "shadow_posteo_outbox_tenantId_tipoEvento_estado_idx"
    ON "shadow_posteo_outbox"("tenantId", "tipoEvento", "estado");
CREATE UNIQUE INDEX "shadow_posteo_outbox_tenantId_tipoEvento_origenTipo_origenI_key"
    ON "shadow_posteo_outbox"("tenantId", "tipoEvento", "origenTipo", "origenId");
ALTER TABLE "shadow_posteo_outbox"
    ADD CONSTRAINT "shadow_posteo_outbox_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hash v2 is append-only metadata. Existing rows remain unclassified; no
-- historical hash or ordering is derived from timestamps or backfilled here.
ALTER TABLE "asientos" ADD COLUMN "hashVersion" TEXT;
ALTER TABLE "asientos" ADD COLUMN "tenantSequence" BIGINT;
CREATE UNIQUE INDEX "asientos_tenantId_tenantSequence_key"
    ON "asientos"("tenantId", "tenantSequence");

-- The formal posting must not attach an asiento to another tenant's period.
CREATE UNIQUE INDEX "periodos_contables_tenantId_periodoId_key"
    ON "periodos_contables"("tenantId", "periodoId");
ALTER TABLE "asientos" DROP CONSTRAINT "asientos_periodoId_fkey";
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_tenant_periodo_fkey"
    FOREIGN KEY ("tenantId", "periodoId")
    REFERENCES "periodos_contables"("tenantId", "periodoId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
