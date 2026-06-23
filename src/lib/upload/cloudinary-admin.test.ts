import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findManyMock,
  updateManyMock,
  createMock,
  updateMock,
  transactionMock,
} = vi.hoisted(() => {
  const findManyMock = vi.fn()
  const updateManyMock = vi.fn()
  const createMock = vi.fn()
  const updateMock = vi.fn()
  const transactionMock = vi.fn(async (callback: (tx: any) => Promise<unknown>) =>
    callback({
      cloudinaryAsset: {
        findMany: findManyMock,
        updateMany: updateManyMock,
        create: createMock,
        update: updateMock,
      },
    })
  )

  return {
    findManyMock,
    updateManyMock,
    createMock,
    updateMock,
    transactionMock,
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: transactionMock,
    cloudinaryAsset: {
      create: createMock,
      update: updateMock,
    },
  },
}))

import { replaceOwnerAsset } from './cloudinary-admin'
import { recordOwnerAsset } from './cloudinary-admin'
import { syncOwnerAssets } from './cloudinary-admin'

describe('replaceOwnerAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findManyMock.mockResolvedValue([
      { publicId: 'tenant-1/vendors/logo/old', resourceType: 'image' },
    ])
    updateManyMock.mockResolvedValue({ count: 1 })
    createMock.mockResolvedValue({ assetId: 'asset-1' })
    updateMock.mockResolvedValue({ assetId: 'asset-1' })
  })

  it('marks previous asset as replaced and creates the new one', async () => {
    const staleAssets = await replaceOwnerAsset({
      tenantId: 'tenant-1',
      ownerType: 'vendor',
      ownerId: 'vendor-1',
      slot: 'logo',
      asset: {
        uploadKey: 'vendors.logo',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/new.png',
        publicId: 'tenant-1/vendors/logo/new',
        resourceType: 'image',
        bytes: 1234,
        mimeType: 'image/png',
        originalFilename: 'new',
      },
    })

    expect(staleAssets).toEqual([
      { publicId: 'tenant-1/vendors/logo/old', resourceType: 'image' },
    ])
    expect(updateManyMock).toHaveBeenCalled()
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          ownerType: 'vendor',
          ownerId: 'vendor-1',
          slot: 'logo',
          publicId: 'tenant-1/vendors/logo/new',
        }),
      })
    )
  })

  it('records a multi-asset owner entry without replacing existing ones', async () => {
    createMock.mockResolvedValue({ assetId: 'asset-2' })

    await recordOwnerAsset({
      tenantId: 'tenant-1',
      ownerType: 'contratoArchivo',
      ownerId: 'archivo-1',
      slot: 'attachment',
      asset: {
        uploadKey: 'contratos.attachment',
        secureUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/file.pdf',
        publicId: 'tenant-1/contratos/anexos/file',
        resourceType: 'raw',
        bytes: 2048,
        mimeType: 'application/pdf',
        originalFilename: 'file',
      },
    })

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerType: 'contratoArchivo',
          ownerId: 'archivo-1',
          slot: 'attachment',
        }),
      })
    )
  })
})

describe('syncOwnerAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findManyMock.mockResolvedValue([
      { publicId: 'tenant-1/productos/old', resourceType: 'image', position: 0 },
      { publicId: 'tenant-1/productos/keep', resourceType: 'image', position: 2 },
    ])
    updateManyMock.mockResolvedValue({ count: 1 })
    createMock.mockResolvedValue({ assetId: 'asset-3' })
    updateMock.mockResolvedValue({ assetId: 'asset-4' })
  })

  it('replaces stale assets, reorders kept ones and creates missing entries', async () => {
    const staleAssets = await syncOwnerAssets({
      tenantId: 'tenant-1',
      ownerType: 'producto',
      ownerId: 'product-1',
      slot: 'photo',
      assets: [
        {
          uploadKey: 'productos.photo',
          secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/keep.png',
          publicId: 'tenant-1/productos/keep',
          resourceType: 'image',
          bytes: 123,
          mimeType: 'image/png',
          originalFilename: 'keep',
        },
        {
          uploadKey: 'productos.photo',
          secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/new.png',
          publicId: 'tenant-1/productos/new',
          resourceType: 'image',
          bytes: 456,
          mimeType: 'image/png',
          originalFilename: 'new',
        },
      ],
    })

    expect(staleAssets).toEqual([
      { publicId: 'tenant-1/productos/old', resourceType: 'image' },
    ])
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          publicId: { in: ['tenant-1/productos/old'] },
        }),
      })
    )
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publicId: 'tenant-1/productos/keep' },
        data: { position: 0 },
      })
    )
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerType: 'producto',
          ownerId: 'product-1',
          position: 1,
          publicId: 'tenant-1/productos/new',
        }),
      })
    )
  })
})
