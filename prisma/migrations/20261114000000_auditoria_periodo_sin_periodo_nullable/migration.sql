-- La auditoría de un intento sobre una fecha sin período aplicable no tiene
-- una referencia válida a `periodos_contables`; la FK obligatoria rechazaba el
-- marcador 'N/A' (SQLSTATE 23503) y ocultaba el diagnóstico real.
ALTER TABLE "auditoria_periodos" ALTER COLUMN "periodoId" DROP NOT NULL;
