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
import { getCurrentUser } from '@/lib/server-actions'
import { generateUploadSignature } from '@/lib/cloudinary'

/**
 * @description Valida que el folder sea una ruta relativa segura.
 *  Rechaza path traversal, leading slashes y caracteres peligrosos.
 *
 * @param {string} folder - Folder relativo a validar
 * @returns {boolean} true si es válido
 */
function isValidRelativeFolder(folder: string): boolean {
  if (!folder || folder.trim() === '') return false
  if (folder.startsWith('/') || folder.endsWith('/')) return false
  if (folder.includes('..')) return false
  if (folder.includes('//')) return false
  // Solo permitir caracteres seguros: letras, números, guiones, underscores, slashes
  return /^[a-zA-Z0-9_\-/]+$/.test(folder)
}

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

    // 2. Parsear request
    const body = await request.json()
    const { folder, publicId, resourceType = 'image' } = body as {
      folder?: string
      publicId?: string
      resourceType?: string
    }

    // 3. Validar folder relativo
    if (!isValidRelativeFolder(folder ?? '')) {
      return NextResponse.json(
        { error: 'Invalid folder: must be a relative path (no leading/trailing slashes, no "..", alphanumeric with -_/ only)' },
        { status: 400 }
      )
    }

    // 4. Validar resourceType
    if (resourceType !== 'image' && resourceType !== 'raw') {
      return NextResponse.json(
        { error: 'Invalid resourceType: must be "image" or "raw"' },
        { status: 400 }
      )
    }

    // 5. Construir folder completo prefijado con tenantId
    const fullFolder = `${user.tenantId}/${folder}`

    // 6. Generar firma
    const signature = generateUploadSignature(
      fullFolder,
      publicId,
      resourceType as 'image' | 'raw'
    )

    return NextResponse.json(signature)
  } catch (error) {
    console.error('Error generating upload signature:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload signature' },
      { status: 500 }
    )
  }
}
