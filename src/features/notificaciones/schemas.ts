/**
 * @description Schemas Zod para notificaciones.
 */
import { z } from 'zod';

export const createNotificacionSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  link: z.string().min(1).optional(),
  type: z.string().optional().default('info'),
  prioridad: z.enum(['alta', 'media', 'baja']).optional().default('media'),
  userId: z.string().optional(),
  isRead: z.boolean().optional(),
});

export const updateNotificacionSchema = z.object({
  id: z.string().min(1),
  isRead: z.boolean().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  link: z.string().min(1).nullable().optional(),
});

export type CreateNotificacionInput = z.infer<typeof createNotificacionSchema>;
export type UpdateNotificacionInput = z.infer<typeof updateNotificacionSchema>;
