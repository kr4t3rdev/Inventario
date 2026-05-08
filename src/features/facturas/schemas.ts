import { z } from 'zod';
export const updateFacturaSchema = z.object({
  facturaId: z.string().min(1),
  estado: z.enum(['PENDIENTE', 'PAGADA', 'ANULADA', 'VENCIDA']).optional(),
  tipoDocumento: z.enum(['FACTURA', 'NOTA_CREDITO', 'FACTURA_RECTIFICATIVA', 'PROFORMA']).optional(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  terminosPago: z.string().optional().nullable(),
  metodoPago: z.string().optional().nullable(),
});
export type UpdateFacturaInput = z.infer<typeof updateFacturaSchema>;
