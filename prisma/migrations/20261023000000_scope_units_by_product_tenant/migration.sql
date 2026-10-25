-- Forward prerequisite for timestamped migration chains that predate the
-- standalone unidad-tenant-scoping.sql script. Ownership comes only from
-- Producto.tenantId; unreferenced units are intentionally a hard failure.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Unidad' AND column_name = 'tenantId') THEN
    ALTER TABLE "Unidad" ADD COLUMN "tenantId" TEXT;
  END IF;
END $$;

-- Validate the relationship contract, not just object names. The only
-- pre-F1 Unidad dependents are Producto.unidadId and, on an already migrated
-- database, UnidadConversion's tenant-scoped source-unit reference.
DO $$
DECLARE
  unit_id smallint;
  unit_tenant smallint;
  product_unit smallint;
  product_tenant smallint;
  conversion_tenant smallint;
  conversion_unit smallint;
  tenant_key smallint;
  index_check RECORD;
  index_oid oid;
  index_is_valid boolean;
  index_is_unique boolean;
  index_is_ready boolean;
  index_has_predicate boolean;
  index_has_expression boolean;
  index_keys smallint[];
  fk RECORD;
BEGIN
  SELECT attnum INTO unit_id FROM pg_attribute
    WHERE attrelid = '"Unidad"'::regclass AND attname = 'unidadId' AND NOT attisdropped;
  SELECT attnum INTO unit_tenant FROM pg_attribute
    WHERE attrelid = '"Unidad"'::regclass AND attname = 'tenantId' AND NOT attisdropped;
  SELECT attnum INTO product_unit FROM pg_attribute
    WHERE attrelid = '"Producto"'::regclass AND attname = 'unidadId' AND NOT attisdropped;
  SELECT attnum INTO product_tenant FROM pg_attribute
    WHERE attrelid = '"Producto"'::regclass AND attname = 'tenantId' AND NOT attisdropped;
  SELECT attnum INTO tenant_key FROM pg_attribute
    WHERE attrelid = '"tenants"'::regclass AND attname = 'tenantId' AND NOT attisdropped;
  IF to_regclass('"UnidadConversion"') IS NOT NULL THEN
    SELECT attnum INTO conversion_tenant FROM pg_attribute
      WHERE attrelid = '"UnidadConversion"'::regclass AND attname = 'tenantId' AND NOT attisdropped;
    SELECT attnum INTO conversion_unit FROM pg_attribute
      WHERE attrelid = '"UnidadConversion"'::regclass AND attname = 'unidadId' AND NOT attisdropped;
  END IF;

  IF unit_id IS NULL OR unit_tenant IS NULL OR product_unit IS NULL
     OR product_tenant IS NULL OR tenant_key IS NULL OR
     NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = '"Unidad"'::regclass
       AND attname = 'tenantId' AND atttypid = 'text'::regtype AND NOT attisdropped) OR
     EXISTS (SELECT 1 FROM pg_attrdef d WHERE d.adrelid = '"Unidad"'::regclass
       AND d.adnum = unit_tenant) THEN
    RAISE EXCEPTION 'Unidad tenantId column does not match the expected TEXT/no-default contract';
  END IF;

  FOR index_check IN
    SELECT v.index_name, v.expected_keys, v.must_be_unique
    FROM (SELECT unit_id AS id_key, unit_tenant AS tenant_key,
      (SELECT attnum FROM pg_attribute WHERE attrelid = '"Unidad"'::regclass
        AND attname = 'nombre' AND NOT attisdropped) AS nombre_key,
      (SELECT attnum FROM pg_attribute WHERE attrelid = '"Unidad"'::regclass
        AND attname = 'simbolo' AND NOT attisdropped) AS simbolo_key) a
    CROSS JOIN LATERAL (VALUES
      ('Unidad_pkey', ARRAY[a.id_key]::smallint[], TRUE),
      ('Unidad_nombre_key', ARRAY[a.nombre_key]::smallint[], TRUE),
      ('Unidad_simbolo_key', ARRAY[a.simbolo_key]::smallint[], TRUE),
      ('Unidad_tenantId_nombre_key', ARRAY[a.tenant_key,a.nombre_key]::smallint[], TRUE),
      ('Unidad_tenantId_simbolo_key', ARRAY[a.tenant_key,a.simbolo_key]::smallint[], TRUE),
      ('Unidad_tenantId_unidadId_key', ARRAY[a.tenant_key,a.id_key]::smallint[], TRUE),
      ('Unidad_tenantId_idx', ARRAY[a.tenant_key]::smallint[], FALSE)
    ) AS v(index_name, expected_keys, must_be_unique)
  LOOP
    SELECT c.oid INTO index_oid FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relname = index_check.index_name;
    IF index_oid IS NULL THEN CONTINUE; END IF;
    SELECT i.indisvalid, i.indisunique, i.indisready, i.indpred IS NOT NULL,
      i.indexprs IS NOT NULL,
      ARRAY(SELECT key.attnum::smallint FROM unnest(i.indkey) WITH ORDINALITY key(attnum, ord)
        WHERE key.ord <= i.indnkeyatts ORDER BY key.ord)
      INTO index_is_valid, index_is_unique, index_is_ready, index_has_predicate,
        index_has_expression, index_keys
      FROM pg_index i WHERE i.indexrelid = index_oid AND i.indrelid = '"Unidad"'::regclass;
    IF NOT FOUND OR index_is_valid IS DISTINCT FROM TRUE
       OR index_is_ready IS DISTINCT FROM TRUE
       OR index_is_unique IS DISTINCT FROM index_check.must_be_unique
       OR index_has_predicate IS DISTINCT FROM FALSE
       OR index_has_expression IS DISTINCT FROM FALSE
       OR index_keys IS DISTINCT FROM index_check.expected_keys THEN
      RAISE EXCEPTION 'Unidad index % has an unexpected semantic definition', index_check.index_name;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
      WHERE i.indrelid = '"Unidad"'::regclass AND i.indisunique
        AND c.relname NOT IN ('Unidad_pkey','Unidad_nombre_key','Unidad_simbolo_key',
          'Unidad_tenantId_nombre_key','Unidad_tenantId_simbolo_key','Unidad_tenantId_unidadId_key')) THEN
    RAISE EXCEPTION 'Unidad has an unsupported unique index';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = '"Unidad"'::regclass
      AND c.conname IN ('Unidad_pkey','Unidad_nombre_key','Unidad_simbolo_key')
      AND NOT ((c.conname = 'Unidad_pkey' AND c.contype = 'p' AND c.conkey = ARRAY[unit_id]::smallint[])
        OR (c.conname = 'Unidad_nombre_key' AND c.contype = 'u'
          AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = '"Unidad"'::regclass AND attname = 'nombre')]::smallint[])
        OR (c.conname = 'Unidad_simbolo_key' AND c.contype = 'u'
          AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = '"Unidad"'::regclass AND attname = 'simbolo')]::smallint[]))) THEN
    RAISE EXCEPTION 'Unidad named global constraint has an unexpected semantic definition';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = '"Producto"'::regclass
      AND c.confrelid = '"Unidad"'::regclass AND c.contype = 'f'
      AND c.conname = 'Producto_unidadId_fkey'
      AND c.conkey = ARRAY[product_unit]::smallint[] AND c.confkey = ARRAY[unit_id]::smallint[]
      AND c.confdeltype IN ('r','c') AND c.confupdtype = 'c' AND c.convalidated) THEN
    RAISE EXCEPTION 'Expected validated Producto.unidadId foreign key contract is missing or malformed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.confrelid = '"Unidad"'::regclass
      AND c.contype = 'f' AND NOT (
        c.conrelid = '"Producto"'::regclass AND c.conname = 'Producto_unidadId_fkey'
        AND c.conkey = ARRAY[product_unit]::smallint[] AND c.confkey = ARRAY[unit_id]::smallint[]
        AND c.confdeltype IN ('r','c') AND c.confupdtype = 'c' AND c.convalidated
      ) AND NOT (
        to_regclass('"UnidadConversion"') IS NOT NULL
        AND c.conrelid = to_regclass('"UnidadConversion"')
        AND c.conname = 'UnidadConversion_unidad_tenant_fkey'
        AND c.conkey = ARRAY[conversion_tenant,conversion_unit]::smallint[]
        AND c.confkey = ARRAY[unit_tenant,unit_id]::smallint[]
        AND c.confdeltype = 'r' AND c.confupdtype = 'r' AND c.convalidated
      )) THEN
    RAISE EXCEPTION 'Unexpected or malformed foreign-key dependency on Unidad';
  END IF;
  IF to_regclass('"UnidadConversion"') IS NOT NULL AND
     (conversion_tenant IS NULL OR conversion_unit IS NULL OR NOT EXISTS (
       SELECT 1 FROM pg_constraint c WHERE c.conrelid = to_regclass('"UnidadConversion"')
         AND c.confrelid = '"Unidad"'::regclass AND c.contype = 'f'
         AND c.conname = 'UnidadConversion_unidad_tenant_fkey'
         AND c.conkey = ARRAY[conversion_tenant,conversion_unit]::smallint[]
         AND c.confkey = ARRAY[unit_tenant,unit_id]::smallint[]
         AND c.confdeltype = 'r' AND c.confupdtype = 'r' AND c.convalidated
     )) THEN
    RAISE EXCEPTION 'Expected UnidadConversion unit foreign key contract is missing or malformed';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = '"Unidad"'::regclass
      AND c.conname = 'Unidad_tenantId_fkey' AND NOT (
        c.contype = 'f' AND c.confrelid = '"tenants"'::regclass
        AND c.conkey = ARRAY[unit_tenant]::smallint[] AND c.confkey = ARRAY[tenant_key]::smallint[]
        AND c.confdeltype = 'r' AND c.confupdtype = 'c' AND c.convalidated
      )) THEN
    RAISE EXCEPTION 'Unidad_tenantId_fkey exists with an unexpected semantic definition';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = '"Unidad"'::regclass
      AND c.contype = 'f' AND c.confrelid = '"tenants"'::regclass
      AND NOT (c.conname = 'Unidad_tenantId_fkey'
        AND c.conkey = ARRAY[unit_tenant]::smallint[] AND c.confkey = ARRAY[tenant_key]::smallint[]
        AND c.confdeltype = 'r' AND c.confupdtype = 'c' AND c.convalidated)) THEN
    RAISE EXCEPTION 'Unidad has an unsupported tenant ownership foreign key';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Producto" p JOIN "Unidad" u
      ON u."unidadId" = p."unidadId"
      WHERE u."tenantId" IS NOT NULL AND u."tenantId" <> p."tenantId") THEN
    RAISE EXCEPTION 'Producto references a Unidad owned by a different tenant';
  END IF;
