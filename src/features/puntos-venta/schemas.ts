import { z } from 'zod';
export const pvSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  ubicacion: z.string().optional().nullable(),
  listaPrecioId: z.string().optional().nullable(),
});
export const pvUpdateSchema = z.object({
  pvId: z.string().min(1),
  nombre: z.string().min(1).optional(),
  ubicacion: z.string().optional().nullable(),
  listaPrecioId: z.string().optional().nullable(),
});
export type PvInput = z.infer<typeof pvSchema>;
export type PvUpdateInput = z.infer<typeof pvUpdateSchema>;
