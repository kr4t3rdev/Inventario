-- C-3: costo estándar unitario del servicio (misma unidad que precio).
-- El costo de la venta se congela desde este catálogo; el payload no puede fijarlo.
ALTER TABLE "Servicios" ADD COLUMN "costo" INTEGER NOT NULL DEFAULT 0;
