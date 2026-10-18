BEGIN;

-- The Prisma schema requires these tenant keys, but the historical chain never
-- introduced them. Resolve ownership from authoritative linked rows only.
ALTER TABLE "CompraProducto" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "CuentaPorPagar" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

CREATE TEMP TABLE "_candidate_compra_producto_owner" ON COMMIT DROP AS
SELECT
  cp."compraProductoId",
  cp."tenantId" AS "existingTenantId",
  cp."gastoCompraId",
  p."tenantId" AS "productTenantId",
  v."tenantId" AS "vendorTenantId",
  gc."tenantId" AS "gastoTenantId",
  gc."productoId" AS "gastoProductoId",
  gc."vendorId" AS "gastoVendorId"
FROM "CompraProducto" cp
LEFT JOIN "Producto" p ON p."id" = cp."productoId"
LEFT JOIN "Vendor" v ON v."vendorId" = cp."proveedorId"
LEFT JOIN "GastoCompra" gc ON gc."gastoCompraId" = cp."gastoCompraId";

DO $$
BEGIN
  -- Any document used as a payable ownership source must have meaningful,
  -- tenant-consistent detail; this applies even when it has no linked expense.
  IF EXISTS (
    SELECT 1
    FROM "CompraDocumento" cd
    WHERE cd."cuentaPorPagarId" IS NOT NULL
      AND (
        NOT EXISTS (
          SELECT 1 FROM "CompraDocumentoItem" cdi
          WHERE cdi."compraDocumentoId" = cd."compraDocumentoId"
        )
        OR EXISTS (
          SELECT 1
          FROM "CompraDocumentoItem" cdi
          LEFT JOIN "Producto" p ON p."id" = cdi."productoId"
          WHERE cdi."compraDocumentoId" = cd."compraDocumentoId"
            AND (cdi."tenantId" <> cd."tenantId"
              OR p."id" IS NULL OR p."tenantId" <> cd."tenantId")
        )
      )
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CompraDocumento: payable detail is missing or conflicts';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "_candidate_compra_producto_owner"
    WHERE "productTenantId" IS NULL OR "vendorTenantId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CompraProducto: missing product or vendor owner';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "_candidate_compra_producto_owner"
    WHERE "productTenantId" <> "vendorTenantId"
       OR ("gastoCompraId" IS NOT NULL AND "gastoProductoId" IS NULL)
       OR ("gastoCompraId" IS NOT NULL AND "gastoTenantId" IS NULL)
       OR ("gastoTenantId" IS NOT NULL AND "gastoTenantId" <> "productTenantId")
       OR ("gastoProductoId" IS NOT NULL AND "gastoProductoId" <> (
         SELECT cp."productoId" FROM "CompraProducto" cp
         WHERE cp."compraProductoId" = "_candidate_compra_producto_owner"."compraProductoId"
       ))
       OR ("gastoVendorId" IS NOT NULL AND "gastoVendorId" <> (
         SELECT cp."proveedorId" FROM "CompraProducto" cp
         WHERE cp."compraProductoId" = "_candidate_compra_producto_owner"."compraProductoId"
       ))
       OR ("existingTenantId" IS NOT NULL AND "existingTenantId" <> "productTenantId")
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CompraProducto: parent ownership conflicts';
  END IF;

  -- A purchase document linked to the same payable is an additional authority,
  -- not a substitute for the product/vendor consensus above.
  IF EXISTS (
    SELECT 1
    FROM "CompraProducto" cp
    JOIN "CompraDocumento" cd ON cd."cuentaPorPagarId" = cp."cuentaPorPagarId"
    JOIN "_candidate_compra_producto_owner" owner
      ON owner."compraProductoId" = cp."compraProductoId"
    WHERE cp."cuentaPorPagarId" IS NOT NULL
      AND (cd."tenantId" <> owner."productTenantId"
        OR cd."proveedorId" <> cp."proveedorId"
        OR NOT EXISTS (
          SELECT 1 FROM "CompraDocumentoItem" cdi
          JOIN "Producto" item_product ON item_product."id" = cdi."productoId"
          WHERE cdi."compraDocumentoId" = cd."compraDocumentoId"
            AND cdi."productoId" = cp."productoId"
            AND cdi."tenantId" = cd."tenantId"
            AND item_product."tenantId" = cd."tenantId"
        ))
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CompraProducto: linked purchase document conflicts';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "CompraDocumento" cd
    JOIN "GastoCompra" gc ON gc."gastoCompraId" = cd."gastoCompraId"
    LEFT JOIN "Producto" p ON p."id" = gc."productoId"
    LEFT JOIN "Vendor" v ON v."vendorId" = gc."vendorId"
    WHERE cd."cuentaPorPagarId" IS NOT NULL
      AND (gc."tenantId" IS NULL
       OR gc."tenantId" <> cd."tenantId"
       OR p."tenantId" IS NULL OR p."tenantId" <> cd."tenantId"
       OR v."tenantId" IS NULL OR v."tenantId" <> cd."tenantId"
       OR gc."vendorId" <> cd."proveedorId"
       OR NOT EXISTS (
         SELECT 1
         FROM "CompraDocumentoItem" cdi
         JOIN "Producto" item_product ON item_product."id" = cdi."productoId"
         WHERE cdi."compraDocumentoId" = cd."compraDocumentoId"
           AND cdi."productoId" = gc."productoId"
           AND cdi."tenantId" = cd."tenantId"
           AND item_product."tenantId" = cd."tenantId"
       ))
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CompraDocumento: linked purchase expense conflicts';
  END IF;
END $$;

UPDATE "CompraProducto" cp
SET "tenantId" = owner."productTenantId"
FROM "_candidate_compra_producto_owner" owner
WHERE owner."compraProductoId" = cp."compraProductoId"
  AND cp."tenantId" IS NULL;

CREATE TEMP TABLE "_candidate_cxp_owner" (
  "cuentaPorPagarId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "vendorId" TEXT,
  "source" TEXT NOT NULL
) ON COMMIT DROP;

-- Legacy purchase expense: product, vendor, and non-null expense tenant must agree.
INSERT INTO "_candidate_cxp_owner"
SELECT cxp."cuentaPorPagarId", p."tenantId", gc."vendorId", 'GastoCompra'
FROM "CuentaPorPagar" cxp
JOIN "GastoCompra" gc ON gc."gastoCompraId" = cxp."gastoCompraId"
JOIN "Producto" p ON p."id" = gc."productoId"
JOIN "Vendor" v ON v."vendorId" = gc."vendorId"
WHERE cxp."gastoCompraId" IS NOT NULL
  AND p."tenantId" = v."tenantId"
  AND (gc."tenantId" IS NULL OR gc."tenantId" = p."tenantId");

-- Service expense is a direct tenant authority; vendor is only a consistency check.
INSERT INTO "_candidate_cxp_owner"
SELECT cxp."cuentaPorPagarId", gde."tenantId", gde."proveedorId", 'GastosDE'
FROM "CuentaPorPagar" cxp
JOIN "GastosDE" gde ON gde."gastosDEId" = cxp."gastosDEId"
WHERE cxp."gastosDEId" IS NOT NULL;

-- A product purchase resolves only from product/vendor consensus validated above.
INSERT INTO "_candidate_cxp_owner"
SELECT cxp."cuentaPorPagarId", owner."productTenantId", cp."proveedorId", 'CompraProducto'
FROM "CuentaPorPagar" cxp
JOIN "CompraProducto" cp ON cp."cuentaPorPagarId" = cxp."cuentaPorPagarId"
JOIN "_candidate_compra_producto_owner" owner
  ON owner."compraProductoId" = cp."compraProductoId";

-- Purchase document is authoritative only when its own vendor agrees with its tenant.
INSERT INTO "_candidate_cxp_owner"
SELECT cxp."cuentaPorPagarId", cd."tenantId", cd."proveedorId", 'CompraDocumento'
FROM "CuentaPorPagar" cxp
JOIN "CompraDocumento" cd ON cd."cuentaPorPagarId" = cxp."cuentaPorPagarId";

-- Cash debt creates its payable and is an authoritative tenant source.
INSERT INTO "_candidate_cxp_owner"
SELECT cxp."cuentaPorPagarId", dc."tenantId", dc."proveedorId", 'DeudaCash'
FROM "CuentaPorPagar" cxp
JOIN "DeudaCash" dc ON dc."cuentaPorPagarId" = cxp."cuentaPorPagarId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "CuentaPorPagar" cxp
    JOIN "GastoCompra" gc ON gc."gastoCompraId" = cxp."gastoCompraId"
    LEFT JOIN "Producto" p ON p."id" = gc."productoId"
    LEFT JOIN "Vendor" v ON v."vendorId" = gc."vendorId"
    WHERE cxp."gastoCompraId" IS NOT NULL
      AND (p."tenantId" IS NULL OR v."tenantId" IS NULL
        OR p."tenantId" <> v."tenantId"
        OR gc."tenantId" IS NULL
        OR gc."tenantId" <> p."tenantId")
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CuentaPorPagar: linked purchase owner conflicts';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "_candidate_cxp_owner" candidate
    JOIN "Vendor" v ON v."vendorId" = candidate."vendorId"
    WHERE candidate."tenantId" <> v."tenantId"
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CuentaPorPagar: linked vendor has another owner';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "CuentaPorPagar" cxp
    LEFT JOIN "Vendor" v ON v."vendorId" = cxp."proveedorId"
    WHERE cxp."proveedorId" IS NOT NULL
      AND (v."vendorId" IS NULL OR v."tenantId" IS NULL
        OR (cxp."tenantId" IS NOT NULL AND cxp."tenantId" <> v."tenantId"))
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CuentaPorPagar: payable vendor is missing or conflicts';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "_candidate_cxp_owner" candidate
    JOIN "CuentaPorPagar" cxp USING ("cuentaPorPagarId")
    WHERE cxp."proveedorId" IS NOT NULL
      AND candidate."vendorId" IS NOT NULL
      AND candidate."vendorId" <> cxp."proveedorId"
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CuentaPorPagar: linked vendors conflict';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "_candidate_cxp_owner"
    GROUP BY "cuentaPorPagarId"
    HAVING COUNT(DISTINCT "vendorId") > 1
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CuentaPorPagar: linked vendor identities conflict';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "_candidate_cxp_owner" candidate
    JOIN "CuentaPorPagar" cxp USING ("cuentaPorPagarId")
    WHERE cxp."proveedorId" IS NOT NULL
      AND candidate."tenantId" <> (
        SELECT v."tenantId" FROM "Vendor" v WHERE v."vendorId" = cxp."proveedorId"
      )
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CuentaPorPagar: payable vendor owner conflicts';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "CuentaPorPagar" cxp
    LEFT JOIN "_candidate_cxp_owner" candidate
      ON candidate."cuentaPorPagarId" = cxp."cuentaPorPagarId"
    GROUP BY cxp."cuentaPorPagarId", cxp."tenantId"
    HAVING COUNT(candidate."source") = 0
       OR COUNT(DISTINCT candidate."tenantId") <> 1
       OR (cxp."tenantId" IS NOT NULL AND MIN(candidate."tenantId") <> cxp."tenantId")
  ) THEN
    RAISE EXCEPTION 'Cannot assign tenant to CuentaPorPagar: payable has missing or conflicting owner evidence';
  END IF;
END $$;

UPDATE "CuentaPorPagar" cxp
SET "tenantId" = owner."tenantId"
FROM (
  SELECT "cuentaPorPagarId", MIN("tenantId") AS "tenantId"
  FROM "_candidate_cxp_owner"
  GROUP BY "cuentaPorPagarId"
  HAVING COUNT(DISTINCT "tenantId") = 1
) owner
WHERE owner."cuentaPorPagarId" = cxp."cuentaPorPagarId"
  AND cxp."tenantId" IS NULL;

ALTER TABLE "CompraProducto" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CuentaPorPagar" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "CompraProducto_tenantId_idx" ON "CompraProducto"("tenantId");
CREATE INDEX IF NOT EXISTS "CuentaPorPagar_tenantId_idx" ON "CuentaPorPagar"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompraProducto_tenantId_fkey'
    AND conrelid = '"CompraProducto"'::regclass) THEN
    ALTER TABLE "CompraProducto" ADD CONSTRAINT "CompraProducto_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CuentaPorPagar_tenantId_fkey'
    AND conrelid = '"CuentaPorPagar"'::regclass) THEN
    ALTER TABLE "CuentaPorPagar" ADD CONSTRAINT "CuentaPorPagar_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
