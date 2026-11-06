-- Alinea "Receta"."costoUnitario" con el tipo declarado en prisma/schema.prisma
-- (Float, que en PostgreSQL es DOUBLE PRECISION). Las migraciones historicas
-- lo dejaron como INTEGER, de modo que escribir un costo fraccionario (el
-- resultado normal de calcular el costo unitario de una receta) fallaba con
-- "column costoUnitario is of type integer but expression is of type double
-- precision".
--
-- La conversion INTEGER -> DOUBLE PRECISION es exacta: todos los valores
-- existentes se conservan sin perdida y no se reescriben indices ni claves.

ALTER TABLE "Receta"
  ALTER COLUMN "costoUnitario" TYPE DOUBLE PRECISION USING "costoUnitario"::double precision;
