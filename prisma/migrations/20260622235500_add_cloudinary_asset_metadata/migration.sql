CREATE TABLE "CloudinaryAsset" (
    "assetId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "position" INTEGER,
    "resourceType" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "bytes" INTEGER,
    "mimeType" TEXT,
    "originalFilename" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudinaryAsset_pkey" PRIMARY KEY ("assetId")
);

CREATE UNIQUE INDEX "CloudinaryAsset_publicId_key" ON "CloudinaryAsset"("publicId");
CREATE INDEX "CloudinaryAsset_tenantId_ownerType_ownerId_slot_idx" ON "CloudinaryAsset"("tenantId", "ownerType", "ownerId", "slot");
CREATE INDEX "CloudinaryAsset_tenantId_status_idx" ON "CloudinaryAsset"("tenantId", "status");
