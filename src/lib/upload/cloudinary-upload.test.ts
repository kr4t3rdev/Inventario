/**
 * @description Tests unitarios para el helper de cliente de Cloudinary.
 * Verifica el flujo de signed upload: obtener firma y subir a Cloudinary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadToCloudinary } from './cloudinary-upload'

describe('uploadToCloudinary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('uploads file successfully and returns secureUrl + publicId', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    // Mock fetch para firma (server retorna folder prefijado con tenantId)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            signature: 'test-sig',
            timestamp: 123456,
            apiKey: 'test-key',
            cloudName: 'test-cloud',
            provider: 'cloudinary',
            uploadKey: 'clientes.logo',
            resourceType: 'image',
            folder: 'tenant-123/clientes/logo',
            publicId: 'tenant-123/clientes/logo/cliente-1',
          })
        )
      )
      // Mock fetch para upload a Cloudinary
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            secure_url: 'https://res.cloudinary.com/test/image.jpg',
            public_id: 'tenant-123/clientes/logo/cliente-1',
            resource_type: 'image',
            bytes: 4,
            original_filename: 'test',
          })
        )
      )

    const result = await uploadToCloudinary(mockFile, {
      uploadKey: 'clientes.logo',
    })

    expect(result.secureUrl).toBe('https://res.cloudinary.com/test/image.jpg')
    expect(result.publicId).toBe('tenant-123/clientes/logo/cliente-1')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('envía el uploadKey y metadata del archivo al endpoint de firma', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            signature: 'test-sig',
            timestamp: 123456,
            apiKey: 'test-key',
            cloudName: 'test-cloud',
            provider: 'cloudinary',
            uploadKey: 'clientes.logo',
            resourceType: 'image',
            folder: 'tenant-123/clientes/logo',
            publicId: 'tenant-123/clientes/logo/cliente-1',
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            secure_url: 'https://res.cloudinary.com/test/image.jpg',
            public_id: 'tenant-123/clientes/logo/cliente-1',
          })
        )
      )

    await uploadToCloudinary(mockFile, {
      uploadKey: 'clientes.logo',
      entityId: 'cli-1',
    })

    const firstCall = fetchMock.mock.calls[0]
    const requestInit = firstCall[1] as RequestInit
    const body = JSON.parse(requestInit.body as string)
    expect(body.uploadKey).toBe('clientes.logo')
    expect(body.entityId).toBe('cli-1')
    expect(body.filename).toBe('test.jpg')
    expect(body.mimeType).toBe('image/jpeg')
  })

  it('usa folder y publicId retornados por el server al subir a Cloudinary', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            signature: 'test-sig',
            timestamp: 123456,
            apiKey: 'test-key',
            cloudName: 'test-cloud',
            provider: 'cloudinary',
            uploadKey: 'clientes.logo',
            resourceType: 'image',
            folder: 'tenant-123/clientes/logo',
            publicId: 'tenant-123/clientes/logo/cliente-1',
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            secure_url: 'https://res.cloudinary.com/test/image.jpg',
            public_id: 'tenant-123/clientes/logo/cliente-1',
          })
        )
      )

    await uploadToCloudinary(mockFile, {
      uploadKey: 'clientes.logo',
    })

    const secondCall = fetchMock.mock.calls[1]
    const formData = secondCall[1].body as FormData
    expect(formData.get('folder')).toBe('tenant-123/clientes/logo')
    expect(formData.get('public_id')).toBe('tenant-123/clientes/logo/cliente-1')
  })

  it('throws error when signature endpoint fails', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 401 })
    )

    await expect(
      uploadToCloudinary(mockFile, { uploadKey: 'productos.photo' })
    ).rejects.toThrow('Failed to get upload signature')
  })

  it('throws error when Cloudinary upload fails', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            signature: 'test-sig',
            timestamp: 123456,
            apiKey: 'test-key',
            cloudName: 'test-cloud',
            provider: 'cloudinary',
            uploadKey: 'clientes.logo',
            resourceType: 'image',
            folder: 'tenant-123/clientes/logo',
            publicId: 'tenant-123/clientes/logo/cliente-1',
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'Invalid signature' } }),
          { status: 400 }
        )
      )

    await expect(
      uploadToCloudinary(mockFile, { uploadKey: 'clientes.logo' })
    ).rejects.toThrow('Cloudinary upload failed')
  })

  it('calls onProgress(100) on success', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const onProgress = vi.fn()

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            signature: 'test-sig',
            timestamp: 123456,
            apiKey: 'test-key',
            cloudName: 'test-cloud',
            provider: 'cloudinary',
            uploadKey: 'clientes.logo',
            resourceType: 'image',
            folder: 'tenant-123/clientes/logo',
            publicId: 'tenant-123/clientes/logo/cliente-1',
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            secure_url: 'https://res.cloudinary.com/test/image.jpg',
            public_id: 'test-id',
          })
        )
      )

    await uploadToCloudinary(mockFile, {
      uploadKey: 'clientes.logo',
      onProgress,
    })

    expect(onProgress).toHaveBeenCalledWith(100)
    expect(onProgress).toHaveBeenCalledTimes(1)
  })

  it('throws when intent provider is not cloudinary', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          provider: 'uploadthing',
          uploadKey: 'productos.photo',
          resourceType: 'image',
          folder: 'tenant-123/productos',
          publicId: 'tenant-123/productos/product-1',
          uploadthingRoute: 'productPhoto',
        })
      )
    )

    await expect(
      uploadToCloudinary(mockFile, { uploadKey: 'productos.photo' })
    ).rejects.toThrow(/cloudinary/i)
  })
})
