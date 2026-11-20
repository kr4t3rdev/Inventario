ALTER TABLE "inicializaciones_contables"
  ADD COLUMN "borrador" JSONB CHECK ("borrador" IS NULL OR jsonb_typeof("borrador") = 'object'),
  DROP CONSTRAINT "inicializaciones_contables_estado_check",
  ADD CONSTRAINT "inicializaciones_contables_estado_check" CHECK (
    ("estado" = 'BORRADOR' AND "resultado" IS NULL AND "borrador" IS NOT NULL) OR
    ("estado" = 'EN_PROGRESO' AND "resultado" IS NULL) OR
    ("estado" = 'COMPLETADA' AND "resultado" IS NOT NULL AND jsonb_typeof("resultado") = 'object')
  );
