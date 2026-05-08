/**
 * @description Zod schemas para validación de inputs de Cuentas por Cobrar y Pagar.
 *
 * @module features/contabilidad/schemas-cuentas
 */
import { z } from 'zod';

// ═══ Cuentas por Cobrar ═══

export const getCuentasPorCobrarSchema = z.object({
  estado: z.enum(['PENDIENTE', 'PAGADA', 'PARCIAL']).optional(),
  clienteId: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const createCuentaPorCobrarSchema = z.object({
  ventaId: z.string().min(1, 'El ID de venta es requerido'),
  clienteId: z.string().min(1, 'El ID de cliente es requerido'),
  monto: z.number().positive('El monto debe ser mayor que 0'),
  moneda: z.enum(['CUP', 'USD']).default('CUP'),
  numeroFactura: z.string().optional(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
});

export const updateCuentaPorCobrarSchema = z.object({
  id: z.string().min(1),
  estado: z.enum(['PENDIENTE', 'PAGADA', 'PARCIAL']).optional(),
  montoDeuda: z.number().positive().optional(),
  montoPagado: z.number().min(0).optional(),
  idTransferencia: z.string().optional(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
});

// ═══ Cuentas por Pagar ═══

export const getCuentasPorPagarSchema = z.object({
  estado: z.enum(['PENDIENTE', 'PAGADA', 'PARCIAL']).optional(),
  tipo: z.enum(['compra', 'servicio']).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

export const createCuentaPorPagarSchema = z.object({
  numeroFactura: z.string().min(1, 'El número de factura es requerido'),
  tipo: z.enum(['compra', 'servicio'], {
    required_error: 'El tipo es requerido',
  }),
  proveedorId: z.string().min(1, 'El proveedor es requerido'),
  proveedorNombre: z.string().optional(),
  montoDeuda: z.number().positive('El monto debe ser mayor que 0'),
  moneda: z.enum(['CUP', 'USD']).default('CUP'),
  fechaEmision: z.string().datetime().optional(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
  gastoCompraId: z.string().optional().nullable(),
  gastosDEId: z.string().optional().nullable(),
});

export const pagarCuentaPorPagarSchema = z.object({
  numeroFactura: z.string().min(1, 'El número de factura es requerido'),
  tipo: z.enum(['compra', 'servicio']),
  monto: z.number().positive('El monto debe ser mayor que 0'),
  numeroTransaccion: z.string().min(1, 'El número de transacción es requerido'),
  cuentaProveedor: z.string().min(1, 'La cuenta del proveedor es requerida'),
  observaciones: z.string().optional(),
});

// ═══ Types inferidos ═══

export type GetCuentasPorCobrarInput = z.infer<typeof getCuentasPorCobrarSchema>;
export type CreateCuentaPorCobrarInput = z.infer<typeof createCuentaPorCobrarSchema>;
export type UpdateCuentaPorCobrarInput = z.infer<typeof updateCuentaPorCobrarSchema>;

export type GetCuentasPorPagarInput = z.infer<typeof getCuentasPorPagarSchema>;
export type CreateCuentaPorPagarInput = z.infer<typeof createCuentaPorPagarSchema>;
export type PagarCuentaPorPagarInput = z.infer<typeof pagarCuentaPorPagarSchema>;
