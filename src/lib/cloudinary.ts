/**
 * @description Helper de servidor para generar firmas de upload a Cloudinary
 * usando signed uploads (el cliente sube directo a Cloudinary con una firma).
 */

import { v2 as cloudinary } from 'cloudinary'

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
  folder: string
  publicId?: string
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
export function generateUploadSignature(
  folder: string,
  publicId?: string,
  resourceType: 'image' | 'raw' = 'image'
): UploadSignature {
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
    folder,
    publicId,
  }
}
