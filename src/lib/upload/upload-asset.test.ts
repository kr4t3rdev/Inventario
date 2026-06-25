import { beforeEach, describe, expect, it, vi } from 'vitest'

import { uploadAsset } from './upload-asset'

vi.mock('./cloudinary-upload', () => ({
  getUploadIntent: vi.fn(),
  uploadToCloudinary: vi.fn(),
  uploadToCloudinaryFromIntent: vi.fn(),
}))

import {
  getUploadIntent,
  uploadToCloudinaryFromIntent,
} from './cloudinary-upload'

describe('uploadAsset', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns a normalized asset contract for cloudinary intents', async () => {
    const file = new File(['logo'], 'logo.png', { type: 'image/png' })

    vi.mocked(getUploadIntent).mockResolvedValue({
      provider: 'cloudinary',
      signature: 'sig',
      timestamp: 123456,
      apiKey: 'key',
      cloudName: 'cloud',
      uploadKey: 'miEmpresa.logo',
      resourceType: 'image',
      folder: 'tenant-1/empresa/logo',
      publicId: 'tenant-1/empresa/logo/logo-file',
      uploadthingRoute: null,
    })

    vi.mocked(uploadToCloudinaryFromIntent).mockResolvedValue({
      uploadKey: 'miEmpresa.logo',
      secureUrl: 'https://res.cloudinary.com/demo/logo.png',
      publicId: 'tenant-1/empresa/logo/logo-file',
      resourceType: 'image',
      bytes: 4,
      mimeType: 'image/png',
      originalFilename: 'logo',
    })

    const result = await uploadAsset(file, {
      uploadKey: 'miEmpresa.logo',
    })

    expect(result).toEqual({
      provider: 'cloudinary',
      uploadKey: 'miEmpresa.logo',
      url: 'https://res.cloudinary.com/demo/logo.png',
      publicId: 'tenant-1/empresa/logo/logo-file',
      resourceType: 'image',
      bytes: 4,
      mimeType: 'image/png',
      originalFilename: 'logo',
    })
  })

  it('rejects uploadthing intents until the uploadthing adapter exists', async () => {
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })

    vi.mocked(getUploadIntent).mockResolvedValue({
      provider: 'uploadthing',
      uploadKey: 'productos.photo',
      resourceType: 'image',
      folder: 'tenant-1/productos',
      publicId: 'tenant-1/productos/photo-file',
      uploadthingRoute: 'productPhoto',
    })

    await expect(
      uploadAsset(file, { uploadKey: 'productos.photo' })
    ).rejects.toThrow(/uploadthing/i)
  })
})
