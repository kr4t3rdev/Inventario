import prisma from '@/lib/prisma'
import { getAuthenticatedContext } from '@/lib/api/client'
import { ServerActionError } from '@/lib/api/errors'
import { replaceOwnerAsset } from '@/lib/upload/cloudinary-admin'
import type { CloudinaryAssetInput } from '@/lib/upload/cloudinary-asset'
import type { Usuario } from '@/app/models/model'

/**
 * @description Obtiene el perfil del usuario autenticado.
 * @returns Array con un elemento (el usuario autenticado)
 * @throws {ServerActionError} si no está autenticado o hay error de base de datos
 */
export async function getProfile(): Promise<Usuario[]> {
  const { userId } = await getAuthenticatedContext()

  try {
  // @ts-expect-error -- generated Prisma types in this project lag behind the selected shape
    return await prisma.user.findMany({
      where: { userId },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        activatedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch (error) {
    throw new ServerActionError(
      'getProfile',
      'GET',
      500,
      error instanceof Error ? error.message : 'Error al obtener perfil',
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * @description Actualiza el perfil del usuario autenticado.
 * @param data - Campos a actualizar (name, avatar)
 * @returns El usuario actualizado
 * @throws {ServerActionError} si no está autenticado o hay error de base de datos
 */
export async function updateProfile(
  data: { name?: string; avatar?: string; avatarAsset?: CloudinaryAssetInput | null }
): Promise<any> {
  const { userId, tenantId } = await getAuthenticatedContext()

  try {
    const profile = await prisma.user.update({
      where: { userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
      },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        activatedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (tenantId && data.avatarAsset) {
      await replaceOwnerAsset({
        tenantId,
        ownerType: 'user',
        ownerId: userId,
        slot: 'avatar',
        asset: data.avatarAsset,
      })
    }

    return profile
  } catch (error) {
    throw new ServerActionError(
      'updateProfile',
      'PUT',
      500,
      error instanceof Error ? error.message : 'Error al actualizar perfil',
      error instanceof Error ? error : undefined
    )
  }
}
