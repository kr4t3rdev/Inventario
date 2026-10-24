BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE labels text[];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CostChangeReason') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                   WHERE t.typname='CostChangeReason' AND n.nspname=current_schema() AND t.typtype='e') THEN
      RAISE EXCEPTION 'CostChangeReason exists but is not an enum';
    END IF;
    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='CostChangeReason';
    IF labels IS DISTINCT FROM ARRAY['INITIAL','RESTOCK','ADJUSTMENT','CORRECTION','IMPORT','MANUAL_EDIT','SYSTEM_SYNC']::text[] THEN
      RAISE EXCEPTION 'CostChangeReason enum labels/order mismatch';
    END IF;
  ELSE
    CREATE TYPE "CostChangeReason" AS ENUM ('INITIAL','RESTOCK','ADJUSTMENT','CORRECTION','IMPORT','MANUAL_EDIT','SYSTEM_SYNC');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ProductoCostHistory" (
  "id" TEXT NOT NULL,
  "productoId" TEXT NOT NULL,
  "oldPrecioCosto" INTEGER NOT NULL,
  "newPrecioCosto" INTEGER NOT NULL,
  "oldPrecioVenta" INTEGER NOT NULL,
  "newPrecioVenta" INTEGER NOT NULL,
  "reason" "CostChangeReason" NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductoCostHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductoCostHistory_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "VendorCodeSequence" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "VendorCodeSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TipoContratoCustom" (
  "tipoCustomId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creadoPor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TipoContratoCustom_pkey" PRIMARY KEY ("tipoCustomId"),
  CONSTRAINT "TipoContratoCustom_creadoPor_fkey"
    FOREIGN KEY ("creadoPor") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='ProductoCostHistory_productoId_idx' AND relkind='i') THEN
    IF (SELECT pg_get_indexdef(c.oid) FROM pg_class c WHERE c.relname='ProductoCostHistory_productoId_idx' AND c.relkind='i')
       IS DISTINCT FROM 'CREATE INDEX "ProductoCostHistory_productoId_idx" ON public."ProductoCostHistory" USING btree ("productoId")' THEN
      RAISE EXCEPTION 'Index ProductoCostHistory_productoId_idx definition mismatch';
    END IF;
  ELSE
    CREATE INDEX "ProductoCostHistory_productoId_idx" ON "ProductoCostHistory"("productoId");
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='ProductoCostHistory_changedAt_idx' AND relkind='i') THEN
    IF (SELECT pg_get_indexdef(c.oid) FROM pg_class c WHERE c.relname='ProductoCostHistory_changedAt_idx' AND c.relkind='i')
       IS DISTINCT FROM 'CREATE INDEX "ProductoCostHistory_changedAt_idx" ON public."ProductoCostHistory" USING btree ("changedAt")' THEN
      RAISE EXCEPTION 'Index ProductoCostHistory_changedAt_idx definition mismatch';
    END IF;
  ELSE
    CREATE INDEX "ProductoCostHistory_changedAt_idx" ON "ProductoCostHistory"("changedAt");
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='ProductoCostHistory_reason_idx' AND relkind='i') THEN
    IF (SELECT pg_get_indexdef(c.oid) FROM pg_class c WHERE c.relname='ProductoCostHistory_reason_idx' AND c.relkind='i')
       IS DISTINCT FROM 'CREATE INDEX "ProductoCostHistory_reason_idx" ON public."ProductoCostHistory" USING btree (reason)' THEN
      RAISE EXCEPTION 'Index ProductoCostHistory_reason_idx definition mismatch';
    END IF;
  ELSE
    CREATE INDEX "ProductoCostHistory_reason_idx" ON "ProductoCostHistory"("reason");
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='TipoContratoCustom_nombre_key' AND relkind='i') THEN
    IF (SELECT pg_get_indexdef(c.oid) FROM pg_class c WHERE c.relname='TipoContratoCustom_nombre_key' AND c.relkind='i')
       IS DISTINCT FROM 'CREATE UNIQUE INDEX "TipoContratoCustom_nombre_key" ON public."TipoContratoCustom" USING btree (nombre)' THEN
      RAISE EXCEPTION 'Index TipoContratoCustom_nombre_key definition mismatch';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='TipoContratoCustom_tenantId_nombre_key' AND n.nspname=current_schema()) THEN
      IF (SELECT pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='TipoContratoCustom_tenantId_nombre_key' AND n.nspname=current_schema()) IS DISTINCT FROM 'CREATE UNIQUE INDEX "TipoContratoCustom_tenantId_nombre_key" ON public."TipoContratoCustom" USING btree ("tenantId", nombre)' THEN RAISE EXCEPTION 'Tenant scoped unique index mismatch'; END IF;
    ELSE
      CREATE UNIQUE INDEX "TipoContratoCustom_nombre_key" ON "TipoContratoCustom"("nombre");
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='TipoContratoCustom_nombre_idx' AND relkind='i') THEN
    IF (SELECT pg_get_indexdef(c.oid) FROM pg_class c WHERE c.relname='TipoContratoCustom_nombre_idx' AND c.relkind='i')
       IS DISTINCT FROM 'CREATE INDEX "TipoContratoCustom_nombre_idx" ON public."TipoContratoCustom" USING btree (nombre)' THEN
      RAISE EXCEPTION 'Index TipoContratoCustom_nombre_idx definition mismatch';
    END IF;
  ELSE
    CREATE INDEX "TipoContratoCustom_nombre_idx" ON "TipoContratoCustom"("nombre");
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='TipoContratoCustom_activo_idx' AND relkind='i') THEN
    IF (SELECT pg_get_indexdef(c.oid) FROM pg_class c WHERE c.relname='TipoContratoCustom_activo_idx' AND c.relkind='i')
       IS DISTINCT FROM 'CREATE INDEX "TipoContratoCustom_activo_idx" ON public."TipoContratoCustom" USING btree (activo)' THEN
      RAISE EXCEPTION 'Index TipoContratoCustom_activo_idx definition mismatch';
    END IF;
  ELSE
    CREATE INDEX "TipoContratoCustom_activo_idx" ON "TipoContratoCustom"("activo");
  END IF;
