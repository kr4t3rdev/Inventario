DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname
  INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'inventario_inicial_fuentes'::regclass
    AND pg_get_constraintdef(oid) LIKE '%"costoUnitario"%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE "inventario_inicial_fuentes" DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;
END $$;

ALTER TABLE "inventario_inicial_fuentes"
  ALTER COLUMN "costoUnitario" TYPE DECIMAL(20,4)
    USING "costoUnitario"::DECIMAL(20,4);

ALTER TABLE "inventario_inicial_fuentes"
  ADD CONSTRAINT "inventario_inicial_fuentes_costoUnitario_check"
  CHECK ("costoUnitario" >= 0);
