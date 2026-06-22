/**
 * @description Tests unitarios para POST /api/upload/sign.
 * Verifica autenticación, validación de folder/resourceType, prefijado de tenantId,
 * y generación de firma.
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
    })

    const request = createRequest({ folder: 'productos' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.signature).toBe('test-signature')
    expect(data.folder).toBe('tenant-test-1/productos')
    expect(generateUploadSignature).toHaveBeenCalledWith(
      'tenant-test-1/productos',
      undefined,
      'image'
    )
  })

  it('soporta subcarpetas en el folder relativo', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(generateUploadSignature).mockReturnValue({
      signature: 'test-signature',
      timestamp: 1234567890,
      apiKey: 'test-key',
      cloudName: 'test-cloud',
      folder: 'tenant-test-1/clientes/cli-1/logo',
    })

    const request = createRequest({ folder: 'clientes/cli-1/logo' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.folder).toBe('tenant-test-1/clientes/cli-1/logo')
    expect(generateUploadSignature).toHaveBeenCalledWith(
      'tenant-test-1/clientes/cli-1/logo',
      undefined,
      'image'
    )
  })

  it('retorna 401 cuando no hay usuario autenticado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const request = createRequest({ folder: 'productos' })
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

    const request = createRequest({ folder: 'productos' })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('retorna 400 cuando el folder está vacío', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

    const request = createRequest({ folder: '' })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('retorna 400 cuando el folder empieza con slash', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

    const request = createRequest({ folder: '/productos' })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('retorna 400 cuando el folder tiene path traversal', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

    const request = createRequest({ folder: '../other-tenant/productos' })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('retorna 400 cuando resourceType es inválido', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

    const request = createRequest({
      folder: 'productos',
      resourceType: 'video',
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('resourceType')
  })

  it('retorna 200 con resourceType raw', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(generateUploadSignature).mockReturnValue({
      signature: 'test-signature',
      timestamp: 1234567890,
      apiKey: 'test-key',
      cloudName: 'test-cloud',
      folder: 'tenant-test-1/contratos',
    })

    const request = createRequest({
      folder: 'contratos',
      resourceType: 'raw',
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(generateUploadSignature).toHaveBeenCalledWith(
      'tenant-test-1/contratos',
      undefined,
      'raw'
    )
  })

  it('retorna 500 cuando generateUploadSignature falla', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(generateUploadSignature).mockImplementation(() => {
      throw new Error('Unexpected error')
    })

    const request = createRequest({ folder: 'productos' })
    const response = await POST(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toContain('signature')
  })
})
