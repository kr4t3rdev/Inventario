-- DML stage: maintenance window required; never infer ownership from tenant count.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Freeze every source until validation and the complete backfill commit together.
LOCK TABLE "tenants", "ListaPrecio", "Cliente", "PuntoDeVenta", "Producto", "PrecioProducto"
  IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE lista_precio_owner_evidence ON COMMIT DROP AS
  SELECT id AS "listaPrecioId", "tenantId" FROM "ListaPrecio" WHERE "tenantId" IS NOT NULL
  UNION ALL SELECT "listaPrecioId", "tenantId" FROM "Cliente" WHERE "listaPrecioId" IS NOT NULL
  UNION ALL SELECT "listaPrecioId", "tenantId" FROM "PuntoDeVenta" WHERE "listaPrecioId" IS NOT NULL
  UNION ALL SELECT price."listaPrecioId", product."tenantId"
    FROM "PrecioProducto" price LEFT JOIN "Producto" product ON product.id = price."productoId";
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM lista_precio_owner_evidence evidence
    LEFT JOIN "tenants" tenant ON tenant."tenantId" = evidence."tenantId"
    LEFT JOIN "ListaPrecio" list ON list.id = evidence."listaPrecioId"
    WHERE tenant."tenantId" IS NULL OR list.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM "ListaPrecio" list
    LEFT JOIN lista_precio_owner_evidence evidence ON evidence."listaPrecioId" = list.id
    GROUP BY list.id HAVING count(DISTINCT evidence."tenantId") <> 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Cannot backfill ListaPrecio.tenantId: missing, invalid or conflicting ownership evidence; an explicitly reviewed mapping is required';
  END IF;
END $$;
UPDATE "ListaPrecio" list SET "tenantId" = owner."tenantId"
FROM (
  SELECT "listaPrecioId", min("tenantId") AS "tenantId"
  FROM lista_precio_owner_evidence GROUP BY "listaPrecioId"
) owner
WHERE list.id = owner."listaPrecioId" AND list."tenantId" IS NULL;
COMMIT;