END $$;

-- Accept the already-scoped production shape only when every row has a valid
-- tenant and there is no legacy global unique constraint/index left to remove.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Unidad" WHERE "tenantId" IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM "Unidad" WHERE "tenantId" IS NULL) THEN
    IF EXISTS (SELECT 1 FROM "Unidad" u LEFT JOIN "tenants" t
      ON t."tenantId" = u."tenantId" WHERE t."tenantId" IS NULL) THEN
      RAISE EXCEPTION 'Unidad tenant ownership references a missing tenant';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"Unidad"'::regclass
      AND conname IN ('Unidad_nombre_key', 'Unidad_simbolo_key')) OR
       EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i'
      AND relname IN ('Unidad_nombre_key', 'Unidad_simbolo_key')) THEN
      RAISE EXCEPTION 'Unidad is tenant-scoped but still has global unique indexes';
    END IF;
    RETURN;
  END IF;
END $$;

CREATE TEMP TABLE "_UnidadScopeMap" (
  "sourceId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "simbolo" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "keepOriginal" BOOLEAN NOT NULL,
  PRIMARY KEY ("sourceId", "tenantId")
) ON COMMIT DROP;

-- Derive each required ownership from actual product references. Deterministic
-- IDs retain the original ID for the first tenant and clone for other tenants.
INSERT INTO "_UnidadScopeMap"
SELECT u."unidadId", p."tenantId",
  CASE WHEN row_number() OVER (PARTITION BY u."unidadId"
    ORDER BY p."tenantId") = 1 THEN u."unidadId"
    ELSE 'c' || substr(md5(u."unidadId" || ':' || p."tenantId"), 1, 24) END,
  u."nombre", u."simbolo", u."createdAt", u."updatedAt",
  row_number() OVER (PARTITION BY u."unidadId" ORDER BY p."tenantId") = 1
