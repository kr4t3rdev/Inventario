CREATE TABLE "MobileProductSyncCursor" (
    "tenantId" TEXT NOT NULL,
    "lastSequence" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "MobileProductSyncCursor_pkey" PRIMARY KEY ("tenantId"),
    CONSTRAINT "MobileProductSyncCursor_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MobileProductSyncChange" (
    "tenantId" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "productId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobileProductSyncChange_pkey" PRIMARY KEY ("tenantId", "sequence"),
    CONSTRAINT "MobileProductSyncChange_operation_check"
        CHECK ("operation" IN ('UPSERT', 'DELETE')),
    CONSTRAINT "MobileProductSyncChange_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MobileProductSyncChange_tenantId_changedAt_idx"
    ON "MobileProductSyncChange"("tenantId", "changedAt");

CREATE FUNCTION "record_mobile_product_sync_change"(
    "p_tenantId" TEXT,
    "p_productId" TEXT,
    "p_operation" TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    next_sequence BIGINT;
BEGIN
    INSERT INTO "MobileProductSyncCursor" ("tenantId", "lastSequence")
    VALUES ("p_tenantId", 1)
    ON CONFLICT ("tenantId")
    DO UPDATE SET "lastSequence" = "MobileProductSyncCursor"."lastSequence" + 1
    RETURNING "lastSequence" INTO next_sequence;

    INSERT INTO "MobileProductSyncChange" ("tenantId", "sequence", "productId", "operation")
    VALUES ("p_tenantId", next_sequence, "p_productId", "p_operation");
END;
$$;

CREATE FUNCTION "journal_mobile_product_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM "record_mobile_product_sync_change"(OLD."tenantId", OLD."id", 'DELETE');
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE'
       AND (OLD."tenantId" IS DISTINCT FROM NEW."tenantId"
            OR OLD."id" IS DISTINCT FROM NEW."id") THEN
        PERFORM "record_mobile_product_sync_change"(OLD."tenantId", OLD."id", 'DELETE');
    END IF;

    PERFORM "record_mobile_product_sync_change"(NEW."tenantId", NEW."id", 'UPSERT');
    RETURN NEW;
END;
$$;

CREATE TRIGGER "Producto_mobile_product_sync_journal"
AFTER INSERT OR UPDATE OR DELETE ON "Producto"
FOR EACH ROW EXECUTE FUNCTION "journal_mobile_product_change"();

CREATE FUNCTION "journal_mobile_stock_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- A product cascade must leave the terminal product tombstone as the last event.
        IF EXISTS (
            SELECT 1 FROM "Producto"
            WHERE "id" = OLD."productoId" AND "tenantId" = OLD."tenantId"
        ) THEN
            PERFORM "record_mobile_product_sync_change"(
                OLD."tenantId", OLD."productoId", 'UPSERT'
            );
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE'
       AND (OLD."tenantId" IS DISTINCT FROM NEW."tenantId"
            OR OLD."productoId" IS DISTINCT FROM NEW."productoId") THEN
        PERFORM "record_mobile_product_sync_change"(
            OLD."tenantId", OLD."productoId", 'UPSERT'
        );
    END IF;

    PERFORM "record_mobile_product_sync_change"(
        NEW."tenantId", NEW."productoId", 'UPSERT'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER "StockUbicacion_mobile_product_sync_journal"
AFTER INSERT OR UPDATE OR DELETE ON "StockUbicacion"
FOR EACH ROW EXECUTE FUNCTION "journal_mobile_stock_change"();
