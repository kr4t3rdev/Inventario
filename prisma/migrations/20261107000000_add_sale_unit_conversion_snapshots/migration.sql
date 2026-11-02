ALTER TABLE "venta_items"
  ADD COLUMN "unidadOrigenId" TEXT,
  ADD COLUMN "unidadOrigenNombre" TEXT,
  ADD COLUMN "unidadOrigenSimbolo" TEXT,
  ADD COLUMN "cantidadOrigen" INTEGER,
  ADD COLUMN "precioUnitarioOrigen" INTEGER,
  ADD COLUMN "factorAStockAplicado" DECIMAL(18, 8),
  ADD COLUMN "unidadBaseIdSnapshot" TEXT,
  ADD COLUMN "unidadBaseNombreSnapshot" TEXT,
  ADD COLUMN "unidadBaseSimboloSnapshot" TEXT;