FROM "Unidad" u JOIN "Producto" p ON p."unidadId" = u."unidadId"
WHERE u."tenantId" IS NULL
GROUP BY u."unidadId", p."tenantId", u."nombre", u."simbolo", u."createdAt", u."updatedAt";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Unidad" WHERE "tenantId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "_UnidadScopeMap" m WHERE m."sourceId" = "Unidad"."unidadId")) THEN
    RAISE EXCEPTION 'Unreferenced Unidad rows cannot be assigned a tenant safely';
  END IF;
  IF EXISTS (SELECT 1 FROM "_UnidadScopeMap" m JOIN "tenants" t
      ON t."tenantId" = m."tenantId" WHERE t."tenantId" IS NULL) THEN
    RAISE EXCEPTION 'Producto ownership references a missing tenant';
  END IF;
  IF EXISTS (SELECT 1 FROM "_UnidadScopeMap" m JOIN "Unidad" u
      ON u."tenantId" = m."tenantId" AND (u."nombre" = m."nombre" OR u."simbolo" = m."simbolo")
      AND u."unidadId" <> m."sourceId") THEN
    RAISE EXCEPTION 'Tenant-scoped Unidad name or symbol conflicts during backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM "_UnidadScopeMap" m JOIN "Unidad" u
      ON u."unidadId" = m."targetId" WHERE NOT m."keepOriginal") THEN
    RAISE EXCEPTION 'Deterministic Unidad clone ID collides with an existing row';
  END IF;
