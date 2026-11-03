-- Las recepciones aportan lotes antes de que exista la factura de compra.
ALTER TABLE "RecepcionItem"
  ADD COLUMN "cantidadFacturada" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "montoFacturado" INTEGER NOT NULL DEFAULT 0;

-- Reconstruye la facturación histórica por producto de forma FIFO, para que
-- una factura antigua no vuelva a consumir unidades ya recibidas al conciliar.
WITH recepciones AS (
  SELECT
    ri."id",
    ri."tenantId",
    oi."ordenId",
    ri."productoId",
    ri."cantidad",
    SUM(ri."cantidad") OVER (
      PARTITION BY ri."tenantId", oi."ordenId", ri."productoId"
      ORDER BY r."fecha", ri."id"
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) - ri."cantidad" AS inicio,
    SUM(ri."cantidad") OVER (
      PARTITION BY ri."tenantId", oi."ordenId", ri."productoId"
      ORDER BY r."fecha", ri."id"
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS fin
  FROM "RecepcionItem" ri
  INNER JOIN "Recepcion" r
    ON r."tenantId" = ri."tenantId" AND r."id" = ri."recepcionId"
  INNER JOIN "OrdenCompraItem" oi
    ON oi."tenantId" = ri."tenantId" AND oi."id" = ri."ordenItemId"
), facturas AS (
  SELECT
    cdi."tenantId",
    cd."ordenCompraId" AS orden_id,
    cdi."productoId",
    cdi."cantidad",
    cdi."precioUnitario",
    SUM(cdi."cantidad") OVER (
      PARTITION BY cdi."tenantId", cd."ordenCompraId", cdi."productoId"
      ORDER BY cd."fechaCompra", cd."createdAt", cd."compraDocumentoId",
        cdi."createdAt", cdi."compraDocumentoItemId"
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) - cdi."cantidad" AS inicio,
    SUM(cdi."cantidad") OVER (
      PARTITION BY cdi."tenantId", cd."ordenCompraId", cdi."productoId"
      ORDER BY cd."fechaCompra", cd."createdAt", cd."compraDocumentoId",
        cdi."createdAt", cdi."compraDocumentoItemId"
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS fin
  FROM "CompraDocumentoItem" cdi
  INNER JOIN "CompraDocumento" cd
    ON cd."tenantId" = cdi."tenantId"
    AND cd."compraDocumentoId" = cdi."compraDocumentoId"
  WHERE cd."ordenCompraId" IS NOT NULL
    AND cd."deletedAt" IS NULL
    AND cd."estado" <> 'ANULADA'
), conciliacion AS (
  SELECT
    r."id",
    SUM(GREATEST(0, LEAST(r.fin, f.fin) - GREATEST(r.inicio, f.inicio)))::INTEGER AS cantidad,
    SUM(
      GREATEST(0, LEAST(r.fin, f.fin) - GREATEST(r.inicio, f.inicio))
      * f."precioUnitario"
    )::INTEGER AS monto
  FROM recepciones r
  INNER JOIN facturas f
    ON f."tenantId" = r."tenantId"
    AND f.orden_id = r."ordenId"
    AND f."productoId" = r."productoId"
    AND f.fin > r.inicio
    AND r.fin > f.inicio
  GROUP BY r."id"
)
UPDATE "RecepcionItem" ri
SET "cantidadFacturada" = c.cantidad,
    "montoFacturado" = c.monto
FROM conciliacion c
WHERE ri."id" = c."id";

ALTER TABLE "purchase_allocations"
  ALTER COLUMN "compraDocumentoItemId" DROP NOT NULL,
  ADD COLUMN "recepcionItemId" TEXT,
  ADD COLUMN "costoUnitarioSnapshot" INTEGER;

CREATE INDEX "purchase_allocations_tenantId_recepcionItemId_idx"
  ON "purchase_allocations"("tenantId", "recepcionItemId");

ALTER TABLE "purchase_allocations"
  ADD CONSTRAINT "purchase_allocations_tenantId_recepcionItemId_fkey"
    FOREIGN KEY ("tenantId", "recepcionItemId")
    REFERENCES "RecepcionItem"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "purchase_allocations_source_check"
    CHECK (
      ("compraDocumentoItemId" IS NOT NULL AND "recepcionItemId" IS NULL)
      OR (
        "compraDocumentoItemId" IS NULL
        AND "recepcionItemId" IS NOT NULL
        AND "loteId" IS NOT NULL
      )
    );