END $$;

DO $$
DECLARE mismatch_count integer;
BEGIN
  SELECT count(*) INTO mismatch_count FROM (VALUES
    ('ProductoCostHistory','id','text',true),('ProductoCostHistory','productoId','text',true),
    ('ProductoCostHistory','oldPrecioCosto','integer',true),('ProductoCostHistory','newPrecioCosto','integer',true),
    ('ProductoCostHistory','oldPrecioVenta','integer',true),('ProductoCostHistory','newPrecioVenta','integer',true),
    ('ProductoCostHistory','reason','"CostChangeReason"',true),('ProductoCostHistory','changedBy','text',true),
    ('ProductoCostHistory','changedAt','timestamp(3) without time zone',true),('ProductoCostHistory','notes','text',false),
    ('ProductoCostHistory','createdAt','timestamp(3) without time zone',true),
    ('VendorCodeSequence','id','integer',true),('VendorCodeSequence','nextNumber','integer',true),
    ('TipoContratoCustom','tipoCustomId','text',true),('TipoContratoCustom','nombre','text',true),
    ('TipoContratoCustom','descripcion','text',false),('TipoContratoCustom','activo','boolean',true),
    ('TipoContratoCustom','creadoPor','text',true),('TipoContratoCustom','createdAt','timestamp(3) without time zone',true),
    ('TipoContratoCustom','updatedAt','timestamp(3) without time zone',true)
  ) e(tbl,col,typ,nn) LEFT JOIN pg_attribute a ON a.attrelid=to_regclass(format('"%s"',e.tbl)) AND a.attname=e.col AND NOT a.attisdropped
    WHERE a.attname IS NULL OR format_type(a.atttypid,a.atttypmod)<>e.typ OR a.attnotnull<>e.nn;
  IF mismatch_count<>0 OR
     (SELECT count(*) FROM pg_attribute WHERE attrelid='"ProductoCostHistory"'::regclass AND attnum>0 AND NOT attisdropped)<>11 OR
     (SELECT count(*) FROM pg_attribute WHERE attrelid='"VendorCodeSequence"'::regclass AND attnum>0 AND NOT attisdropped)<>2 OR
     (SELECT count(*) FROM pg_attribute WHERE attrelid='"TipoContratoCustom"'::regclass AND attnum>0 AND NOT attisdropped) NOT IN (7,8) THEN
    RAISE EXCEPTION 'Migration 20261022000000 table column contract mismatch';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='"TipoContratoCustom"'::regclass AND attnum>0 AND NOT attisdropped)=8 AND
     (NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='"TipoContratoCustom"'::regclass AND attname='tenantId' AND format_type(atttypid,atttypmod)='text' AND NOT attnotnull AND NOT attisdropped) OR
      NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='TipoContratoCustom_tenantId_fkey' AND c.conrelid='"TipoContratoCustom"'::regclass AND c.contype='f' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"TipoContratoCustom"'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confrelid='tenants'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='tenants'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confdeltype='n' AND c.confupdtype='c' AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId") ON UPDATE CASCADE ON DELETE SET NULL')) THEN
    RAISE EXCEPTION 'Existing tenant-scoped contract is incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM (VALUES
      ('ProductoCostHistory','createdAt','CURRENT_TIMESTAMP'),('TipoContratoCustom','activo','true'),
      ('TipoContratoCustom','createdAt','CURRENT_TIMESTAMP'),('VendorCodeSequence','id','1'),
      ('VendorCodeSequence','nextNumber','1')
    ) e(tbl,col,expected) JOIN pg_attribute a ON a.attrelid=to_regclass(format('"%s"',e.tbl)) AND a.attname=e.col
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE pg_get_expr(d.adbin,d.adrelid) IS DISTINCT FROM e.expected)
     OR (SELECT count(*) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE c.relname IN ('ProductoCostHistory','VendorCodeSequence','TipoContratoCustom'))<>5 THEN
    RAISE EXCEPTION 'Migration 20261022000000 default contract mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='ProductoCostHistory_productoId_fkey' AND c.conrelid='"ProductoCostHistory"'::regclass AND c.contype='f' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"ProductoCostHistory"'::regclass AND attname='productoId' AND NOT attisdropped)]::smallint[] AND c.confrelid='"Producto"'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"Producto"'::regclass AND attname='id' AND NOT attisdropped)]::smallint[] AND c.confdeltype='c' AND c.confupdtype='c' AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("productoId") REFERENCES "Producto"(id) ON UPDATE CASCADE ON DELETE CASCADE') OR
     NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='TipoContratoCustom_creadoPor_fkey' AND c.conrelid='"TipoContratoCustom"'::regclass AND c.contype='f' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"TipoContratoCustom"'::regclass AND attname='creadoPor' AND NOT attisdropped)]::smallint[] AND c.confrelid='"User"'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"User"'::regclass AND attname='userId' AND NOT attisdropped)]::smallint[] AND c.confdeltype='r' AND c.confupdtype='c' AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("creadoPor") REFERENCES "User"("userId") ON UPDATE CASCADE ON DELETE RESTRICT') OR
     NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='ProductoCostHistory_pkey' AND c.conrelid='"ProductoCostHistory"'::regclass AND c.contype='p' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"ProductoCostHistory"'::regclass AND attname='id' AND NOT attisdropped)]::smallint[] AND pg_get_constraintdef(c.oid)='PRIMARY KEY (id)') OR
     NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='VendorCodeSequence_pkey' AND c.conrelid='"VendorCodeSequence"'::regclass AND c.contype='p' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"VendorCodeSequence"'::regclass AND attname='id' AND NOT attisdropped)]::smallint[] AND pg_get_constraintdef(c.oid)='PRIMARY KEY (id)') OR
     NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='TipoContratoCustom_pkey' AND c.conrelid='"TipoContratoCustom"'::regclass AND c.contype='p' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"TipoContratoCustom"'::regclass AND attname='tipoCustomId' AND NOT attisdropped)]::smallint[] AND pg_get_constraintdef(c.oid)='PRIMARY KEY ("tipoCustomId")') THEN
    RAISE EXCEPTION 'Migration 20261022000000 constraint contract mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProductoCostHistory_productoId_fkey' AND contype='f' AND conrelid='"ProductoCostHistory"'::regclass AND confrelid='"Producto"'::regclass AND confdeltype='c' AND confupdtype='c' AND convalidated AND NOT condeferrable AND NOT condeferred AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"ProductoCostHistory"'::regclass AND attname='productoId' AND NOT attisdropped)]::smallint[] AND confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"Producto"'::regclass AND attname='id' AND NOT attisdropped)]::smallint[]) OR
     NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TipoContratoCustom_creadoPor_fkey' AND contype='f' AND conrelid='"TipoContratoCustom"'::regclass AND confrelid='"User"'::regclass AND confdeltype='r' AND confupdtype='c' AND convalidated AND NOT condeferrable AND NOT condeferred AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"TipoContratoCustom"'::regclass AND attname='creadoPor' AND NOT attisdropped)]::smallint[] AND confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"User"'::regclass AND attname='userId' AND NOT attisdropped)]::smallint[]) OR
     NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProductoCostHistory_pkey' AND contype='p' AND conrelid='"ProductoCostHistory"'::regclass) OR
     NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='VendorCodeSequence_pkey' AND contype='p' AND conrelid='"VendorCodeSequence"'::regclass) OR
     NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TipoContratoCustom_pkey' AND contype='p' AND conrelid='"TipoContratoCustom"'::regclass) THEN
    RAISE EXCEPTION 'Migration 20261022000000 constraint contract mismatch';
  END IF;
END $$;

COMMIT;
