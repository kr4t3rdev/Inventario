/**
 * @description Schemas Zod para transferencias.
 */
import { z } from 'zod';

export const TRANSFERENCIA_ESTADOS = ['PENDIENTE', 'APROBADA', 'EN_TRANSITO', 'PARCIAL', 'COMPLETADA', 'RECHAZADA', 'CANCELADA'] as const;
export type TransferenciaEstado = (typeof TRANSFERENCIA_ESTADOS)[number];

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
  /**
   * Estado inicial. Solo los dos estados coherentes al crear: COMPLETADA por
   * defecto (compatibilidad); EN_TRANSITO/PARCIAL se alcanzan con el workflow.
   */
  estado: z.enum(['PENDIENTE', 'COMPLETADA']).optional().default('COMPLETADA'),
});

export const updateTransferenciaSchema = z.object({
  transferenciaId: z.string().min(1),
  productoId: z.string().min(1),
  cantidad: z.coerce.number().int().positive(),
  tipoOrigen: z.enum(['almacen', 'punto_venta']),
  origenId: z.string().min(1),
  tipoDestino: z.enum(['almacen', 'punto_venta']),
  destinoId: z.string().min(1),
  // Sin `estado`: el workflow (aprobar/despachar/completar/rechazar) es la
  // única vía de cambio de estado; el input anterior era un campo muerto.
});

export const aprobarTransferenciaSchema = z.object({
  transferenciaId: z.string().min(1),
});

export const completarTransferenciaSchema = z.object({
  transferenciaId: z.string().min(1),
  /** Unidades recibidas en esta recepción; omitir = recibir todo el pendiente (B-02). */
  cantidadRecibida: z.coerce.number().int().min(1).optional(),
});

export const rechazarTransferenciaSchema = z.object({
  transferenciaId: z.string().min(1),
  motivo: z.string().min(1, 'El motivo de rechazo es requerido'),
});

export type CreateTransferenciaInput = z.input<typeof createTransferenciaSchema>;
export type UpdateTransferenciaInput = z.infer<typeof updateTransferenciaSchema>;
export type AprobarTransferenciaInput = z.infer<typeof aprobarTransferenciaSchema>;
export type CompletarTransferenciaInput = z.infer<typeof completarTransferenciaSchema>;
export type RechazarTransferenciaInput = z.infer<typeof rechazarTransferenciaSchema>;

export const transferenciaSchema = createTransferenciaSchema;
export type TransferenciaFormValues = z.infer<typeof transferenciaSchema>;
