import { genUploader } from 'uploadthing/client'

import type { UploadIntentResponse } from './cloudinary-upload'
import type { UploadedAsset } from './upload-asset'
import type { UploadRouter, UploadthingRoute } from '@/app/api/uploadthing/core'

export type UploadthingIntent =
  | (Omit<UploadIntentResponse, 'provider' | 'uploadKey' | 'uploadthingRoute' | 'resourceType'> & {
      provider: 'uploadthing'
      uploadKey: 'productos.photo'
      resourceType: 'image'
      uploadthingRoute: 'productPhoto'
    })
  | (Omit<UploadIntentResponse, 'provider' | 'uploadKey' | 'uploadthingRoute' | 'resourceType'> & {
      provider: 'uploadthing'
      uploadKey: 'contratos.attachment'
      resourceType: 'raw'
      uploadthingRoute: 'contractAttachment'
    })
  | (Omit<UploadIntentResponse, 'provider' | 'uploadKey' | 'uploadthingRoute' | 'resourceType'> & {
      provider: 'uploadthing'
      uploadKey: 'contratos.version'
      resourceType: 'raw'
      uploadthingRoute: 'contractVersion'
    })

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

  const uploadOptions = {
    files: [file],
    onUploadProgress: ({ progress }: { progress: number }) => {
      onProgress?.(progress)
    },
  }

  const [uploaded] = intent.uploadthingRoute === 'productPhoto'
    ? await uploadFiles('productPhoto', {
        ...uploadOptions,
        input: {
          uploadKey: 'productos.photo',
          resourceType: 'image',
          folder: intent.folder,
          publicId: intent.publicId,
        },
      })
    : intent.uploadthingRoute === 'contractAttachment'
      ? await uploadFiles('contractAttachment', {
          ...uploadOptions,
          input: {
            uploadKey: 'contratos.attachment',
            resourceType: 'raw',
            folder: intent.folder,
            publicId: intent.publicId,
          },
        })
      : await uploadFiles('contractVersion', {
          ...uploadOptions,
          input: {
            uploadKey: 'contratos.version',
            resourceType: 'raw',
            folder: intent.folder,
            publicId: intent.publicId,
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
