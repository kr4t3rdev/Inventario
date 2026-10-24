BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "OrdenProduccionHistorial" (
  "ordenProduccionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "estadoAnterior" TEXT NOT NULL,
  "estadoNuevo" TEXT NOT NULL,
  "observaciones" TEXT,
  "usuarioId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,

  CONSTRAINT "OrdenProduccionHistorial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrdenProduccionHistorial_ordenProduccionId_fkey"
    FOREIGN KEY ("ordenProduccionId") REFERENCES "OrdenProduccion"("ordenProduccionId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrdenProduccionHistorial_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ValeSalida" (
  "valeSalidaId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "concepto" VARCHAR(200) NOT NULL,
  "observaciones" VARCHAR(1000),
  "estado" TEXT NOT NULL DEFAULT 'COMPLETADO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ValeSalida_pkey" PRIMARY KEY ("valeSalidaId"),
  CONSTRAINT "ValeSalida_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ValeSalidaItem" (
  "valeSalidaItemId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "valeSalidaId" TEXT NOT NULL,
  "productoId" TEXT NOT NULL,
  "cantidad" INTEGER NOT NULL,
  "sourceTipoUbicacion" TEXT,
  "sourceUbicacionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ValeSalidaItem_pkey" PRIMARY KEY ("valeSalidaItemId"),
  CONSTRAINT "ValeSalidaItem_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ValeSalidaItem_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ValeSalidaItem_valeSalidaId_fkey"
    FOREIGN KEY ("valeSalidaId") REFERENCES "ValeSalida"("valeSalidaId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='"ValeSalidaItem"'::regclass AND attname='sourceTipoUbicacion' AND NOT attisdropped) THEN
   IF (SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='"ValeSalidaItem"'::regclass AND attname='sourceTipoUbicacion' AND NOT attisdropped)<>'text' OR
      (SELECT attnotnull FROM pg_attribute WHERE attrelid='"ValeSalidaItem"'::regclass AND attname='sourceTipoUbicacion' AND NOT attisdropped) THEN
     RAISE EXCEPTION 'ValeSalidaItem.sourceTipoUbicacion type/nullability mismatch';
   END IF;
 ELSE
   ALTER TABLE "ValeSalidaItem" ADD COLUMN "sourceTipoUbicacion" text;
 END IF;
END $$;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='"ValeSalidaItem"'::regclass AND attname='sourceUbicacionId' AND NOT attisdropped) THEN
   IF (SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='"ValeSalidaItem"'::regclass AND attname='sourceUbicacionId' AND NOT attisdropped)<>'text' OR
      (SELECT attnotnull FROM pg_attribute WHERE attrelid='"ValeSalidaItem"'::regclass AND attname='sourceUbicacionId' AND NOT attisdropped) THEN
     RAISE EXCEPTION 'ValeSalidaItem.sourceUbicacionId type/nullability mismatch';
   END IF;
 ELSE
   ALTER TABLE "ValeSalidaItem" ADD COLUMN "sourceUbicacionId" text;
 END IF;
END $$;

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='OrdenProduccionHistorial_tenantId_idx' AND n.nspname=current_schema()) THEN
   IF (SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='OrdenProduccionHistorial_tenantId_idx' AND n.nspname=current_schema())<>'i' OR
      (SELECT pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='OrdenProduccionHistorial_tenantId_idx' AND n.nspname=current_schema()) IS DISTINCT FROM
      'CREATE INDEX "OrdenProduccionHistorial_tenantId_idx" ON public."OrdenProduccionHistorial" USING btree ("tenantId")' THEN
     RAISE EXCEPTION 'Index OrdenProduccionHistorial_tenantId_idx definition mismatch';
   END IF;
 ELSE
   CREATE INDEX "OrdenProduccionHistorial_tenantId_idx" ON "OrdenProduccionHistorial"("tenantId");
 END IF;
END $$;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='ValeSalida_tenantId_idx' AND n.nspname=current_schema()) THEN
   IF (SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='ValeSalida_tenantId_idx' AND n.nspname=current_schema())<>'i' OR
      (SELECT pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='ValeSalida_tenantId_idx' AND n.nspname=current_schema()) IS DISTINCT FROM
      'CREATE INDEX "ValeSalida_tenantId_idx" ON public."ValeSalida" USING btree ("tenantId")' THEN
     RAISE EXCEPTION 'Index ValeSalida_tenantId_idx definition mismatch';
   END IF;
 ELSE
   CREATE INDEX "ValeSalida_tenantId_idx" ON "ValeSalida"("tenantId");
 END IF;
END $$;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='ValeSalidaItem_tenantId_idx' AND n.nspname=current_schema()) THEN
   IF (SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='ValeSalidaItem_tenantId_idx' AND n.nspname=current_schema())<>'i' OR
      (SELECT pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='ValeSalidaItem_tenantId_idx' AND n.nspname=current_schema()) IS DISTINCT FROM
      'CREATE INDEX "ValeSalidaItem_tenantId_idx" ON public."ValeSalidaItem" USING btree ("tenantId")' THEN
     RAISE EXCEPTION 'Index ValeSalidaItem_tenantId_idx definition mismatch';
   END IF;
 ELSE
   CREATE INDEX "ValeSalidaItem_tenantId_idx" ON "ValeSalidaItem"("tenantId");
 END IF;
END $$;

DO $$ DECLARE mismatches integer; BEGIN
 SELECT count(*) INTO mismatches FROM (VALUES
 ('OrdenProduccionHistorial','ordenProduccionId','text',true,NULL), ('OrdenProduccionHistorial','tenantId','text',true,NULL), ('OrdenProduccionHistorial','estadoAnterior','text',true,NULL), ('OrdenProduccionHistorial','estadoNuevo','text',true,NULL), ('OrdenProduccionHistorial','observaciones','text',false,NULL), ('OrdenProduccionHistorial','usuarioId','text',false,NULL), ('OrdenProduccionHistorial','createdAt','timestamp(3) without time zone',true,'CURRENT_TIMESTAMP'), ('OrdenProduccionHistorial','id','text',true,'(gen_random_uuid())::text'), ('ValeSalida','valeSalidaId','text',true,NULL), ('ValeSalida','tenantId','text',true,NULL), ('ValeSalida','concepto','character varying(200)',true,NULL), ('ValeSalida','observaciones','character varying(1000)',false,NULL), ('ValeSalida','estado','text',true,'''COMPLETADO''::text'), ('ValeSalida','createdAt','timestamp(3) without time zone',true,'CURRENT_TIMESTAMP'), ('ValeSalida','updatedAt','timestamp(3) without time zone',true,NULL), ('ValeSalidaItem','valeSalidaItemId','text',true,NULL), ('ValeSalidaItem','tenantId','text',true,NULL), ('ValeSalidaItem','valeSalidaId','text',true,NULL), ('ValeSalidaItem','productoId','text',true,NULL), ('ValeSalidaItem','cantidad','integer',true,NULL), ('ValeSalidaItem','sourceTipoUbicacion','text',false,NULL), ('ValeSalidaItem','sourceUbicacionId','text',false,NULL), ('ValeSalidaItem','createdAt','timestamp(3) without time zone',true,'CURRENT_TIMESTAMP')
 ) e(tbl,col,typ,nn,def) LEFT JOIN pg_attribute a ON a.attrelid=to_regclass(format('"%s"',e.tbl)) AND a.attname=e.col AND NOT a.attisdropped
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attname IS NULL OR format_type(a.atttypid,a.atttypmod)<>e.typ OR a.attnotnull<>e.nn OR pg_get_expr(d.adbin,d.adrelid) IS DISTINCT FROM e.def;
 IF mismatches<>0 OR (SELECT count(*) FROM pg_attribute WHERE attrelid='"OrdenProduccionHistorial"'::regclass AND attnum>0 AND NOT attisdropped)<>8 OR
(SELECT count(*) FROM pg_attribute WHERE attrelid='"ValeSalida"'::regclass AND attnum>0 AND NOT attisdropped)<>7 OR
(SELECT count(*) FROM pg_attribute WHERE attrelid='"ValeSalidaItem"'::regclass AND attnum>0 AND NOT attisdropped)<>8 THEN RAISE EXCEPTION 'm2-guarded table column/default contract mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='OrdenProduccionHistorial_ordenProduccionId_fkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"OrdenProduccionHistorial"'::regclass AND c.contype='f' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"OrdenProduccionHistorial"'::regclass AND attname='ordenProduccionId' AND NOT attisdropped)]::smallint[] AND c.confrelid='"OrdenProduccion"'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"OrdenProduccion"'::regclass AND attname='ordenProduccionId' AND NOT attisdropped)]::smallint[] AND c.confupdtype='c' AND c.confdeltype='c' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("ordenProduccionId") REFERENCES "OrdenProduccion"("ordenProduccionId") ON UPDATE CASCADE ON DELETE CASCADE') THEN RAISE EXCEPTION 'm2-guarded constraint OrdenProduccionHistorial_ordenProduccionId_fkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='OrdenProduccionHistorial_tenantId_fkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"OrdenProduccionHistorial"'::regclass AND c.contype='f' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"OrdenProduccionHistorial"'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confrelid='tenants'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='tenants'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confupdtype='c' AND c.confdeltype='r' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId") ON UPDATE CASCADE ON DELETE RESTRICT') THEN RAISE EXCEPTION 'm2-guarded constraint OrdenProduccionHistorial_tenantId_fkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='ValeSalida_tenantId_fkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"ValeSalida"'::regclass AND c.contype='f' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"ValeSalida"'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confrelid='tenants'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='tenants'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confupdtype='c' AND c.confdeltype='r' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId") ON UPDATE CASCADE ON DELETE RESTRICT') THEN RAISE EXCEPTION 'm2-guarded constraint ValeSalida_tenantId_fkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='ValeSalidaItem_productoId_fkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"ValeSalidaItem"'::regclass AND c.contype='f' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"ValeSalidaItem"'::regclass AND attname='productoId' AND NOT attisdropped)]::smallint[] AND c.confrelid='"Producto"'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"Producto"'::regclass AND attname='id' AND NOT attisdropped)]::smallint[] AND c.confupdtype='c' AND c.confdeltype='c' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("productoId") REFERENCES "Producto"(id) ON UPDATE CASCADE ON DELETE CASCADE') THEN RAISE EXCEPTION 'm2-guarded constraint ValeSalidaItem_productoId_fkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='ValeSalidaItem_tenantId_fkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"ValeSalidaItem"'::regclass AND c.contype='f' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"ValeSalidaItem"'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confrelid='tenants'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='tenants'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confupdtype='c' AND c.confdeltype='r' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId") ON UPDATE CASCADE ON DELETE RESTRICT') THEN RAISE EXCEPTION 'm2-guarded constraint ValeSalidaItem_tenantId_fkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='ValeSalidaItem_valeSalidaId_fkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"ValeSalidaItem"'::regclass AND c.contype='f' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"ValeSalidaItem"'::regclass AND attname='valeSalidaId' AND NOT attisdropped)]::smallint[] AND c.confrelid='"ValeSalida"'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"ValeSalida"'::regclass AND attname='valeSalidaId' AND NOT attisdropped)]::smallint[] AND c.confupdtype='c' AND c.confdeltype='c' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("valeSalidaId") REFERENCES "ValeSalida"("valeSalidaId") ON UPDATE CASCADE ON DELETE CASCADE') THEN RAISE EXCEPTION 'm2-guarded constraint ValeSalidaItem_valeSalidaId_fkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='OrdenProduccionHistorial_pkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"OrdenProduccionHistorial"'::regclass AND c.contype='p' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"OrdenProduccionHistorial"'::regclass AND attname='id' AND NOT attisdropped)]::smallint[] AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='PRIMARY KEY (id)') THEN RAISE EXCEPTION 'm2-guarded constraint OrdenProduccionHistorial_pkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='ValeSalida_pkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"ValeSalida"'::regclass AND c.contype='p' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"ValeSalida"'::regclass AND attname='valeSalidaId' AND NOT attisdropped)]::smallint[] AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='PRIMARY KEY ("valeSalidaId")') THEN RAISE EXCEPTION 'm2-guarded constraint ValeSalida_pkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='ValeSalidaItem_pkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"ValeSalidaItem"'::regclass AND c.contype='p' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"ValeSalidaItem"'::regclass AND attname='valeSalidaItemId' AND NOT attisdropped)]::smallint[] AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='PRIMARY KEY ("valeSalidaItemId")') THEN RAISE EXCEPTION 'm2-guarded constraint ValeSalidaItem_pkey mismatch'; END IF;

END $$;

COMMIT;
