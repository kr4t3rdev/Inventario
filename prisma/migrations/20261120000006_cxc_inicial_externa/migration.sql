ALTER TABLE "CuentaPorCobrar"
  ADD COLUMN "inicializacionId" TEXT,
  ADD COLUMN "referenciaInicial" TEXT,
  ADD COLUMN "referenciaExternaInicial" TEXT;

CREATE UNIQUE INDEX "inicializaciones_contables_tenantId_inicializacionId_key"
  ON "inicializaciones_contables"("tenantId", "inicializacionId");
CREATE UNIQUE INDEX "CuentaPorCobrar_tenantId_inicializacionId_referenciaInicial_key"
  ON "CuentaPorCobrar"("tenantId", "inicializacionId", "referenciaInicial");

ALTER TABLE "CuentaPorCobrar"
  ADD CONSTRAINT "CuentaPorCobrar_inicializacion_tenant_fkey"
  FOREIGN KEY ("tenantId", "inicializacionId")
  REFERENCES "inicializaciones_contables"("tenantId", "inicializacionId")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CuentaPorCobrar_origen_inicial_check" CHECK (
    ("inicializacionId" IS NULL AND "referenciaInicial" IS NULL AND "referenciaExternaInicial" IS NULL)
    OR
    ("inicializacionId" IS NOT NULL AND "referenciaInicial" IS NOT NULL
      AND length(trim("referenciaInicial")) BETWEEN 1 AND 64
      AND "tipoCuenta" IS NOT DISTINCT FROM 'APERTURA_EXTERNA'
      AND "facturaId" IS NULL AND "ventaServicioId" IS NULL)
  );

CREATE FUNCTION prevent_initial_receivable_origin_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."inicializacionId" IS NOT NULL AND (
    NEW."tenantId" IS DISTINCT FROM OLD."tenantId" OR
    NEW."inicializacionId" IS DISTINCT FROM OLD."inicializacionId" OR
    NEW."referenciaInicial" IS DISTINCT FROM OLD."referenciaInicial" OR
    NEW."referenciaExternaInicial" IS DISTINCT FROM OLD."referenciaExternaInicial" OR
    NEW."tipoCuenta" IS DISTINCT FROM OLD."tipoCuenta"
  ) THEN
    RAISE EXCEPTION 'El origen de la cuenta inicial es inmutable';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER initial_receivable_origin_immutable BEFORE UPDATE ON "CuentaPorCobrar"
FOR EACH ROW EXECUTE FUNCTION prevent_initial_receivable_origin_update();
