/**
 * @description Tests unitarios para el helper de servidor de Cloudinary.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiSignRequestMock, destroyMock, configMock } = vi.hoisted(() => ({
  apiSignRequestMock: vi.fn(() => 'signed-payload'),
  destroyMock: vi.fn(),
  configMock: vi.fn(),
}))

vi.mock('cloudinary', () => ({
  v2: {
    config: configMock,
    utils: {
      api_sign_request: apiSignRequestMock,
    },
    uploader: {
      destroy: destroyMock,
    },
  },
}))

import { destroyCloudinaryAsset, generateUploadSignature } from './cloudinary'

describe('generateUploadSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud')
    vi.stubEnv('CLOUDINARY_API_KEY', 'test-key')
    vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret')
  })

  it('generates signature with valid params', () => {
    const result = generateUploadSignature({
      uploadKey: 'productos.photo',
      folder: 'tenant123/productos',
      resourceType: 'image',
      maxBytes: 2 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg'],
      publicId: 'tenant123/productos/my-photo',
    })

    expect(result).toMatchObject({
      cloudName: 'test-cloud',
      apiKey: 'test-key',
      folder: 'tenant123/productos',
      uploadKey: 'productos.photo',
      resourceType: 'image',
      publicId: 'tenant123/productos/my-photo',
      signature: 'signed-payload',
    })
    expect(apiSignRequestMock).toHaveBeenCalled()
    expect(result.timestamp).toBeGreaterThan(0)
  })

  it('throws error when config is missing', () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', '')

    expect(() =>
      generateUploadSignature({
        uploadKey: 'productos.photo',
        folder: 'folder',
        resourceType: 'image',
        maxBytes: 1,
        allowedMimeTypes: ['image/jpeg'],
        publicId: 'folder/item',
      })
    ).toThrow('Cloudinary configuration missing')
  })

  it('throws error when folder is empty', () => {
    expect(() =>
      generateUploadSignature({
        uploadKey: 'productos.photo',
        folder: '',
        resourceType: 'image',
        maxBytes: 1,
        allowedMimeTypes: ['image/jpeg'],
        publicId: 'folder/item',
      })
    ).toThrow('Folder is required')
  })

  it('throws error when folder is whitespace', () => {
    expect(() =>
      generateUploadSignature({
        uploadKey: 'productos.photo',
        folder: '   ',
        resourceType: 'image',
        maxBytes: 1,
        allowedMimeTypes: ['image/jpeg'],
        publicId: 'folder/item',
      })
    ).toThrow('Folder is required')
  })

  it('includes publicId when provided', () => {
    const result = generateUploadSignature({
      uploadKey: 'productos.photo',
      folder: 'folder',
      resourceType: 'image',
      maxBytes: 1,
      allowedMimeTypes: ['image/jpeg'],
      publicId: 'my-public-id',
    })
    expect(result.publicId).toBe('my-public-id')
  })

  it('uses image as default resourceType', () => {
    const result = generateUploadSignature({
      uploadKey: 'productos.photo',
      folder: 'folder',
      resourceType: 'image',
      maxBytes: 1,
      allowedMimeTypes: ['image/jpeg'],
      publicId: 'folder/item',
    })
    expect(result.cloudName).toBe('test-cloud')
  })
})

describe('destroyCloudinaryAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud')
    vi.stubEnv('CLOUDINARY_API_KEY', 'test-key')
    vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret')
  })

  it('destroys a remote asset with invalidate enabled', async () => {
    destroyMock.mockResolvedValue({ result: 'ok' })

    const result = await destroyCloudinaryAsset({
      publicId: 'tenant-1/productos/photo-1',
      resourceType: 'image',
    })

    expect(result).toEqual({ result: 'ok' })
    expect(destroyMock).toHaveBeenCalledWith('tenant-1/productos/photo-1', {
      resource_type: 'image',
      invalidate: true,
    })
  })

  it('throws when publicId is missing', async () => {
    await expect(
      destroyCloudinaryAsset({ publicId: '', resourceType: 'raw' })
    ).rejects.toThrow('Public ID is required')
  })
})
