BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "CompraDocumentoItem"
  ADD COLUMN "unidadOrigenId" TEXT,
  ADD COLUMN "unidadOrigenNombre" TEXT,
  ADD COLUMN "unidadOrigenSimbolo" TEXT,
  ADD COLUMN "cantidadOrigen" INTEGER,
  ADD COLUMN "precioUnitarioOrigen" INTEGER,
  ADD COLUMN "factorAStockAplicado" DECIMAL(18, 8),
  ADD COLUMN "unidadBaseIdSnapshot" TEXT,
  ADD COLUMN "unidadBaseNombreSnapshot" TEXT,
  ADD COLUMN "unidadBaseSimboloSnapshot" TEXT,
  ADD CONSTRAINT "CompraDocumentoItem_source_unit_trace_all_or_none_check"
    CHECK (
      (
        "unidadOrigenId" IS NULL AND
        "unidadOrigenNombre" IS NULL AND
        "unidadOrigenSimbolo" IS NULL AND
        "cantidadOrigen" IS NULL AND
        "precioUnitarioOrigen" IS NULL AND
        "factorAStockAplicado" IS NULL AND
        "unidadBaseIdSnapshot" IS NULL AND
        "unidadBaseNombreSnapshot" IS NULL AND
        "unidadBaseSimboloSnapshot" IS NULL
      ) OR (
        "unidadOrigenId" IS NOT NULL AND
        "unidadOrigenNombre" IS NOT NULL AND
        "unidadOrigenSimbolo" IS NOT NULL AND
        "cantidadOrigen" IS NOT NULL AND
        "precioUnitarioOrigen" IS NOT NULL AND
        "factorAStockAplicado" IS NOT NULL AND
        "unidadBaseIdSnapshot" IS NOT NULL AND
        "unidadBaseNombreSnapshot" IS NOT NULL AND
        "unidadBaseSimboloSnapshot" IS NOT NULL AND
        "cantidadOrigen" > 0 AND
        "precioUnitarioOrigen" >= 0 AND
        "factorAStockAplicado" <> 'NaN'::numeric AND
        "factorAStockAplicado" > 0 AND
        ("unidadOrigenId" <> "unidadBaseIdSnapshot" OR "factorAStockAplicado" = 1) AND
        "cantidad"::numeric = "cantidadOrigen"::numeric * "factorAStockAplicado" AND
        "precioUnitario"::numeric * "factorAStockAplicado" = "precioUnitarioOrigen"::numeric AND
        "totalLinea"::numeric = "cantidadOrigen"::numeric * "precioUnitarioOrigen"::numeric
      )
    );

COMMIT;
