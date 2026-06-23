/**
 * @description Tests unitarios para POST /api/upload/sign.
 * Verifica autenticación, validación de upload intents/policies,
 * permisos por módulo y generación de firma.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'

// Mockeamos los módulos de server-actions (getCurrentUser) y cloudinary
vi.mock('@/lib/server-actions', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/cloudinary', () => ({
  generateUploadSignature: vi.fn(),
}))

import { getCurrentUser } from '@/lib/server-actions'
import { generateUploadSignature } from '@/lib/cloudinary'

const mockUser = {
  userId: 'user-test-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test-1',
  tenantRole: 'admin',
}

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/upload/sign', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('retorna 200 con firma prefijada con tenantId para folder relativo', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(generateUploadSignature).mockReturnValue({
      signature: 'test-signature',
      timestamp: 1234567890,
      apiKey: 'test-key',
      cloudName: 'test-cloud',
      folder: 'tenant-test-1/productos',
      uploadKey: 'productos.photo',
      resourceType: 'image',
      publicId: 'tenant-test-1/productos/product-photo',
    })

    const request = createRequest({
      uploadKey: 'productos.photo',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      bytes: 1200,
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.signature).toBe('test-signature')
    expect(data.folder).toBe('tenant-test-1/productos')
    expect(generateUploadSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadKey: 'productos.photo',
        folder: 'tenant-test-1/productos',
        resourceType: 'image',
      })
    )
  })

  it('retorna 401 cuando no hay usuario autenticado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const request = createRequest({
      uploadKey: 'productos.photo',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      bytes: 1200,
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('retorna 400 cuando el usuario no tiene tenantId', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...mockUser,
      tenantId: undefined,
    })

    const request = createRequest({
      uploadKey: 'productos.photo',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      bytes: 1200,
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('retorna 400 cuando falta el uploadKey', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

    const request = createRequest({
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      bytes: 1200,
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('retorna 400 cuando el mimeType no es válido para la policy', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

    const request = createRequest({
      uploadKey: 'productos.photo',
      filename: 'photo.pdf',
      mimeType: 'application/pdf',
      bytes: 1200,
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('retorna 400 cuando bytes exceden el máximo permitido', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

    const request = createRequest({
      uploadKey: 'productos.photo',
      filename: 'big.jpg',
      mimeType: 'image/jpeg',
      bytes: 10 * 1024 * 1024,
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('retorna 403 cuando el usuario no tiene el feature requerido', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...mockUser,
      role: 'regularUser',
      planFeatures: { contratos: false },
    })

    const request = createRequest({
      uploadKey: 'contratos.attachment',
      filename: 'contract.pdf',
      mimeType: 'application/pdf',
      bytes: 10_000,
    })
    const response = await POST(request)

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('retorna 200 con contratos.attachment y resourceType raw', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(generateUploadSignature).mockReturnValue({
      signature: 'test-signature',
      timestamp: 1234567890,
      apiKey: 'test-key',
      cloudName: 'test-cloud',
      folder: 'tenant-test-1/contratos/anexos',
      uploadKey: 'contratos.attachment',
      resourceType: 'raw',
      publicId: 'tenant-test-1/contratos/anexos/contract-file',
    })

    const request = createRequest({
      uploadKey: 'contratos.attachment',
      filename: 'contract.pdf',
      mimeType: 'application/pdf',
      bytes: 100_000,
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(generateUploadSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadKey: 'contratos.attachment',
        folder: 'tenant-test-1/contratos/anexos',
        resourceType: 'raw',
      })
    )
  })

  it('retorna 500 cuando generateUploadSignature falla', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(generateUploadSignature).mockImplementation(() => {
      throw new Error('Unexpected error')
    })

    const request = createRequest({
      uploadKey: 'productos.photo',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      bytes: 1200,
    })
    const response = await POST(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toContain('signature')
  })
})
