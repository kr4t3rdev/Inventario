import { beforeEach, describe, expect, it, vi } from 'vitest'

import { uploadToUploadthing } from './uploadthing-client'

vi.mock('uploadthing/client', () => ({
  genUploader: vi.fn(() => ({
    uploadFiles: vi.fn(),
  })),
}))

import { genUploader } from 'uploadthing/client'

describe('uploadToUploadthing', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('uploads a file using the intent route metadata and normalizes the response', async () => {
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    const uploadFiles = vi.fn().mockResolvedValue([
      {
        key: 'product-photo-key',
        customId: 'tenant-1/productos/photo-file',
        url: 'https://deprecated.utfs.io/f/product-photo-key',
        ufsUrl: 'https://inventario-app.ufs.sh/f/product-photo-key',
        appUrl: 'https://inventario-app.ufs.sh/f/product-photo-key',
        fileHash: 'hash',
        name: 'photo.jpg',
        size: 5,
        type: 'image/jpeg',
        serverData: {
          provider: 'uploadthing',
          uploadKey: 'productos.photo',
          publicId: 'tenant-1/productos/photo-file',
        },
      },
    ])

    vi.mocked(genUploader).mockReturnValue({ uploadFiles } as never)

    const result = await uploadToUploadthing(file, {
      provider: 'uploadthing',
      uploadKey: 'productos.photo',
      resourceType: 'image',
      folder: 'tenant-1/productos',
      publicId: 'tenant-1/productos/photo-file',
      uploadthingRoute: 'productPhoto',
    })

    expect(uploadFiles).toHaveBeenCalledWith('productPhoto', expect.objectContaining({
      files: [file],
      input: {
        uploadKey: 'productos.photo',
        resourceType: 'image',
        folder: 'tenant-1/productos',
        publicId: 'tenant-1/productos/photo-file',
      },
    }))

    expect(result).toEqual({
      provider: 'uploadthing',
      uploadKey: 'productos.photo',
      url: 'https://inventario-app.ufs.sh/f/product-photo-key',
      key: 'product-photo-key',
      publicId: 'tenant-1/productos/photo-file',
      resourceType: 'image',
      bytes: 5,
      mimeType: 'image/jpeg',
      originalFilename: 'photo.jpg',
    })
  })
})
