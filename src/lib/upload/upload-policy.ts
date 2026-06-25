import { ActionError } from '@/lib/server-actions/types'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { requireFeature, requireManagerRole, requireTenant } from '@/lib/services/tenant-scope'

export type UploadKey =
  | 'productos.photo'
  | 'clientes.logo'
  | 'vendors.logo'
  | 'miEmpresa.logo'
  | 'profile.avatar'
  | 'reparaciones.equipo-photo'
  | 'reparaciones.orden-photo'
  | 'contratos.attachment'
  | 'contratos.version'
  | 'deudasCash.receipt'

export interface UploadIntentInput {
  filename: string
  mimeType: string
  bytes: number
  entityId?: string
}

export interface ResolveUploadPolicyInput {
  uploadKey: UploadKey
  user: AuthenticatedUser
  input: UploadIntentInput
}

export type UploadProvider = 'cloudinary' | 'uploadthing'

export interface ResolvedUploadPolicy {
  uploadKey: UploadKey
  provider: UploadProvider
  folder: string
  resourceType: 'image' | 'raw'
  maxBytes: number
  allowedMimeTypes: string[]
  publicId: string
}

const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

const CONTRACT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ...IMAGE_MIME_TYPES,
] as const

function slugifyFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '')
  return withoutExtension
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function buildPublicId(folder: string, filename: string, entityId?: string): string {
  const baseName = slugifyFilename(filename) || 'file'
  const suffix = entityId ? `${entityId}-${Date.now()}` : `${baseName}-${Date.now()}`
  return `${folder}/${suffix}`
}

function ensureEntityId(entityId: string | undefined, message: string): string {
  if (!entityId || entityId.trim() === '') {
    throw new ActionError(message, 'INVALID_UPLOAD_TARGET')
  }
  return entityId
}

function ensureMimeAndSize(
  mimeType: string,
  bytes: number,
  allowedMimeTypes: readonly string[],
  maxBytes: number
): void {
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new ActionError('El tipo de archivo no está permitido para este upload', 'INVALID_MIME_TYPE')
  }

  if (bytes > maxBytes) {
    throw new ActionError('El archivo excede el tamaño máximo permitido', 'FILE_TOO_LARGE')
  }
}

export function resolveUploadPolicy({
  uploadKey,
  user,
  input,
}: ResolveUploadPolicyInput): ResolvedUploadPolicy {
  const tenantId = requireTenant(user)
  const { filename, mimeType, bytes, entityId } = input

  let provider: UploadProvider = 'cloudinary'
  let folder = ''
  let resourceType: 'image' | 'raw' = 'image'
  let maxBytes = 2 * 1024 * 1024
  let allowedMimeTypes: readonly string[] = IMAGE_MIME_TYPES

  switch (uploadKey) {
    case 'productos.photo':
      requireFeature(user, 'upload-productos-photo', 'subir fotos de productos')
      requireFeature(user, 'productos', 'subir fotos de productos')
      provider = 'uploadthing'
      folder = `${tenantId}/productos`
      break
    case 'clientes.logo':
      requireFeature(user, 'upload-clientes-logo', 'subir logos de clientes')
      requireFeature(user, 'clientes', 'subir logos de clientes')
      folder = `${tenantId}/clientes/logo`
      break
    case 'vendors.logo':
      requireFeature(user, 'upload-vendors-logo', 'subir logos de proveedores')
      folder = `${tenantId}/vendors/logo`
      break
    case 'miEmpresa.logo':
      requireFeature(user, 'upload-mi-empresa-logo', 'subir el logo de la empresa')
      requireManagerRole(user, 'actualizar el logo de la empresa')
      folder = `${tenantId}/empresa/logo`
      break
    case 'profile.avatar': {
      requireFeature(user, 'upload-profile-avatar', 'subir avatares de usuario')
      const userId = ensureEntityId(entityId, 'Se requiere el userId para subir el avatar')
      if (userId !== user.userId && user.role !== 'admin') {
        throw new ActionError('No tienes permisos para subir un avatar para otro usuario', 'FORBIDDEN')
      }
      folder = `${tenantId}/usuarios/${userId}/avatar`
      break
    }
    case 'reparaciones.equipo-photo':
      requireFeature(user, 'reparaciones', 'subir fotos de equipos')
      folder = `${tenantId}/reparaciones/equipos`
      maxBytes = 5 * 1024 * 1024
      break
    case 'reparaciones.orden-photo': {
      requireFeature(user, 'reparaciones', 'subir fotos de órdenes')
      const ordenId = ensureEntityId(entityId, 'Se requiere el id de la orden para subir fotos')
      folder = `${tenantId}/reparaciones/${ordenId}/fotos`
      maxBytes = 5 * 1024 * 1024
      break
    }
    case 'contratos.attachment':
      requireFeature(user, 'upload-contratos-attachment', 'subir anexos de contratos')
      requireFeature(user, 'contratos', 'subir anexos de contratos')
      provider = 'uploadthing'
      folder = `${tenantId}/contratos/anexos`
      resourceType = 'raw'
      maxBytes = 10 * 1024 * 1024
      allowedMimeTypes = CONTRACT_MIME_TYPES
      break
    case 'contratos.version': {
      requireFeature(user, 'upload-contratos-version', 'subir versiones de contratos')
      requireFeature(user, 'contratos', 'subir versiones de contratos')
      provider = 'uploadthing'
      const contratoId = ensureEntityId(entityId, 'Se requiere el id del contrato para subir versiones')
      folder = `${tenantId}/contratos/${contratoId}/versiones`
      resourceType = 'raw'
      maxBytes = 10 * 1024 * 1024
      allowedMimeTypes = CONTRACT_MIME_TYPES
      break
    }
    case 'deudasCash.receipt':
      requireFeature(user, 'upload-deudas-cash-receipt', 'subir comprobantes de deudas cash')
      folder = `${tenantId}/contabilidad/deudas-cash/comprobantes`
      maxBytes = 5 * 1024 * 1024
      break
    default:
      throw new ActionError('Upload key no soportado', 'INVALID_UPLOAD_KEY')
  }

  ensureMimeAndSize(mimeType, bytes, allowedMimeTypes, maxBytes)

  return {
    uploadKey,
    provider,
    folder,
    resourceType,
    maxBytes,
    allowedMimeTypes: [...allowedMimeTypes],
    publicId: buildPublicId(folder, filename, entityId),
  }
}
