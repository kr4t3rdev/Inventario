/**
 * @description Schemas Zod para contratos.
 */
import { z } from 'zod';

const estadoContratoEnum = z.enum(['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'ACTIVO', 'FINALIZADO', 'ANULADO']);

export const contratoSchema = z.object({
  tipo: z.string().min(1, 'El tipo de contrato es requerido'),
  fechaInicio: z.string().datetime(),
  fechaFin: z.string().datetime().nullable().optional(),
  monto: z.string().nullable().optional(),
  moneda: z.string().default('CUP'),
  esMultiMoneda: z.boolean().default(false).optional(),
  condiciones: z.any().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  numeroContratoClienteProveedor: z.string().nullable().optional(),
  clienteId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
}).refine(
  (data) => Boolean(data.clienteId) !== Boolean(data.vendorId),
  { message: 'Debes seleccionar solo un cliente o un proveedor', path: ['clienteId'] }
);

export const contratoUpdateSchema = z.object({
  contratoId: z.string().min(1),
  tipo: z.string().min(1).optional(),
  fechaInicio: z.string().datetime().optional(),
  fechaFin: z.string().datetime().nullable().optional(),
  monto: z.string().nullable().optional(),
  moneda: z.string().optional(),
  esMultiMoneda: z.boolean().optional(),
  condiciones: z.any().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  numeroContratoClienteProveedor: z.string().nullable().optional(),
  clienteId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  estado: estadoContratoEnum.optional(),
  fechaAprobacion: z.string().datetime().nullable().optional(),
  aprobadoPor: z.string().nullable().optional(),
});

export const bulkStatusSchema = z.object({
  ids: z.array(z.string()),
  estado: estadoContratoEnum,
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string()),
});

export type ContratoInput = z.infer<typeof contratoSchema>;
export type ContratoUpdateInput = z.infer<typeof contratoUpdateSchema>;
export type BulkStatusInput = z.infer<typeof bulkStatusSchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