END $$;

ALTER TABLE "Unidad" DROP CONSTRAINT IF EXISTS "Unidad_nombre_key";
ALTER TABLE "Unidad" DROP CONSTRAINT IF EXISTS "Unidad_simbolo_key";
DROP INDEX IF EXISTS "Unidad_nombre_key";
DROP INDEX IF EXISTS "Unidad_simbolo_key";

INSERT INTO "Unidad" ("unidadId", "tenantId", "nombre", "simbolo", "createdAt", "updatedAt")
SELECT "targetId", "tenantId", "nombre", "simbolo", "createdAt", "updatedAt"
FROM "_UnidadScopeMap" WHERE NOT "keepOriginal";
UPDATE "Producto" p SET "unidadId" = m."targetId"
FROM "_UnidadScopeMap" m WHERE p."unidadId" = m."sourceId" AND p."tenantId" = m."tenantId";
UPDATE "Unidad" u SET "tenantId" = m."tenantId"
FROM "_UnidadScopeMap" m WHERE u."unidadId" = m."sourceId" AND m."keepOriginal";

ALTER TABLE "Unidad" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Unidad_tenantId_nombre_key" ON "Unidad"("tenantId", "nombre");
CREATE UNIQUE INDEX IF NOT EXISTS "Unidad_tenantId_simbolo_key" ON "Unidad"("tenantId", "simbolo");
CREATE INDEX IF NOT EXISTS "Unidad_tenantId_idx" ON "Unidad"("tenantId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"Unidad"'::regclass AND conname = 'Unidad_tenantId_fkey') THEN
    ALTER TABLE "Unidad" ADD CONSTRAINT "Unidad_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "Producto" DROP CONSTRAINT IF EXISTS "Producto_unidadId_fkey";
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_unidadId_fkey"
  FOREIGN KEY ("unidadId") REFERENCES "Unidad"("unidadId") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
