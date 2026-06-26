import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contratoVersion: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    contratoArchivo: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}))

vi.mock('@/lib/upload/cloudinary-admin', () => ({
  recordOwnerAsset: vi.fn(),
}))

vi.mock('@/lib/upload/upload-policy', () => ({
  resolveUploadPolicy: vi.fn(),
}))

vi.mock('uploadthing/server', () => ({
  UTApi: vi.fn(),
  UTFile: class MockUTFile extends File {
    customId?: string

    constructor(parts: BlobPart[], name: string, options?: FilePropertyBag & { customId?: string }) {
      super(parts, name, options)
      this.customId = options?.customId
    }
  },
}))

import { prisma } from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { recordOwnerAsset } from '@/lib/upload/cloudinary-admin'
import { resolveUploadPolicy } from '@/lib/upload/upload-policy'
import { UTApi } from 'uploadthing/server'
import {
  checkContratoVersionDiffHandler,
  createContratoVersionHandler,
} from './handlers'

function createMockFile(contents: string, name: string, type: string) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(contents)

  return {
    name,
    type,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer,
  }
}

function createMultipartRequest(url: string, fields: Record<string, string | File>): Request {
  const request = new Request(url, {
    method: 'POST',
  })

  Object.defineProperty(request, 'formData', {
    value: async () => ({
      get: (key: string) => fields[key] ?? null,
    }),
  })

  return request
}

describe('contract version handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates contract versions through uploadthing and persists normalized metadata', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'admin',
        name: 'Test',
        email: 'test@example.com',
        isActive: true,
      },
    } as never)

    vi.mocked(resolveUploadPolicy).mockReturnValue({
      provider: 'uploadthing',
      uploadKey: 'contratos.version',
      resourceType: 'raw',
      folder: 'tenant-1/contratos/contract-1/versiones',
      publicId: 'tenant-1/contratos/contract-1/versiones/v1',
    } as never)

    vi.mocked(prisma.contratoVersion.findFirst).mockResolvedValue(null as never)
    vi.mocked(prisma.contratoVersion.create).mockResolvedValue({
      versionId: 'version-1',
      numeroVersion: 1,
    } as never)
    vi.mocked(prisma.contratoArchivo.create).mockResolvedValue({
      archivoId: 'archivo-1',
    } as never)

    const uploadFiles = vi.fn().mockResolvedValue([
      {
        data: {
          key: 'ut-key-1',
          ufsUrl: 'https://inventario-app.ufs.sh/f/ut-key-1',
          name: 'contract-v1.pdf',
          size: 16,
          type: 'application/pdf',
          customId: 'tenant-1/contratos/contract-1/versiones/v1',
        },
        error: null,
      },
    ])

    vi.mocked(UTApi).mockImplementation(() => ({ uploadFiles }) as never)

    const file = createMockFile('contract-version', 'contract-v1.pdf', 'application/pdf')

    const response = await createContratoVersionHandler(
      createMultipartRequest('http://localhost/api/contratos/contract-1/versiones', {
        file,
        cambios: 'Nueva versión',
      }) as never,
      { params: Promise.resolve({ id: 'contract-1' }) }
    )

    expect(response.status).toBe(200)
    expect(resolveUploadPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadKey: 'contratos.version',
      })
    )
    expect(uploadFiles).toHaveBeenCalledTimes(1)
    expect(prisma.contratoVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contenido: expect.objectContaining({
            storageProvider: 'uploadthing',
            fileHash: expect.any(String),
            publicId: 'tenant-1/contratos/contract-1/versiones/v1',
          }),
        }),
      })
    )
    expect(prisma.contratoArchivo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rutaArchivo: 'https://inventario-app.ufs.sh/f/ut-key-1',
          versionId: 'version-1',
        }),
      })
    )
    expect(recordOwnerAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'archivo-1',
        asset: expect.objectContaining({
          uploadKey: 'contratos.version',
          publicId: 'tenant-1/contratos/contract-1/versiones/v1',
          secureUrl: 'https://inventario-app.ufs.sh/f/ut-key-1',
        }),
      })
    )
  })

  it('compares remote versions using persisted hashes instead of local filesystem paths', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'admin',
        name: 'Test',
        email: 'test@example.com',
        isActive: true,
      },
    } as never)

    const file = createMockFile('same-content', 'contract-v2.pdf', 'application/pdf')

    const expectedHash = 'cae1b3faaa5e4ac7c3306bd164b36dcfdff98294b8024c9c949639b4c480bf6b'

    vi.mocked(prisma.contratoVersion.findFirst).mockResolvedValue({
      versionId: 'version-1',
      numeroVersion: 1,
      contenido: {
        fileHash: expectedHash,
        storageProvider: 'uploadthing',
      },
      archivos: [
        {
          rutaArchivo: 'https://inventario-app.ufs.sh/f/ut-key-1',
        },
      ],
    } as never)

    const response = await checkContratoVersionDiffHandler(
      createMultipartRequest('http://localhost/api/contratos/contract-1/versiones/check-diff', {
        file,
      }) as never,
      { params: Promise.resolve({ id: 'contract-1' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      hasChanges: false,
      message: 'El archivo es idéntico a la última versión.',
    })
  })
})
