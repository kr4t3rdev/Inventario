import { genUploader } from 'uploadthing/client'

import type { UploadIntentResponse } from './cloudinary-upload'
import type { UploadedAsset } from './upload-asset'
import type { UploadRouter, UploadthingRoute } from '@/app/api/uploadthing/core'

interface UploadthingIntent extends UploadIntentResponse {
  provider: 'uploadthing'
  uploadthingRoute: UploadthingRoute
}

/**
 * @description Sube un archivo a UploadThing usando el intent resuelto por el backend.
 * @param {File} file - Archivo a subir.
 * @param {UploadthingIntent} intent - Intent normalizado del backend.
 * @param {(progress: number) => void} [onProgress] - Callback opcional de progreso.
 * @returns {Promise<UploadedAsset>} Asset normalizado para el resto de la app.
 */
export async function uploadToUploadthing(
  file: File,
  intent: UploadthingIntent,
  onProgress?: (progress: number) => void
): Promise<UploadedAsset> {
  const { uploadFiles } = genUploader<UploadRouter>({
    url: '/api/uploadthing',
  })

  const [uploaded] = await uploadFiles(intent.uploadthingRoute, {
    files: [file],
    input: {
      uploadKey: intent.uploadKey,
      resourceType: intent.resourceType,
      folder: intent.folder,
      publicId: intent.publicId,
    },
    onUploadProgress: ({ progress }) => {
      onProgress?.(progress)
    },
  })

  if (!uploaded) {
    throw new Error('UploadThing upload returned no files')
  }

  return {
    provider: 'uploadthing',
    uploadKey: intent.uploadKey,
    url: uploaded.ufsUrl,
    key: uploaded.key,
    publicId: uploaded.serverData?.publicId ?? uploaded.customId ?? intent.publicId,
    resourceType: intent.resourceType,
    bytes: uploaded.size,
    mimeType: uploaded.type,
    originalFilename: uploaded.name,
  }
}
