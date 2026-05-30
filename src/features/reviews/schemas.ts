import { z } from 'zod';

/**
 * @description Esquema de validación para crear/actualizar una reseña.
 */
export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Seleccioná una calificación').max(5),
  comment: z
    .string()
    .max(500, 'El comentario no puede superar los 500 caracteres')
    .optional(),
});

/**
 * @description Esquema para filtrar listado de reseñas.
 */
export const reviewFilterSchema = z.object({
  isApproved: z.boolean().optional(),
  orderBy: z.enum(['rating_desc', 'rating_asc', 'newest']).optional(),
  limit: z.number().int().min(1).max(10).optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
export type ReviewFilter = z.infer<typeof reviewFilterSchema>;
