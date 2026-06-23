/**
 * @description Helper de servidor para generar firmas de upload a Cloudinary
 * usando signed uploads (el cliente sube directo a Cloudinary con una firma).
 */

import { v2 as cloudinary } from 'cloudinary'
import type { ResolvedUploadPolicy, UploadKey } from '@/lib/upload/upload-policy'

// Configuración del SDK
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export interface UploadSignature {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  uploadKey: UploadKey
  resourceType: 'image' | 'raw'
  folder: string
  publicId: string
}

export interface DestroyCloudinaryAssetInput {
  publicId: string
  resourceType?: 'image' | 'raw'
}

/**
 * @description Genera una firma para signed upload a Cloudinary.
 *  El cliente usa esta firma para subir archivos directamente a Cloudinary
 *  sin pasar por el servidor.
 *
 * @param {string} folder - Carpeta destino en Cloudinary (debe incluir tenantId)
 * @param {string} [publicId] - ID público opcional para el archivo
 * @param {'image' | 'raw'} [resourceType='image'] - Tipo de recurso
 * @returns {UploadSignature} Objeto con firma y parámetros para el cliente
 * @throws {Error} Si falta configuración de Cloudinary o folder es inválido
 */
export function generateUploadSignature(policy: ResolvedUploadPolicy): UploadSignature {
  const { folder, publicId, resourceType, uploadKey } = policy
  // Validar configuración
  if (
    !process.env.CLOUDINARY_CLOUD_NAME
    || !process.env.CLOUDINARY_API_KEY
    || !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error('Cloudinary configuration missing')
  }

  // Validar folder
  if (!folder || folder.trim() === '') {
    throw new Error('Folder is required')
  }

  const timestamp = Math.round(Date.now() / 1000)

  // Construir parámetros para firma
  const paramsToSign: Record<string, unknown> = {
    timestamp,
    folder,
  }

  if (publicId) {
    paramsToSign.public_id = publicId
  }

  // Generar firma
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  )

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    uploadKey,
    resourceType,
    folder,
    publicId,
  }
}

/**
 * @description Elimina un asset remoto en Cloudinary y devuelve el resultado crudo del SDK.
 * @param {DestroyCloudinaryAssetInput} input - Identificador público y tipo de recurso.
 * @returns {Promise<{ result: string }>} Resultado de Cloudinary.
 */
export async function destroyCloudinaryAsset(
  input: DestroyCloudinaryAssetInput
): Promise<{ result: string }> {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME
    || !process.env.CLOUDINARY_API_KEY
    || !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error('Cloudinary configuration missing')
  }

  if (!input.publicId || input.publicId.trim() === '') {
    throw new Error('Public ID is required')
  }

  const result = await cloudinary.uploader.destroy(input.publicId, {
    resource_type: input.resourceType ?? 'image',
    invalidate: true,
  })

  return { result: String(result.result ?? 'unknown') }
}
