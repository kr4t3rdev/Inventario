/**
 * @description Schemas Zod para actualización de perfil de usuario.
 */
import { z } from 'zod';
import { cloudinaryAssetSchema } from '@/lib/upload/cloudinary-asset';

export const profileUpdateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').optional(),
  avatar: z.string().optional().nullable(),
  avatarAsset: cloudinaryAssetSchema.optional().nullable(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
