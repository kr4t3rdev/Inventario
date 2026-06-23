import type { UploadKey } from './upload-policy'
import { z } from 'zod'

export interface CloudinaryAssetUploadResult {
  uploadKey: UploadKey
  secureUrl: string
  publicId: string
  resourceType: 'image' | 'raw'
  bytes: number
  mimeType: string
  originalFilename: string
}

export const cloudinaryAssetSchema = z.object({
  uploadKey: z.string().min(1),
  secureUrl: z.string().url(),
  publicId: z.string().min(1),
  resourceType: z.enum(['image', 'raw']),
  bytes: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
  originalFilename: z.string().min(1),
})

export type CloudinaryAssetInput = z.infer<typeof cloudinaryAssetSchema>
