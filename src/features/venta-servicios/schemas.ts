/**
 * @description Schemas Zod para ventas de servicios.
 */
import { z } from 'zod';

export const anticipoAllocationSchema = z.object({
  anticipoId: z.string().min(1),
  montoAplicado: z.number().positive(),
});

export const lineaMixtaSchema = z.object({
  tipoLinea: z.enum(['SERVICIO', 'PRODUCTO']),
  servicioId: z.string().optional(),
  productoId: z.string().optional(),
  cantidad: z.coerce.number().int().positive(),
  observaciones: z.string().optional().nullable(),
  // Nota: el precio y el costo los resuelve el servidor desde el catálogo
  // (C-3); no se aceptan del cliente.
}).strict().superRefine((linea, ctx) => {
  if (linea.tipoLinea === 'SERVICIO' && !linea.servicioId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'servicioId requerido para línea de servicio' });
  }
  if (linea.tipoLinea === 'PRODUCTO' && !linea.productoId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'productoId requerido para línea de producto' });
  }
});

export const ventaMixtaSchema = z.object({
  clienteId: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  lineas: z.array(lineaMixtaSchema).min(1),
  // B-06: CONTADO (default) cobra al momento; CREDITO crea cuenta por cobrar.
  condicionPago: z.enum(['CONTADO', 'CREDITO']).optional().default('CONTADO'),
  fechaVencimiento: z.string().optional().nullable(),
}).strict();

export const ventaServicioLegacySchema = z.object({
  servicioId: z.string().min(1),
  cantidad: z.coerce.number().int().positive(),
  observaciones: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  anticipos: z.array(anticipoAllocationSchema).optional(),
  // B-06: CONTADO (default) cobra al momento; CREDITO crea cuenta por cobrar.
  condicionPago: z.enum(['CONTADO', 'CREDITO']).optional().default('CONTADO'),
  fechaVencimiento: z.string().optional().nullable(),
  // Nota: `precioUnitario`, `total` y `costo` se resuelven en el servidor desde
  // el catálogo (C-3); no se aceptan del cliente.
}).strict();

export const updateVentaServicioSchema = z.object({
  ventaServicioId: z.string().min(1),
  cantidad: z.coerce.number().int().positive().optional(),
  observaciones: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  // Nota: `total` y `costo` no se aceptan del cliente; el total se recalcula
  // con el precio unitario persistido y el costo es el snapshot histórico (C-3).
}).strict();

export type VentaServicioInput = z.infer<typeof ventaServicioLegacySchema>;
export type VentaMixtaInput = z.infer<typeof ventaMixtaSchema>;
export type VentaServicioUpdateInput = z.infer<typeof updateVentaServicioSchema>;
