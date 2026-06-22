/**
 * @description Helper de cliente para subir archivos directamente a Cloudinary
 * usando signed uploads. Obtiene una firma del servidor y luego sube el archivo
 * directamente a Cloudinary sin pasar por el servidor.
 *
 * El folder que recibe es RELATIVO (ej: "productos", "clientes/cli-1/logo").
 * El servidor se encarga de prefijarlo con el tenantId del usuario autenticado.
 */

export interface UploadOptions {
  resourceType?: 'image' | 'raw'
  publicId?: string
  onProgress?: (progress: number) => void
}

export interface UploadResponse {
  secure_url: string
  public_id: string
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
 * @param {string} folder - Carpeta RELATIVA (ej: "productos", "clientes/cli-1/logo")
 * @param {UploadOptions} [options] - Opciones adicionales
 * @param {'image' | 'raw'} [options.resourceType='image'] - Tipo de recurso
 * @param {string} [options.publicId] - ID público opcional
 * @param {(progress: number) => void} [options.onProgress] - Callback de progreso
 * @returns {Promise<string>} URL segura del archivo subido (secure_url)
 * @throws {Error} Si falla la obtención de firma o el upload a Cloudinary
 */
export async function uploadToCloudinary(
  file: File,
  folder: string,
  options: UploadOptions = {}
): Promise<string> {
  const { resourceType = 'image', publicId, onProgress } = options

  // 1. Obtener firma del servidor (server prefija tenantId)
  const signResponse = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, publicId, resourceType }),
  })

  if (!signResponse.ok) {
    throw new Error('Failed to get upload signature')
  }

  const {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder: fullFolder,
  } = await signResponse.json()

  // 2. Preparar FormData para Cloudinary (usar el folder prefijado por el server)
  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', apiKey)
  formData.append('timestamp', timestamp.toString())
  formData.append('signature', signature)
  formData.append('folder', fullFolder)

  if (publicId) {
    formData.append('public_id', publicId)
  }

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

  return result.secure_url
}
