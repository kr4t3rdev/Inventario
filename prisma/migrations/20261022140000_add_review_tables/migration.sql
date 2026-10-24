BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "reviews" (
  "reviewId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "isPositive" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reviews_pkey" PRIMARY KEY ("reviewId"),
  CONSTRAINT "reviews_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reviews_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "review_prompts" (
  "promptId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "promptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),

  CONSTRAINT "review_prompts_pkey" PRIMARY KEY ("promptId"),
  CONSTRAINT "review_prompts_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_prompts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='reviews_tenantId_userId_key' AND n.nspname=current_schema()) THEN
   IF (SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='reviews_tenantId_userId_key' AND n.nspname=current_schema())<>'i' OR
      (SELECT pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='reviews_tenantId_userId_key' AND n.nspname=current_schema()) IS DISTINCT FROM
      'CREATE UNIQUE INDEX "reviews_tenantId_userId_key" ON public.reviews USING btree ("tenantId", "userId")' THEN
     RAISE EXCEPTION 'Index reviews_tenantId_userId_key definition mismatch';
   END IF;
 ELSE
   CREATE UNIQUE INDEX "reviews_tenantId_userId_key" ON "reviews"("tenantId", "userId");
 END IF;
END $$;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='reviews_tenantId_isApproved_idx' AND n.nspname=current_schema()) THEN
   IF (SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='reviews_tenantId_isApproved_idx' AND n.nspname=current_schema())<>'i' OR
      (SELECT pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='reviews_tenantId_isApproved_idx' AND n.nspname=current_schema()) IS DISTINCT FROM
      'CREATE INDEX "reviews_tenantId_isApproved_idx" ON public.reviews USING btree ("tenantId", "isApproved")' THEN
     RAISE EXCEPTION 'Index reviews_tenantId_isApproved_idx definition mismatch';
   END IF;
 ELSE
   CREATE INDEX "reviews_tenantId_isApproved_idx" ON "reviews"("tenantId", "isApproved");
 END IF;
END $$;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='reviews_tenantId_isPositive_isApproved_idx' AND n.nspname=current_schema()) THEN
   IF (SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='reviews_tenantId_isPositive_isApproved_idx' AND n.nspname=current_schema())<>'i' OR
      (SELECT pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='reviews_tenantId_isPositive_isApproved_idx' AND n.nspname=current_schema()) IS DISTINCT FROM
      'CREATE INDEX "reviews_tenantId_isPositive_isApproved_idx" ON public.reviews USING btree ("tenantId", "isPositive", "isApproved")' THEN
     RAISE EXCEPTION 'Index reviews_tenantId_isPositive_isApproved_idx definition mismatch';
   END IF;
 ELSE
   CREATE INDEX "reviews_tenantId_isPositive_isApproved_idx"
  ON "reviews"("tenantId", "isPositive", "isApproved");
 END IF;
END $$;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='review_prompts_tenantId_userId_promptedAt_idx' AND n.nspname=current_schema()) THEN
   IF (SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='review_prompts_tenantId_userId_promptedAt_idx' AND n.nspname=current_schema())<>'i' OR
      (SELECT pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='review_prompts_tenantId_userId_promptedAt_idx' AND n.nspname=current_schema()) IS DISTINCT FROM
      'CREATE INDEX "review_prompts_tenantId_userId_promptedAt_idx" ON public.review_prompts USING btree ("tenantId", "userId", "promptedAt")' THEN
     RAISE EXCEPTION 'Index review_prompts_tenantId_userId_promptedAt_idx definition mismatch';
   END IF;
 ELSE
   CREATE INDEX "review_prompts_tenantId_userId_promptedAt_idx"
  ON "review_prompts"("tenantId", "userId", "promptedAt");
 END IF;
END $$;

