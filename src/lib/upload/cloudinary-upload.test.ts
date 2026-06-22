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

  it('uploads file successfully and returns secure_url', async () => {
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
            folder: 'tenant-123/productos',
          })
        )
      )
      // Mock fetch para upload a Cloudinary
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            secure_url: 'https://res.cloudinary.com/test/image.jpg',
            public_id: 'test-id',
          })
        )
      )

    const url = await uploadToCloudinary(mockFile, 'productos')

    expect(url).toBe('https://res.cloudinary.com/test/image.jpg')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('envía el folder relativo al endpoint de firma (sin tenantId)', async () => {
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
            folder: 'tenant-123/clientes/cli-1/logo',
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

    await uploadToCloudinary(mockFile, 'clientes/cli-1/logo')

    // Verificar que el body del POST a /api/upload/sign contiene folder relativo
    const firstCall = fetchMock.mock.calls[0]
    const requestInit = firstCall[1] as RequestInit
    const body = JSON.parse(requestInit.body as string)
    expect(body.folder).toBe('clientes/cli-1/logo')
  })

  it('usa el folder prefijado retornado por el server al subir a Cloudinary', async () => {
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
            folder: 'tenant-123/productos',
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

    await uploadToCloudinary(mockFile, 'productos')

    // Verificar que el FormData enviado a Cloudinary incluye el folder prefijado
    const secondCall = fetchMock.mock.calls[1]
    const formData = secondCall[1].body as FormData
    expect(formData.get('folder')).toBe('tenant-123/productos')
  })

  it('throws error when signature endpoint fails', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 401 })
    )

    await expect(
      uploadToCloudinary(mockFile, 'productos')
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
            folder: 'tenant-123/productos',
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
      uploadToCloudinary(mockFile, 'productos')
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
            folder: 'tenant-123/productos',
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

    await uploadToCloudinary(mockFile, 'productos', { onProgress })

    expect(onProgress).toHaveBeenCalledWith(100)
    expect(onProgress).toHaveBeenCalledTimes(1)
  })
})
