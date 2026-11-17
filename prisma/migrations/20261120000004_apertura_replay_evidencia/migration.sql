ALTER TABLE "apertura_periodo_solicitudes" ADD COLUMN "consumoEvidencia" JSONB, ADD COLUMN "consumoHash" TEXT, ADD COLUMN "consumidaPor" TEXT;
CREATE FUNCTION prevent_consumed_opening_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."estado" = 'CONSUMIDA' AND OLD."cuentasBancarias" IS NOT NULL THEN RAISE EXCEPTION 'La apertura consumida es inmutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER consumed_opening_immutable BEFORE UPDATE OR DELETE ON "apertura_periodo_solicitudes" FOR EACH ROW EXECUTE FUNCTION prevent_consumed_opening_update();
