/**
 * @description Helper de cliente para subir archivos directamente a Cloudinary
 * usando signed uploads. Obtiene una firma del servidor y luego sube el archivo
 * directamente a Cloudinary sin pasar por el servidor.
 *
 */

import type { CloudinaryAssetUploadResult } from './cloudinary-asset'
import type { UploadKey } from './upload-policy'
import type { UploadProvider } from './upload-policy'

export interface UploadOptions {
  uploadKey: UploadKey
  entityId?: string
  onProgress?: (progress: number) => void
}

export interface UploadIntentResponse {
  provider: UploadProvider
  uploadKey: UploadKey
  resourceType: 'image' | 'raw'
  folder: string
  publicId: string
  signature?: string
  timestamp?: number
  apiKey?: string
  cloudName?: string
  uploadthingRoute?: string | null
}

interface SignatureResponse extends UploadIntentResponse {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
}

interface UploadResponse {
  secure_url: string
  public_id: string
  resource_type?: 'image' | 'raw'
  bytes?: number
  original_filename?: string
  format?: string
  width?: number
  height?: number
}

/**
 * @description Sube un archivo directamente a Cloudinary usando signed upload.
 *  Primero obtiene una firma del servidor (que valida y prefija el folder con
 *  el tenantId del usuario), luego sube el archivo a Cloudinary.
 *
 * @param {File} file - Archivo a subir
 * @param {UploadOptions} [options] - Opciones adicionales
 * @param {UploadKey} options.uploadKey - Clave de policy server-side
 * @param {string} [options.entityId] - ID del recurso relacionado si aplica
 * @param {(progress: number) => void} [options.onProgress] - Callback de progreso
 * @returns {Promise<CloudinaryAssetUploadResult>} Metadata del asset subido
 * @throws {Error} Si falla la obtención de firma o el upload a Cloudinary
 */
export async function uploadToCloudinary(
  file: File,
  options: UploadOptions
): Promise<CloudinaryAssetUploadResult> {
  const { onProgress } = options
  const intent = await getUploadIntent(file, options)

  if (intent.provider !== 'cloudinary') {
    throw new Error(`Upload intent provider must be cloudinary, got ${intent.provider}`)
  }

  return uploadToCloudinaryFromIntent(file, intent, onProgress)
}

export async function getUploadIntent(
  file: File,
  options: UploadOptions
): Promise<UploadIntentResponse> {
  const { uploadKey, entityId } = options

  const signResponse = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadKey,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      bytes: file.size,
      entityId,
    }),
  })

  if (!signResponse.ok) {
    throw new Error('Failed to get upload signature')
  }

  return await signResponse.json() as UploadIntentResponse
}

export async function uploadToCloudinaryFromIntent(
  file: File,
  intent: SignatureResponse,
  onProgress?: (progress: number) => void
): Promise<CloudinaryAssetUploadResult> {
  const {
    signature,
    timestamp,
    apiKey,
    cloudName,
    uploadKey,
    resourceType,
    folder,
    publicId,
  } = intent

  // 2. Preparar FormData para Cloudinary (usar parámetros normalizados por el server)
  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', apiKey)
  formData.append('timestamp', timestamp.toString())
  formData.append('signature', signature)
  formData.append('folder', folder)
  formData.append('public_id', publicId)

  // 3. Subir a Cloudinary
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  })

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json().catch(() => ({ error: { message: 'Unknown error' } }))
    throw new Error(
      `Cloudinary upload failed: ${error.error?.message || 'Unknown error'}`
    )
  }

  const result: UploadResponse = await uploadResponse.json()

  if (onProgress) {
    onProgress(100)
  }

  return {
    uploadKey,
    secureUrl: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type ?? resourceType,
    bytes: result.bytes ?? file.size,
    mimeType: file.type || 'application/octet-stream',
    originalFilename: result.original_filename ?? file.name.replace(/\.[^.]+$/, ''),
  }
}

export async function uploadToCloudinaryUrl(
  file: File,
  options: UploadOptions
): Promise<string> {
  const result = await uploadToCloudinary(file, options)
  return result.secureUrl
}
