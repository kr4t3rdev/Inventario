import { z } from 'zod'
import { createUploadthing, type FileRouter, UTFiles } from 'uploadthing/next'
import type { NextRequest } from 'next/server'

import { authenticateUser } from '@/lib/auth-middleware'
import { resolveUploadPolicy, type UploadKey } from '@/lib/upload/upload-policy'

const f = createUploadthing()

const uploadthingInputSchema = z.object({
  uploadKey: z.custom<UploadKey>((value) => typeof value === 'string' && value.length > 0, {
    message: 'uploadKey is required',
  }),
  resourceType: z.enum(['image', 'raw']),
  folder: z.string().min(1, 'folder is required'),
  publicId: z.string().min(1, 'publicId is required'),
})

const contractAttachmentConfig = {
  'application/pdf': { maxFileSize: '10MB', maxFileCount: 10 },
  'application/msword': { maxFileSize: '10MB', maxFileCount: 10 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    maxFileSize: '10MB',
    maxFileCount: 10,
  },
  'image/jpeg': { maxFileSize: '10MB', maxFileCount: 10 },
  'image/jpg': { maxFileSize: '10MB', maxFileCount: 10 },
  'image/png': { maxFileSize: '10MB', maxFileCount: 10 },
  'image/webp': { maxFileSize: '10MB', maxFileCount: 10 },
} as const

type UploadthingInput = z.infer<typeof uploadthingInputSchema>

export type UploadthingRoute =
  | 'productPhoto'
  | 'contractAttachment'
  | 'contractVersion'

async function resolveUploadthingPolicy(
  req: NextRequest,
  input: UploadthingInput,
  files: Array<{ name: string; size: number; type: string }>
) {
  const authResult = await authenticateUser(req)
  if ('status' in authResult) {
    throw new Error('Unauthorized upload')
  }

  const user = authResult.user
  if (!user.tenantId) {
    throw new Error('User has no tenant context')
  }

  const file = files[0]
  if (!file) {
    throw new Error('No file received for upload')
  }

  const policy = resolveUploadPolicy({
    uploadKey: input.uploadKey,
    user,
    input: {
      filename: file.name,
      mimeType: file.type,
      bytes: file.size,
    },
  })

  if (policy.provider !== 'uploadthing') {
    throw new Error(`Upload key ${policy.uploadKey} is not configured for UploadThing`)
  }

  if (
    policy.folder !== input.folder ||
    policy.publicId !== input.publicId ||
    policy.resourceType !== input.resourceType
  ) {
    throw new Error('Upload intent mismatch')
  }

  return policy
}

function withCustomId(
  files: Array<{ name: string; size: number; type: string }>,
  customId: string
) {
  return files.map((file) => ({
    ...file,
    customId,
  }))
}

export const uploadRouter = {
  productPhoto: f({
    image: {
      maxFileSize: '2MB',
      maxFileCount: 1,
    },
  })
    .input(
      uploadthingInputSchema.extend({
        uploadKey: z.literal('productos.photo'),
        resourceType: z.literal('image'),
      })
    )
    .middleware(async ({ req, input, files }) => {
      const policy = await resolveUploadthingPolicy(req, input, files)

      return {
        uploadKey: policy.uploadKey,
        publicId: policy.publicId,
        resourceType: policy.resourceType,
        [UTFiles]: withCustomId(files, policy.publicId),
      }
    })
    .onUploadComplete(async ({ metadata }) => ({
      provider: 'uploadthing' as const,
      uploadKey: metadata.uploadKey,
      publicId: metadata.publicId,
      resourceType: metadata.resourceType,
    })),

  contractAttachment: f(contractAttachmentConfig)
    .input(
      uploadthingInputSchema.extend({
        uploadKey: z.literal('contratos.attachment'),
        resourceType: z.literal('raw'),
      })
    )
    .middleware(async ({ req, input, files }) => {
      const policy = await resolveUploadthingPolicy(req, input, files)

      return {
        uploadKey: policy.uploadKey,
        publicId: policy.publicId,
        resourceType: policy.resourceType,
        [UTFiles]: withCustomId(files, policy.publicId),
      }
    })
    .onUploadComplete(async ({ metadata }) => ({
      provider: 'uploadthing' as const,
      uploadKey: metadata.uploadKey,
      publicId: metadata.publicId,
      resourceType: metadata.resourceType,
    })),

  contractVersion: f(contractAttachmentConfig)
    .input(
      uploadthingInputSchema.extend({
        uploadKey: z.literal('contratos.version'),
        resourceType: z.literal('raw'),
      })
    )
    .middleware(async ({ req, input, files }) => {
      const policy = await resolveUploadthingPolicy(req, input, files)

      return {
        uploadKey: policy.uploadKey,
        publicId: policy.publicId,
        resourceType: policy.resourceType,
        [UTFiles]: withCustomId(files, policy.publicId),
      }
    })
    .onUploadComplete(async ({ metadata }) => ({
      provider: 'uploadthing' as const,
      uploadKey: metadata.uploadKey,
      publicId: metadata.publicId,
      resourceType: metadata.resourceType,
    })),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
