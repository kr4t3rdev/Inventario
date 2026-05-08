/**
 * @description Server Actions para el feature de Profile.
 *
 * @module features/profile/actions
 */
'use server';

import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { profileUpdateSchema } from './schemas';
import type { ProfileUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const PROFILE_SELECT = {
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
} as const;

/**
 * @description Obtiene el perfil del usuario autenticado.
 */
export const getProfileAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const profile = await prisma.user.findUnique({
    where: { userId: user.userId },
    select: PROFILE_SELECT,
  });

  if (!profile) {
    throw new ActionError('Perfil no encontrado', 'NOT_FOUND');
  }

  return profile;
});

/**
 * @description Actualiza el perfil del usuario autenticado.
 */
export const updateProfileAction = withAction(async (input: ProfileUpdateInput, user: AuthenticatedUser) => {
  const parsed = profileUpdateSchema.parse(input);

  const profile = await prisma.user.update({
    where: { userId: user.userId },
    data: {
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.avatar !== undefined && { avatar: parsed.avatar }),
    },
    select: PROFILE_SELECT,
  });

  return profile;
});
