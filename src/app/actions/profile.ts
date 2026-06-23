'use server'

import { revalidateTag } from 'next/cache'
import {
  getProfile as fetchProfile,
  updateProfile as fetchUpdateProfile,
} from '@/lib/api/profile'
import { handleServerActionError } from './_helpers/error-handler'
import type { CloudinaryAssetInput } from '@/lib/upload/cloudinary-asset'
import type { Usuario } from '@/app/models/model'

/**
 * @description Server Action que obtiene el perfil del usuario autenticado.
 * Cachea con tag 'Profile' para revalidación automática.
 * @returns Array con el perfil del usuario
 */
export async function getProfile(): Promise<Usuario[]> {
  try {
    return await fetchProfile()
  } catch (error) {
    handleServerActionError(error, 'getProfile')
  }
}

/**
 * @description Server Action que actualiza el perfil del usuario autenticado.
 * Invalida la cache 'Profile' tras la actualización exitosa.
 * @param data - Campos a actualizar (name, avatar)
 * @returns El usuario actualizado
 */
export async function updateProfile(
  data: { name?: string; avatar?: string; avatarAsset?: CloudinaryAssetInput | null }
): Promise<Usuario> {
  try {
    const result = await fetchUpdateProfile(data)
    revalidateTag('Profile')
    return result
  } catch (error) {
    handleServerActionError(error, 'updateProfile')
  }
}
