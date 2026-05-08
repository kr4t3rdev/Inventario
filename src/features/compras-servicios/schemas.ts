/**
 * @description Schemas Zod para compras de servicios.
 */
import { z } from 'zod';

export const anticipoAllocationSchema = z.object({
  anticipoId: z.string().min(1),
  montoAplicado: z.number().positive(),
});

export const createCompraServicioSchema = z.object({
  servicioId: z.string().min(1, 'Seleccione un servicio'),
  proveedorId: z.string().optional().nullable(),
  numeroFactura: z.string().optional().nullable(),
  costoUnitario: z.coerce.number().int().positive('El costo unitario debe ser mayor a 0'),
  cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO', 'ANTICIPO_PAGO']),
  estado: z.enum(['PENDIENTE', 'PAGADA']),
  descripcion: z.string().optional().nullable(),
  fechaServicio: z.string().datetime().optional().nullable(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
  anticipos: z.array(anticipoAllocationSchema).optional(),
});

export const updateCompraServicioSchema = z.object({
  compraServicioId: z.string().min(1),
  numeroFactura: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO', 'ANTICIPO_PAGO']).optional(),
  estado: z.enum(['PENDIENTE', 'PAGADA']).optional(),
  costoUnitario: z.coerce.number().int().positive().optional(),
  cantidad: z.coerce.number().int().positive().optional(),
  proveedorId: z.string().optional().nullable(),
  fechaServicio: z.string().datetime().optional().nullable(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
});

export type CreateCompraServicioInput = z.infer<typeof createCompraServicioSchema>;
export type UpdateCompraServicioInput = z.infer<typeof updateCompraServicioSchema>;
