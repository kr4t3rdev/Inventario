import { z } from 'zod';
export const gastosDESchema = z.object({
  tipo: z.string().optional().nullable(),
  conceptoId: z.string().optional().nullable(),
  elementoId: z.string().optional().nullable(),
  proveedor: z.string().max(200).optional(),
  // Vínculo al catálogo de proveedores (B-04). Si viene, el nombre se canoniza del catálogo.
  proveedorId: z.string().min(1).optional(),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  numeroFactura: z.string().optional().nullable(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM').optional(),
}).refine(
  (data) => !!data.proveedorId || !!data.proveedor?.trim(),
  { message: 'El proveedor es requerido (selecciónelo del catálogo o escriba el nombre)', path: ['proveedor'] },
);
export const gastosDEUpdateSchema = z.object({
  gastosDEId: z.string().min(1),
  tipo: z.string().optional().nullable(),
  conceptoId: z.string().optional().nullable(),
  elementoId: z.string().optional().nullable(),
  proveedor: z.string().min(1).optional(),
  proveedorId: z.string().min(1).optional().nullable(),
  monto: z.coerce.number().positive().optional(),
  descripcion: z.string().min(1).optional(),
  numeroFactura: z.string().optional().nullable(),
  periodo: z.string().optional(),
});
export type GastosDEInput = z.infer<typeof gastosDESchema>;
export type GastosDEUpdateInput = z.infer<typeof gastosDEUpdateSchema>;
