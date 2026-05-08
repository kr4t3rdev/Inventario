/**
 * @description Schemas Zod para mermas.
 */
import { z } from 'zod';

export const createMermaSchema = z.object({
  productoId: z.string().min(1, 'Producto requerido'),
  cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  motivo: z.string().optional().nullable(),
});

export const updateMermaSchema = z.object({
  mermaId: z.string().min(1),
  productoId: z.string().min(1).optional(),
  cantidad: z.coerce.number().int().positive().optional(),
  motivo: z.string().optional().nullable(),
});

export type CreateMermaInput = z.infer<typeof createMermaSchema>;
export type UpdateMermaInput = z.infer<typeof updateMermaSchema>;
