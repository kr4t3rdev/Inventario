/**
 * @description Endpoint para generar firmas de signed upload a Cloudinary.
 *  El cliente solicita una firma con un folder RELATIVO (ej: "productos"),
 *  y el servidor lo prefija con el tenantId del usuario autenticado.
 *
 * POST /api/upload/sign
 * Body: { folder: string; publicId?: string; resourceType?: 'image' | 'raw' }
 *  - folder: ruta relativa SIN tenantId (ej: "productos", "clientes/logo", "reparaciones/orden-123/fotos")
 * Response: { signature, timestamp, apiKey, cloudName, folder, publicId? }
 *  - folder: ruta completa prefijada con tenantId (ej: "tenant-123/productos")
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/server-actions'
import { generateUploadSignature } from '@/lib/cloudinary'
import { ActionError } from '@/lib/server-actions/types'
import { resolveUploadPolicy, type UploadKey } from '@/lib/upload/upload-policy'

const uploadIntentSchema = z.object({
  uploadKey: z.custom<UploadKey>((value) => typeof value === 'string' && value.length > 0, {
    message: 'uploadKey is required',
  }),
  filename: z.string().min(1, 'filename is required'),
  mimeType: z.string().min(1, 'mimeType is required'),
  bytes: z.number().int().positive('bytes must be positive'),
  entityId: z.string().min(1).optional(),
})

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticar usuario
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'User has no tenant context' },
        { status: 400 }
      )
    }

    // 2. Parsear request y resolver policy server-side
    const body = uploadIntentSchema.parse(await request.json())
    const policy = resolveUploadPolicy({
      uploadKey: body.uploadKey,
      user,
      input: {
        filename: body.filename,
        mimeType: body.mimeType,
        bytes: body.bytes,
        entityId: body.entityId,
      },
    })

    // 3. Generar firma
    const signature = generateUploadSignature(policy)

    return NextResponse.json(signature)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid upload request' },
        { status: 400 }
      )
    }

    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE'
        ? 403
        : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }

    console.error('Error generating upload signature:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload signature' },
      { status: 500 }
    )
  }
}
