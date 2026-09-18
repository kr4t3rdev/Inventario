-- Snapshot de moneda y precio unitario en ventas de servicios.
-- Las filas históricas heredan la moneda del servicio y derivan
-- precioUnitario desde total/cantidad (los precios son enteros).

ALTER TABLE "VentaServicios"
  ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'CUP',
  ADD COLUMN "precioUnitario" INTEGER;

UPDATE "VentaServicios" vs
SET "moneda" = s."moneda"
FROM "Servicios" s
WHERE vs."servicioId" = s."servicioId";

UPDATE "VentaServicios"
SET "precioUnitario" = ROUND("total"::numeric / "cantidad")
WHERE "precioUnitario" IS NULL AND "cantidad" > 0;
