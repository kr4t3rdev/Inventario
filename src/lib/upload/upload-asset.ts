import {
  getUploadIntent,
  type UploadIntentResponse,
  type UploadOptions,
  uploadToCloudinaryFromIntent,
} from './cloudinary-upload'
import type { CloudinaryAssetUploadResult } from './cloudinary-asset'
import type { UploadKey, UploadProvider } from './upload-policy'
import { uploadToUploadthing } from './uploadthing-client'

export interface UploadedAsset {
  provider: UploadProvider
  uploadKey: UploadKey
  url: string
  resourceType: 'image' | 'raw'
  bytes: number
  mimeType: string
  originalFilename: string
  publicId?: string
  key?: string
}

/**
 * @description Sube un archivo usando el provider resuelto por el backend y devuelve
 * una metadata normalizada, agnóstica al storage final.
 * @param {File} file - Archivo a subir.
 * @param {UploadOptions} options - Upload key, entityId y progreso opcional.
 * @returns {Promise<UploadedAsset>} Metadata normalizada del archivo remoto.
 */
export async function uploadAsset(
  file: File,
  options: UploadOptions
): Promise<UploadedAsset> {
  const intent = await getUploadIntent(file, options)

  if (intent.provider === 'cloudinary') {
    const result = await uploadToCloudinaryFromIntent(
      file,
      intent as Required<Pick<UploadIntentResponse, 'signature' | 'timestamp' | 'apiKey' | 'cloudName'>> & UploadIntentResponse,
      options.onProgress
    )

    return {
      provider: 'cloudinary',
      uploadKey: result.uploadKey,
      url: result.secureUrl,
      publicId: result.publicId,
      resourceType: result.resourceType,
      bytes: result.bytes,
      mimeType: result.mimeType,
      originalFilename: result.originalFilename,
    }
  }

  return uploadToUploadthing(file, intent as UploadIntentResponse & {
    provider: 'uploadthing'
    uploadthingRoute: 'productPhoto' | 'contractAttachment' | 'contractVersion'
  }, options.onProgress)
}

/**
 * @description Convierte un UploadedAsset normalizado en el contrato legado de Cloudinary.
 * Úsalo solo mientras existan actions/schemas que todavía esperan `CloudinaryAssetUploadResult`.
 * @param {UploadedAsset} asset - Asset normalizado.
 * @returns {CloudinaryAssetUploadResult} Asset compatible con el contrato actual de Cloudinary.
 */
export function toCloudinaryAssetUploadResult(
  asset: UploadedAsset
): CloudinaryAssetUploadResult {
  if (asset.provider !== 'cloudinary' || !asset.publicId) {
    throw new Error('Expected a cloudinary uploaded asset with publicId')
  }

  return toLegacyAssetUploadResult(asset)
}

/**
 * @description Adapta un UploadedAsset al contrato legado persistido hoy en Prisma/actions.
 * @param {UploadedAsset} asset - Asset normalizado de cualquier provider.
 * @returns {CloudinaryAssetUploadResult} Forma legado compatible para persistencia actual.
 */
export function toLegacyAssetUploadResult(
  asset: UploadedAsset
): CloudinaryAssetUploadResult {
  const publicId = asset.publicId ?? asset.key

  if (!publicId) {
    throw new Error('Expected an uploaded asset with a publicId or key')
  }

  return {
    uploadKey: asset.uploadKey,
    secureUrl: asset.url,
    publicId,
    resourceType: asset.resourceType,
    bytes: asset.bytes,
    mimeType: asset.mimeType,
    originalFilename: asset.originalFilename,
  }
}
