/**
 * @description Schemas Zod para listas de precios.
 */
import { z } from 'zod';

export const listaPrecioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional().nullable(),
  esDefault: z.boolean().optional().default(false),
});

export const listaPrecioUpdateSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1, 'El nombre es requerido').optional(),
  descripcion: z.string().optional().nullable(),
  esDefault: z.boolean().optional(),
});

export type ListaPrecioInput = z.infer<typeof listaPrecioSchema>;
export type ListaPrecioUpdateInput = z.infer<typeof listaPrecioUpdateSchema>;
