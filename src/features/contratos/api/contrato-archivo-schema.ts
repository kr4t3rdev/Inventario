import { z } from 'zod'

const CLOUDINARY_HOST = 'res.cloudinary.com'
const CONTRACT_ATTACHMENT_PREFIX = 'contratos/anexos/'
const CONTRACT_VERSION_SEGMENT = '/contratos/'
const MAX_CONTRACT_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_CONTRACT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

export const contratoArchivoCreateSchema = z.object({
  tipo: z.string().min(1),
  rutaArchivo: z.string().url(),
  cloudinaryPublicId: z.string().min(1),
  mimeType: z.string().min(1),
  bytes: z.number().int().positive(),
  nombreArchivo: z.string().min(1),
  versionId: z.string().optional().nullable(),
})

export function assertCloudinaryAssetBelongsToTenant(input: {
  tenantId: string
  publicId: string
  secureUrl: string
  expectedPrefix: string
}): void {
  const url = new URL(input.secureUrl)

  if (url.hostname !== CLOUDINARY_HOST) {
    throw new Error('El archivo debe pertenecer a Cloudinary')
  }

  if (!input.publicId.startsWith(`${input.tenantId}/${input.expectedPrefix}`)) {
    throw new Error('El asset no pertenece al tenant o carpeta esperada')
  }

  if (!url.pathname.includes(encodeURI(input.publicId))) {
    throw new Error('La URL no corresponde con el publicId informado')
  }
}

export function assertContratoAttachmentAsset(input: {
  tenantId: string
  publicId: string
  secureUrl: string
  mimeType: string
  bytes: number
}): void {
  if (!ALLOWED_CONTRACT_MIME_TYPES.has(input.mimeType)) {
    throw new Error('Tipo de archivo no permitido para anexos de contrato')
  }

  if (input.bytes > MAX_CONTRACT_FILE_BYTES) {
    throw new Error('El archivo excede el tamaño máximo permitido para anexos de contrato')
  }

  assertCloudinaryAssetBelongsToTenant({
    tenantId: input.tenantId,
    publicId: input.publicId,
    secureUrl: input.secureUrl,
    expectedPrefix: CONTRACT_ATTACHMENT_PREFIX,
  })
}

export function assertContratoVersionFile(file: File): void {
  if (!ALLOWED_CONTRACT_MIME_TYPES.has(file.type)) {
    throw new Error('Tipo de archivo no permitido para versiones de contrato')
  }

  if (file.size > MAX_CONTRACT_FILE_BYTES) {
    throw new Error('La versión de contrato excede el tamaño máximo permitido')
  }
}

export function buildContratoVersionPrefix(tenantId: string, contratoId: string): string {
  return `${tenantId}${CONTRACT_VERSION_SEGMENT}${contratoId}/versiones/`
}