DO $$ DECLARE mismatches integer; BEGIN
 SELECT count(*) INTO mismatches FROM (VALUES
 ('reviews','reviewId','text',true,NULL), ('reviews','tenantId','text',true,NULL), ('reviews','userId','text',true,NULL), ('reviews','rating','integer',true,NULL), ('reviews','comment','text',false,NULL), ('reviews','isApproved','boolean',true,'false'), ('reviews','isPositive','boolean',true,NULL), ('reviews','createdAt','timestamp(3) without time zone',true,'CURRENT_TIMESTAMP'), ('reviews','updatedAt','timestamp(3) without time zone',true,NULL), ('review_prompts','promptId','text',true,NULL), ('review_prompts','tenantId','text',true,NULL), ('review_prompts','userId','text',true,NULL), ('review_prompts','promptedAt','timestamp(3) without time zone',true,'CURRENT_TIMESTAMP'), ('review_prompts','dismissedAt','timestamp(3) without time zone',false,NULL), ('review_prompts','submittedAt','timestamp(3) without time zone',false,NULL)
 ) e(tbl,col,typ,nn,def) LEFT JOIN pg_attribute a ON a.attrelid=to_regclass(format('"%s"',e.tbl)) AND a.attname=e.col AND NOT a.attisdropped
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attname IS NULL OR format_type(a.atttypid,a.atttypmod)<>e.typ OR a.attnotnull<>e.nn OR pg_get_expr(d.adbin,d.adrelid) IS DISTINCT FROM e.def;
 IF mismatches<>0 OR (SELECT count(*) FROM pg_attribute WHERE attrelid='"reviews"'::regclass AND attnum>0 AND NOT attisdropped)<>9 OR
(SELECT count(*) FROM pg_attribute WHERE attrelid='"review_prompts"'::regclass AND attnum>0 AND NOT attisdropped)<>6 THEN RAISE EXCEPTION 'm3-guarded table column/default contract mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='reviews_tenantId_fkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"reviews"'::regclass AND c.contype='f' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"reviews"'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confrelid='tenants'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='tenants'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confupdtype='c' AND c.confdeltype='c' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId") ON UPDATE CASCADE ON DELETE CASCADE') THEN RAISE EXCEPTION 'm3-guarded constraint reviews_tenantId_fkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='reviews_userId_fkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"reviews"'::regclass AND c.contype='f' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"reviews"'::regclass AND attname='userId' AND NOT attisdropped)]::smallint[] AND c.confrelid='"User"'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"User"'::regclass AND attname='userId' AND NOT attisdropped)]::smallint[] AND c.confupdtype='c' AND c.confdeltype='c' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("userId") REFERENCES "User"("userId") ON UPDATE CASCADE ON DELETE CASCADE') THEN RAISE EXCEPTION 'm3-guarded constraint reviews_userId_fkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='review_prompts_tenantId_fkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"review_prompts"'::regclass AND c.contype='f' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"review_prompts"'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confrelid='tenants'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='tenants'::regclass AND attname='tenantId' AND NOT attisdropped)]::smallint[] AND c.confupdtype='c' AND c.confdeltype='c' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId") ON UPDATE CASCADE ON DELETE CASCADE') THEN RAISE EXCEPTION 'm3-guarded constraint review_prompts_tenantId_fkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='review_prompts_userId_fkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"review_prompts"'::regclass AND c.contype='f' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"review_prompts"'::regclass AND attname='userId' AND NOT attisdropped)]::smallint[] AND c.confrelid='"User"'::regclass AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"User"'::regclass AND attname='userId' AND NOT attisdropped)]::smallint[] AND c.confupdtype='c' AND c.confdeltype='c' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='FOREIGN KEY ("userId") REFERENCES "User"("userId") ON UPDATE CASCADE ON DELETE CASCADE') THEN RAISE EXCEPTION 'm3-guarded constraint review_prompts_userId_fkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='reviews_pkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"reviews"'::regclass AND c.contype='p' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"reviews"'::regclass AND attname='reviewId' AND NOT attisdropped)]::smallint[] AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='PRIMARY KEY ("reviewId")') THEN RAISE EXCEPTION 'm3-guarded constraint reviews_pkey mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname='review_prompts_pkey' AND c.connamespace=current_schema()::regnamespace AND c.conrelid='"review_prompts"'::regclass AND c.contype='p' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='"review_prompts"'::regclass AND attname='promptId' AND NOT attisdropped)]::smallint[] AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred AND pg_get_constraintdef(c.oid)='PRIMARY KEY ("promptId")') THEN RAISE EXCEPTION 'm3-guarded constraint review_prompts_pkey mismatch'; END IF;

END $$;

COMMIT;
