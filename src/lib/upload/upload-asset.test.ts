import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toLegacyAssetUploadResult, uploadAsset } from './upload-asset'

vi.mock('./cloudinary-upload', () => ({
  getUploadIntent: vi.fn(),
  uploadToCloudinary: vi.fn(),
  uploadToCloudinaryFromIntent: vi.fn(),
}))

vi.mock('./uploadthing-client', () => ({
  uploadToUploadthing: vi.fn(),
}))

import {
  getUploadIntent,
  uploadToCloudinaryFromIntent,
} from './cloudinary-upload'
import { uploadToUploadthing } from './uploadthing-client'

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

  it('returns a normalized asset contract for uploadthing intents', async () => {
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })

    vi.mocked(getUploadIntent).mockResolvedValue({
      provider: 'uploadthing',
      uploadKey: 'productos.photo',
      resourceType: 'image',
      folder: 'tenant-1/productos',
      publicId: 'tenant-1/productos/photo-file',
      uploadthingRoute: 'productPhoto',
    })

    vi.mocked(uploadToUploadthing).mockResolvedValue({
      provider: 'uploadthing',
      uploadKey: 'productos.photo',
      url: 'https://app.ufs.sh/f/product-photo-key',
      key: 'product-photo-key',
      publicId: 'tenant-1/productos/photo-file',
      resourceType: 'image',
      bytes: 5,
      mimeType: 'image/jpeg',
      originalFilename: 'photo.jpg',
    })

    const result = await uploadAsset(file, { uploadKey: 'productos.photo' })

    expect(result).toEqual({
      provider: 'uploadthing',
      uploadKey: 'productos.photo',
      url: 'https://app.ufs.sh/f/product-photo-key',
      key: 'product-photo-key',
      publicId: 'tenant-1/productos/photo-file',
      resourceType: 'image',
      bytes: 5,
      mimeType: 'image/jpeg',
      originalFilename: 'photo.jpg',
    })
  })

  it('maps uploadthing assets to the legacy persistence shape', () => {
    expect(
      toLegacyAssetUploadResult({
        provider: 'uploadthing',
        uploadKey: 'productos.photo',
        url: 'https://app.ufs.sh/f/product-photo-key',
        key: 'product-photo-key',
        publicId: 'tenant-1/productos/photo-file',
        resourceType: 'image',
        bytes: 5,
        mimeType: 'image/jpeg',
        originalFilename: 'photo.jpg',
      })
    ).toEqual({
      uploadKey: 'productos.photo',
      secureUrl: 'https://app.ufs.sh/f/product-photo-key',
      publicId: 'tenant-1/productos/photo-file',
      resourceType: 'image',
      bytes: 5,
      mimeType: 'image/jpeg',
      originalFilename: 'photo.jpg',
    })
  })
})
