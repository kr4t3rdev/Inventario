import { describe, expect, it } from 'vitest'
import { resolveUploadPolicy } from './upload-policy'

const baseUser = {
  userId: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin' as const,
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager' as const,
  planFeatures: { productos: true, contratos: false },
}

describe('resolveUploadPolicy', () => {
  it('allows product photo uploads for productos feature', () => {
    const policy = resolveUploadPolicy({
      uploadKey: 'productos.photo',
      user: baseUser,
      input: {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        bytes: 512_000,
      },
    })

    expect(policy.folder).toBe('tenant-1/productos')
    expect(policy.resourceType).toBe('image')
    expect(policy.maxBytes).toBe(2 * 1024 * 1024)
    expect(policy.publicId).toContain('tenant-1/productos/')
  })

  it('rejects unauthorized contract attachment uploads', () => {
    expect(() =>
      resolveUploadPolicy({
        uploadKey: 'contratos.attachment',
        user: {
          ...baseUser,
          role: 'regularUser',
          planFeatures: { contratos: false },
        },
        input: {
          filename: 'contract.pdf',
          mimeType: 'application/pdf',
          bytes: 50_000,
        },
      })
    ).toThrow(/permisos|plan actual|authorized|permission|funcionalidad/i)
  })
})
