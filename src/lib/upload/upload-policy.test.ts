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
  it('routes product photo uploads to UploadThing for empresarial assets', () => {
    const policy = resolveUploadPolicy({
      uploadKey: 'productos.photo',
      user: baseUser,
      input: {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        bytes: 512_000,
      },
    })

    expect(policy.provider).toBe('uploadthing')
    expect(policy.folder).toBe('tenant-1/productos')
    expect(policy.resourceType).toBe('image')
    expect(policy.maxBytes).toBe(2 * 1024 * 1024)
    expect(policy.publicId).toContain('tenant-1/productos/')
  })

  it('routes mi empresa logo uploads to Cloudinary for básico/profesional assets', () => {
    const policy = resolveUploadPolicy({
      uploadKey: 'miEmpresa.logo',
      user: {
        ...baseUser,
        role: 'regularUser',
        planFeatures: { 'upload-mi-empresa-logo': true, 'mi-empresa': true },
      },
      input: {
        filename: 'logo.png',
        mimeType: 'image/png',
        bytes: 42_000,
      },
    })

    expect(policy.provider).toBe('cloudinary')
    expect(policy.folder).toBe('tenant-1/empresa/logo')
  })

  it('rejects product photo uploads when upload entitlement is missing', () => {
    expect(() =>
      resolveUploadPolicy({
        uploadKey: 'productos.photo',
        user: {
          ...baseUser,
          role: 'regularUser',
          planFeatures: { productos: true, 'upload-productos-photo': false },
        },
        input: {
          filename: 'photo.jpg',
          mimeType: 'image/jpeg',
          bytes: 512_000,
        },
      })
    ).toThrow(/plan actual|funcionalidad/i)
  })

  it('rejects unauthorized contract attachment uploads', () => {
    expect(() =>
      resolveUploadPolicy({
        uploadKey: 'contratos.attachment',
        user: {
          ...baseUser,
          role: 'regularUser',
          planFeatures: {
            contratos: false,
            'upload-contratos-attachment': false,
          },
        },
        input: {
          filename: 'contract.pdf',
          mimeType: 'application/pdf',
          bytes: 50_000,
        },
      })
    ).toThrow(/permisos|plan actual|authorized|permission|funcionalidad/i)
  })

  it('allows bounded PDF/image receipts for a tenant expense', () => {
    const policy = resolveUploadPolicy({
      uploadKey: 'gastosDE.attachment' as never,
      user: { ...baseUser, role: 'regularUser', planFeatures: { gastos: true } },
      input: {
        filename: 'factura.pdf',
        mimeType: 'application/pdf',
        bytes: 100_000,
        entityId: 'gasto-1',
      },
    })

    expect(policy.provider).toBe('cloudinary')
    expect(policy.resourceType).toBe('raw')
    expect(policy.folder).toBe('tenant-1/gastosDE/gasto-1/comprobantes')
    expect(policy.maxBytes).toBe(10 * 1024 * 1024)
    expect(policy.publicId).toMatch(/^tenant-1\/gastosDE\/gasto-1\/comprobantes\/.+\.pdf$/)
  })

  it('uses the filename extension required by Cloudinary raw uploads', () => {
    const policy = resolveUploadPolicy({
      uploadKey: 'gastosDE.attachment',
      user: { ...baseUser, role: 'regularUser', planFeatures: { gastos: true } },
      input: {
        filename: 'evidencia.final.jpeg',
        mimeType: 'image/jpeg',
        bytes: 100_000,
        entityId: 'gasto-1',
      },
    })

    expect(policy.resourceType).toBe('raw')
    expect(policy.publicId).toMatch(/\.jpg$/)
    expect(policy.publicId).not.toMatch(/\.jpeg$/)
  })

  it('rejects missing expense ids and files outside the receipt allowlist', () => {
    const user = { ...baseUser, role: 'regularUser' as const, planFeatures: { gastos: true } }
    expect(() => resolveUploadPolicy({
      uploadKey: 'gastosDE.attachment' as never,
      user,
      input: { filename: 'factura.pdf', mimeType: 'application/pdf', bytes: 100, },
    })).toThrow(/id del gasto/i)
    expect(() => resolveUploadPolicy({
      uploadKey: 'gastosDE.attachment' as never,
      user,
      input: { filename: 'payload.exe', mimeType: 'application/x-msdownload', bytes: 100, entityId: 'gasto-1' },
    })).toThrow(/tipo de archivo/i)
  })
})
