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

    const request = createRequest({
      uploadKey: 'productos.photo',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      bytes: 1200,
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.provider).toBe('uploadthing')
    expect(data.folder).toBe('tenant-test-1/productos')
    expect(data.uploadthingRoute).toBe('productPhoto')
    expect(generateUploadSignature).not.toHaveBeenCalled()
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
      planFeatures: {
        contratos: false,
        'upload-contratos-attachment': false,
      },
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

  it('retorna provider cloudinary para logo de empresa', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...mockUser,
      role: 'regularUser',
      tenantRole: 'manager',
      planFeatures: {
        'mi-empresa': true,
        'upload-mi-empresa-logo': true,
      },
    })
    vi.mocked(generateUploadSignature).mockReturnValue({
      signature: 'logo-signature',
      timestamp: 1234567890,
      apiKey: 'test-key',
      cloudName: 'test-cloud',
      folder: 'tenant-test-1/empresa/logo',
      uploadKey: 'miEmpresa.logo',
      resourceType: 'image',
      publicId: 'tenant-test-1/empresa/logo/logo-file',
    })

    const request = createRequest({
      uploadKey: 'miEmpresa.logo',
      filename: 'logo.png',
      mimeType: 'image/png',
      bytes: 100_000,
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.provider).toBe('cloudinary')
    expect(data.folder).toBe('tenant-test-1/empresa/logo')
    expect(generateUploadSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadKey: 'miEmpresa.logo',
        folder: 'tenant-test-1/empresa/logo',
        resourceType: 'image',
      })
    )
  })

  it('retorna intent de uploadthing para contratos.attachment', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

    const request = createRequest({
      uploadKey: 'contratos.attachment',
      filename: 'contract.pdf',
      mimeType: 'application/pdf',
      bytes: 100_000,
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.provider).toBe('uploadthing')
    expect(data.uploadthingRoute).toBe('contractAttachment')
    expect(data.folder).toBe('tenant-test-1/contratos/anexos')
    expect(generateUploadSignature).not.toHaveBeenCalled()
  })

  it('retorna 500 cuando generateUploadSignature falla', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...mockUser,
      role: 'regularUser',
      tenantRole: 'manager',
      planFeatures: {
        'mi-empresa': true,
        'upload-mi-empresa-logo': true,
      },
    })
    vi.mocked(generateUploadSignature).mockImplementation(() => {
      throw new Error('Unexpected error')
    })

    const request = createRequest({
      uploadKey: 'miEmpresa.logo',
      filename: 'logo.png',
      mimeType: 'image/png',
      bytes: 1200,
    })
    const response = await POST(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toContain('signature')
  })
})
