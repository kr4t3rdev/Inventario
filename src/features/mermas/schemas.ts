/**
 * @description Schemas Zod para mermas.
 */
import { z } from 'zod';

export const createMermaSchema = z.object({
  productoId: z.string().min(1, 'Producto requerido'),
  cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  motivo: z.string().optional().nullable(),
  /** Almacén del que se descuenta el stock. Si se omite, se usa el stock global. */
  almacenId: z.string().optional().nullable(),
  /** Clave de idempotencia provista por el cliente. Un reintento con la misma
   * clave devuelve la merma existente en lugar de duplicarla. */
  idempotencyKey: z.string().min(1).max(64).optional().nullable(),
});

export const updateMermaSchema = z.object({
  mermaId: z.string().min(1),
  productoId: z.string().min(1).optional(),
  cantidad: z.coerce.number().int().positive().optional(),
  motivo: z.string().optional().nullable(),
  almacenId: z.string().optional().nullable(),
});

export type CreateMermaInput = z.infer<typeof createMermaSchema>;
export type UpdateMermaInput = z.infer<typeof updateMermaSchema>;
