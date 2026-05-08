/**
 * @description Schemas Zod para actualización de perfil de usuario.
 */
import { z } from 'zod';

export const profileUpdateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').optional(),
  avatar: z.string().optional().nullable(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
