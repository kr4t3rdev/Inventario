/**
 * @description Schemas Zod para transferencias.
 */
import { z } from 'zod';

export const transferenciaItemSchema = z.object({
  productoId: z.string().min(1),
  cantidad: z.coerce.number().int().positive(),
});

export const createTransferenciaSchema = z.object({
  productos: z.array(transferenciaItemSchema).min(1, 'Se requiere al menos un producto'),
  tipoOrigen: z.enum(['almacen', 'punto_venta']),
  origenId: z.string().min(1),
  tipoDestino: z.enum(['almacen', 'punto_venta']),
  destinoId: z.string().min(1),
  descripcion: z.string().optional().nullable(),
});

export const updateTransferenciaSchema = z.object({
  transferenciaId: z.string().min(1),
  productoId: z.string().min(1),
  cantidad: z.coerce.number().int().positive(),
  tipoOrigen: z.enum(['almacen', 'punto_venta']),
  origenId: z.string().min(1),
  tipoDestino: z.enum(['almacen', 'punto_venta']),
  destinoId: z.string().min(1),
});

export type CreateTransferenciaInput = z.infer<typeof createTransferenciaSchema>;
export type UpdateTransferenciaInput = z.infer<typeof updateTransferenciaSchema>;
