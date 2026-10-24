BEGIN;
SET LOCAL lock_timeout='5s';

DO $$ DECLARE att smallint; BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='TipoContratoCustom' AND n.nspname=current_schema() AND c.relkind='r') THEN
   RAISE EXCEPTION 'TipoContratoCustom must be a table';
 END IF;
 SELECT attnum INTO att FROM pg_attribute WHERE attrelid='"TipoContratoCustom"'::regclass AND attname='tenantId' AND NOT attisdropped;
 IF att IS NULL THEN
   ALTER TABLE "TipoContratoCustom" ADD COLUMN "tenantId" TEXT;
 ELSE
   IF (SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='"TipoContratoCustom"'::regclass AND attname='tenantId' AND NOT attisdropped)<>'text' OR
      (SELECT attnotnull FROM pg_attribute WHERE attrelid='"TipoContratoCustom"'::regclass AND attname='tenantId' AND NOT attisdropped) THEN
     RAISE EXCEPTION 'TipoContratoCustom.tenantId must be nullable TEXT';
   END IF;
 END IF;
 IF EXISTS (SELECT 1 FROM "TipoContratoCustom" t LEFT JOIN tenants n ON n."tenantId"=t."tenantId" WHERE t."tenantId" IS NOT NULL AND n."tenantId" IS NULL) THEN
   RAISE EXCEPTION 'TipoContratoCustom has tenantId values without a matching tenant';
 END IF;
END $$;

DO $$ DECLARE
 tenant_att smallint;
 tenant_ref_att smallint;
 target_relation oid := '"TipoContratoCustom"'::regclass;
 tenant_relation oid := 'tenants'::regclass;
BEGIN
 SELECT attnum INTO tenant_att FROM pg_attribute
  WHERE attrelid=target_relation AND attname='tenantId' AND NOT attisdropped;
 SELECT attnum INTO tenant_ref_att FROM pg_attribute
  WHERE attrelid=tenant_relation AND attname='tenantId' AND NOT attisdropped;
 IF tenant_att IS NULL OR tenant_ref_att IS NULL THEN
   RAISE EXCEPTION 'TipoContratoCustom tenant foreign key columns are missing';
 END IF;

 IF EXISTS (
   SELECT 1 FROM pg_constraint c
   WHERE c.conname='TipoContratoCustom_tenantId_fkey'
     AND c.connamespace=current_schema()::regnamespace
     AND c.conrelid=target_relation
 ) THEN
   IF NOT EXISTS (
     SELECT 1 FROM pg_constraint c
     WHERE c.conname='TipoContratoCustom_tenantId_fkey'
       AND c.connamespace=current_schema()::regnamespace
       AND c.conrelid=target_relation
       AND c.contype='f'
       AND c.conkey=ARRAY[tenant_att]::smallint[]
       AND c.confrelid=tenant_relation
       AND c.confkey=ARRAY[tenant_ref_att]::smallint[]
       AND c.confupdtype='c'
       AND c.confdeltype='n'
       AND c.convalidated
       AND NOT c.condeferrable
       AND NOT c.condeferred
       AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId") ON UPDATE CASCADE ON DELETE SET NULL'
   ) THEN
     RAISE EXCEPTION 'TipoContratoCustom_tenantId_fkey definition mismatch';
   END IF;
 ELSE
   ALTER TABLE "TipoContratoCustom" ADD CONSTRAINT "TipoContratoCustom_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId") ON DELETE SET NULL ON UPDATE CASCADE;
 END IF;
END $$;

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='TipoContratoCustom_tenantId_idx' AND n.nspname=current_schema()) THEN
   IF (SELECT pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='TipoContratoCustom_tenantId_idx' AND n.nspname=current_schema()) IS DISTINCT FROM
      'CREATE INDEX "TipoContratoCustom_tenantId_idx" ON public."TipoContratoCustom" USING btree ("tenantId")' THEN RAISE EXCEPTION 'TipoContratoCustom_tenantId_idx definition mismatch'; END IF;
 ELSE
   CREATE INDEX "TipoContratoCustom_tenantId_idx" ON "TipoContratoCustom"("tenantId");
 END IF;
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='TipoContratoCustom_tenantId_nombre_key' AND n.nspname=current_schema()) THEN
   IF (SELECT pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='TipoContratoCustom_tenantId_nombre_key' AND n.nspname=current_schema()) IS DISTINCT FROM
      'CREATE UNIQUE INDEX "TipoContratoCustom_tenantId_nombre_key" ON public."TipoContratoCustom" USING btree ("tenantId", nombre)' THEN RAISE EXCEPTION 'TipoContratoCustom_tenantId_nombre_key definition mismatch'; END IF;
 ELSE
   CREATE UNIQUE INDEX "TipoContratoCustom_tenantId_nombre_key" ON "TipoContratoCustom"("tenantId", "nombre");
 END IF;
END $$;

DO $$ DECLARE att smallint; BEGIN
 SELECT attnum INTO att FROM pg_attribute WHERE attrelid='"TipoContratoCustom"'::regclass AND attname='nombre' AND NOT attisdropped;
 IF att IS NULL THEN RAISE EXCEPTION 'TipoContratoCustom.nombre missing'; END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.contype='f' AND c.confrelid='"TipoContratoCustom"'::regclass AND att=ANY(c.confkey) AND c.conindid=(SELECT oid FROM pg_class WHERE relname='TipoContratoCustom_nombre_key')) THEN
   RAISE EXCEPTION 'Legacy name uniqueness is constraint-backed; refusing index drop';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.contype='f' AND c.confrelid='"TipoContratoCustom"'::regclass AND att=ANY(c.confkey)) THEN
   RAISE EXCEPTION 'TipoContratoCustom.nombre is referenced by a foreign key';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace WHERE i.relname='TipoContratoCustom_nombre_key' AND n.nspname=current_schema()) THEN
   IF (SELECT pg_get_indexdef(i.oid) FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace WHERE i.relname='TipoContratoCustom_nombre_key' AND n.nspname=current_schema()) IS DISTINCT FROM
      'CREATE UNIQUE INDEX "TipoContratoCustom_nombre_key" ON public."TipoContratoCustom" USING btree (nombre)' THEN
     RAISE EXCEPTION 'Legacy global unique index definition mismatch';
   END IF;
   DROP INDEX "TipoContratoCustom_nombre_key";
 END IF;
END $$;
COMMIT;
