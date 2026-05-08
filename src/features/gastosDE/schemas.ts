import { z } from 'zod';
export const gastosDESchema = z.object({
  tipo: z.string().optional().nullable(),
  conceptoId: z.string().optional().nullable(),
  elementoId: z.string().optional().nullable(),
  proveedor: z.string().min(1, 'El proveedor es requerido'),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  numeroFactura: z.string().optional().nullable(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM').optional(),
});
export const gastosDEUpdateSchema = z.object({
  gastosDEId: z.string().min(1),
  tipo: z.string().optional().nullable(),
  conceptoId: z.string().optional().nullable(),
  elementoId: z.string().optional().nullable(),
  proveedor: z.string().min(1).optional(),
  monto: z.coerce.number().positive().optional(),
  descripcion: z.string().min(1).optional(),
  numeroFactura: z.string().optional().nullable(),
  periodo: z.string().optional(),
});
export type GastosDEInput = z.infer<typeof gastosDESchema>;
export type GastosDEUpdateInput = z.infer<typeof gastosDEUpdateSchema>;
