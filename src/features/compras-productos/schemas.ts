/**
 * @description Schemas Zod para compras de productos.
 */
import { z } from 'zod';

const itemSchema = z.object({
  productoId: z.string().min(1, 'Seleccione un producto'),
  precioCosto: z.coerce.number().positive('El precio de costo debe ser mayor a 0'),
  cantidad: z.coerce.number().int('Debe ser un entero').positive('Debe ser mayor a 0'),
});

export const createCompraProductoSchema = z.object({
  proveedorId: z.string().min(1, 'Seleccione un proveedor'),
  numeroFactura: z.string().optional().default(''),
  facturaUrl: z.string().optional().default(''),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO', 'ANTICIPO_PAGO']),
  estado: z.enum(['PENDIENTE', 'PAGADA']),
  descripcionCompra: z.string().max(500).optional(),
  fechaVencimiento: z.string().optional(),
  anticipoPagoId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Debe incluir al menos un producto'),
}).refine(
  (data) => {
    if (data.formaPago === 'PAGO_COMPLETO' || data.formaPago === 'ANTICIPO_PAGO') return data.estado === 'PAGADA';
    return data.estado === 'PENDIENTE';
  },
  { message: 'Estado no coincide con la forma de pago', path: ['estado'] }
).refine(
  (data) => (data.formaPago === 'ANTICIPO_PAGO' ? !!data.anticipoPagoId : true),
  { message: 'Debe indicar un anticipo', path: ['anticipoPagoId'] }
).refine(
  (data) => (data.formaPago === 'ANTICIPO_PAGO' ? !!data.idempotencyKey : true),
  { message: 'Debe indicar idempotencyKey', path: ['idempotencyKey'] }
);

export const updateCompraProductoSchema = z.object({
  compraDocumentoId: z.string().min(1),
  numeroFactura: z.string().optional(),
  facturaUrl: z.string().optional(),
  descripcion: z.string().max(500).optional(),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO']).optional(),
  estado: z.enum(['PENDIENTE', 'PAGADA']).optional(),
}).refine(
  (data) => {
    if (data.formaPago === 'PAGO_COMPLETO' && data.estado) return data.estado === 'PAGADA';
    if (data.formaPago === 'PAGO_PARCIAL' && data.estado) return data.estado === 'PENDIENTE';
    return true;
  },
  { message: 'Estado no coincide con la forma de pago', path: ['estado'] }
);

export type CreateCompraProductoInput = z.infer<typeof createCompraProductoSchema>;
export type UpdateCompraProductoInput = z.infer<typeof updateCompraProductoSchema>;
