ALTER TYPE "TipoCuentaPorPagar" ADD VALUE IF NOT EXISTS 'inicial_externa';

ALTER TABLE "CuentaPorPagar"
  ALTER COLUMN "numeroFactura" DROP NOT NULL,
  ALTER COLUMN "fechaEmision" DROP NOT NULL,
  ADD COLUMN "inicializacionId" TEXT,
  ADD COLUMN "referenciaInicial" TEXT,
  ADD COLUMN "referenciaExternaInicial" TEXT;

CREATE UNIQUE INDEX "CuentaPorPagar_tenantId_inicializacionId_referenciaInicial_key"
  ON "CuentaPorPagar"("tenantId", "inicializacionId", "referenciaInicial");

ALTER TABLE "CuentaPorPagar"
  ADD CONSTRAINT "CuentaPorPagar_inicializacion_tenant_fkey"
  FOREIGN KEY ("tenantId", "inicializacionId")
  REFERENCES "inicializaciones_contables"("tenantId", "inicializacionId")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CuentaPorPagar_origen_inicial_check" CHECK (
    (
      "tipo"::text <> 'inicial_externa'
      AND "inicializacionId" IS NULL AND "referenciaInicial" IS NULL
      AND "referenciaExternaInicial" IS NULL
      AND "numeroFactura" IS NOT NULL AND "fechaEmision" IS NOT NULL
    ) OR (
      "tipo"::text = 'inicial_externa'
      AND "inicializacionId" IS NOT NULL AND "referenciaInicial" IS NOT NULL
      AND length(trim("referenciaInicial")) BETWEEN 1 AND 64
      AND "proveedorId" IS NOT NULL
      AND "numeroFactura" IS NULL AND "fechaEmision" IS NULL
      AND "gastoCompraId" IS NULL AND "gastosDEId" IS NULL
    )
  );

CREATE FUNCTION prevent_initial_payable_origin_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."inicializacionId" IS NOT NULL AND (
    NEW."tenantId" IS DISTINCT FROM OLD."tenantId" OR
    NEW."inicializacionId" IS DISTINCT FROM OLD."inicializacionId" OR
    NEW."referenciaInicial" IS DISTINCT FROM OLD."referenciaInicial" OR
    NEW."referenciaExternaInicial" IS DISTINCT FROM OLD."referenciaExternaInicial" OR
    NEW."proveedorId" IS DISTINCT FROM OLD."proveedorId" OR
    NEW."tipo" IS DISTINCT FROM OLD."tipo"
  ) THEN
    RAISE EXCEPTION 'El origen de la cuenta inicial es inmutable';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER initial_payable_origin_immutable BEFORE UPDATE ON "CuentaPorPagar"
FOR EACH ROW EXECUTE FUNCTION prevent_initial_payable_origin_update();
