import { describe, expect, it } from 'vitest'
import {
  assertCloudinaryAssetBelongsToTenant,
  assertContratoAttachmentAsset,
  assertContratoVersionFile,
  contratoArchivoCreateSchema,
} from './contrato-archivo-schema'

describe('contratoArchivoCreateSchema', () => {
  it('accepts uploadthing attachments scoped to the tenant', () => {
    const parsed = contratoArchivoCreateSchema.safeParse({
      tipo: 'ANEXO',
      rutaArchivo: 'https://inventario-app.ufs.sh/f/contract-file-key',
      nombreArchivo: 'file.pdf',
      cloudinaryPublicId: 'tenant-1/contratos/anexos/file',
      mimeType: 'application/pdf',
      bytes: 2048,
      storageProvider: 'uploadthing',
    })

    expect(parsed.success).toBe(true)
    expect(() =>
      assertContratoAttachmentAsset({
        tenantId: 'tenant-1',
        provider: 'uploadthing',
        publicId: 'tenant-1/contratos/anexos/file',
        secureUrl: 'https://inventario-app.ufs.sh/f/contract-file-key',
        mimeType: 'application/pdf',
        bytes: 2048,
      })
    ).not.toThrow()
  })

  it('rejects non-cloudinary URLs for contrato attachments', () => {
    const parsed = contratoArchivoCreateSchema.safeParse({
      tipo: 'ANEXO',
      rutaArchivo: 'https://evil.example.com/file.pdf',
      nombreArchivo: 'file.pdf',
      cloudinaryPublicId: 'tenant-1/contratos/anexos/file',
      mimeType: 'application/pdf',
      bytes: 2048,
      storageProvider: 'cloudinary',
    })

    expect(parsed.success).toBe(true)
    expect(() =>
      assertContratoAttachmentAsset({
        tenantId: 'tenant-1',
        provider: 'cloudinary',
        publicId: 'tenant-1/contratos/anexos/file',
        secureUrl: 'https://evil.example.com/file.pdf',
        mimeType: 'application/pdf',
        bytes: 2048,
      })
    ).toThrow(/Cloudinary/i)
  })

  it('rejects attachment publicId outside tenant scope', () => {
    expect(() =>
      assertCloudinaryAssetBelongsToTenant({
        tenantId: 'tenant-1',
        publicId: 'tenant-2/contratos/anexos/file',
        secureUrl:
          'https://res.cloudinary.com/demo/raw/upload/v1/tenant-2/contratos/anexos/file.pdf',
        expectedPrefix: 'contratos/anexos/',
      })
    ).toThrow(/tenant/i)
  })

  it('rejects invalid contract version file type', () => {
    const file = new File(['x'], 'contract.exe', { type: 'application/x-msdownload' })
    expect(() => assertContratoVersionFile(file)).toThrow(/no permitido/i)
  })
})
