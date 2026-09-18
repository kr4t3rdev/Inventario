import { prisma } from '@/lib/prisma'
import type { CloudinaryAssetInput } from './cloudinary-asset'

export interface ReplaceOwnerAssetInput {
  tenantId: string
  ownerType: string
  ownerId: string
  slot: string
  asset: CloudinaryAssetInput
  position?: number | null
}

export interface StaleCloudinaryAsset {
  publicId: string
  resourceType: string
}

export interface RecordOwnerAssetInput {
  tenantId: string
  ownerType: string
  ownerId: string
  slot: string
  asset: CloudinaryAssetInput
  position?: number | null
}

export interface SyncOwnerAssetsInput {
  tenantId: string
  ownerType: string
  ownerId: string
  slot: string
  assets: CloudinaryAssetInput[]
}

export async function replaceOwnerAsset(
  input: ReplaceOwnerAssetInput
): Promise<StaleCloudinaryAsset[]> {
  return prisma.$transaction(async (tx) => {
    const staleAssets = await tx.cloudinaryAsset.findMany({
      where: {
        tenantId: input.tenantId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        slot: input.slot,
        status: 'active',
      },
      select: {
        publicId: true,
        resourceType: true,
      },
    })

    await tx.cloudinaryAsset.updateMany({
      where: {
        tenantId: input.tenantId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        slot: input.slot,
        status: 'active',
      },
      data: {
        status: 'replaced',
      },
    })

    await tx.cloudinaryAsset.create({
      data: {
        tenantId: input.tenantId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        slot: input.slot,
        position: input.position ?? null,
        resourceType: input.asset.resourceType,
        publicId: input.asset.publicId,
        secureUrl: input.asset.secureUrl,
        bytes: input.asset.bytes,
        mimeType: input.asset.mimeType,
        originalFilename: input.asset.originalFilename,
        status: 'active',
      },
    })

    return staleAssets
  })
}

export async function recordOwnerAsset(input: RecordOwnerAssetInput): Promise<void> {
  await prisma.cloudinaryAsset.create({
    data: {
      tenantId: input.tenantId,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      slot: input.slot,
      position: input.position ?? null,
      resourceType: input.asset.resourceType,
      publicId: input.asset.publicId,
      secureUrl: input.asset.secureUrl,
      bytes: input.asset.bytes,
      mimeType: input.asset.mimeType,
      originalFilename: input.asset.originalFilename,
      status: 'active',
    },
  })
}

export async function syncOwnerAssets(
  input: SyncOwnerAssetsInput
): Promise<StaleCloudinaryAsset[]> {
  return prisma.$transaction(async (tx) => {
    const existingAssets = await tx.cloudinaryAsset.findMany({
      where: {
        tenantId: input.tenantId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        slot: input.slot,
        status: 'active',
      },
      select: {
        publicId: true,
        resourceType: true,
        position: true,
      },
    })

    const nextPublicIds = new Set(input.assets.map((asset) => asset.publicId))
    const staleAssets = existingAssets.filter(
      (asset: { publicId: string }) => !nextPublicIds.has(asset.publicId)
    )

    if (staleAssets.length > 0) {
      await tx.cloudinaryAsset.updateMany({
        where: {
          publicId: {
            in: staleAssets.map((asset: { publicId: string }) => asset.publicId),
          },
        },
        data: {
          status: 'replaced',
        },
      })
    }

    for (const [position, asset] of input.assets.entries()) {
      const existingAsset = existingAssets.find(
        (current: { publicId: string }) => current.publicId === asset.publicId
      )

      if (existingAsset) {
        if (existingAsset.position !== position) {
          await tx.cloudinaryAsset.update({
            where: { publicId: asset.publicId },
            data: {
              position,
            },
          })
        }
        continue
      }

      await tx.cloudinaryAsset.create({
        data: {
          tenantId: input.tenantId,
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          slot: input.slot,
          position,
          resourceType: asset.resourceType,
          publicId: asset.publicId,
          secureUrl: asset.secureUrl,
          bytes: asset.bytes,
          mimeType: asset.mimeType,
          originalFilename: asset.originalFilename,
          status: 'active',
        },
      })
    }

    return staleAssets.map((asset: { publicId: string; resourceType: string }) => ({
      publicId: asset.publicId,
      resourceType: asset.resourceType,
    }))
  })
}
