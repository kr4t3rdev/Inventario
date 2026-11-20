-- Fallar si hay registros ambiguos ya existentes; no modificar deuda histórica.
ALTER TABLE "CuentaPorCobrar"
  ADD CONSTRAINT "CuentaPorCobrar_tipo_inicial_identidad_check" CHECK (
    "tipoCuenta" IS DISTINCT FROM 'APERTURA_EXTERNA'
    OR (
      "inicializacionId" IS NOT NULL
      AND "referenciaInicial" IS NOT NULL
      AND length(trim("referenciaInicial")) BETWEEN 1 AND 64
    )
  );
