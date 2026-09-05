/**
 * @description Schemas Zod para ofertas.
 */
import { z } from 'zod';

const ofertaItemSchema = z.object({
  productoId: z.string().optional(),
  servicioId: z.string().optional(),
  cantidad: z.number().int().positive(),
  // Se aceptan por compatibilidad con clientes antiguos, pero nunca son autoridad.
  precioUnitario: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
}).refine((item) => Boolean(item.productoId) !== Boolean(item.servicioId), {
  message: 'Cada línea debe referir un producto o un servicio',
});

export const ofertaSchema = z.object({
  clienteId: z.string().min(1, 'Cliente requerido'),
  fechaVencimiento: z.string().optional(),
  subtotal: z.number().nonnegative(),
  impuestos: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  observaciones: z.string().optional(),
  items: z.array(ofertaItemSchema).min(1, 'Al menos un item requerido'),
});

export const ofertaUpdateSchema = z.object({
  ofertaId: z.string().min(1),
  estado: z.enum(['PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'FACTURADA']).optional(),
  observaciones: z.string().optional(),
});

export const facturarOfertaSchema = z.object({
  ofertaId: z.string().min(1),
  puntoDeVentaId: z.string().min(1, 'Punto de Venta requerido'),
  empleadoId: z.string().optional(),
  observaciones: z.string().optional(),
  cargoTransporte: z.number().optional(),
  serieId: z.string().optional(),
  cuentaBancariaId: z.string().optional(),
  fechaVencimiento: z.string().nullable().optional(),
  tipoVencimiento: z.string().optional(),
  anticipoCobroId: z.string().optional(),
  formaPagoAnticipo: z.enum(['ANTICIPO_COBRO']).optional(),
  idempotencyKey: z.string().optional(),
}).refine(
  (data) => (data.anticipoCobroId ? !!data.idempotencyKey : true),
  { message: 'idempotencyKey es obligatorio con anticipo', path: ['idempotencyKey'] }
);

export type OfertaInput = z.infer<typeof ofertaSchema>;
export type OfertaUpdateInput = z.infer<typeof ofertaUpdateSchema>;
export type FacturarOfertaInput = z.infer<typeof facturarOfertaSchema>;
