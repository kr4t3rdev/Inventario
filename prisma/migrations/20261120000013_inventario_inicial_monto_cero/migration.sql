-- Una fuente de costo cero tiene monto funcional cero: el CHECK original
-- (> 0) la rechazaba aunque el contrato permite costo cero.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname
  INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'inventario_inicial_fuentes'::regclass
    AND pg_get_constraintdef(oid) LIKE '%"montoFuncional"%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE "inventario_inicial_fuentes" DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;
END $$;

ALTER TABLE "inventario_inicial_fuentes"
  ADD CONSTRAINT "inventario_inicial_fuentes_montoFuncional_check"
  CHECK ("montoFuncional" >= 0);
