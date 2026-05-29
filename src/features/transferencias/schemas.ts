/**
 * @description Schemas Zod para transferencias.
 */
import { z } from 'zod';

export const TRANSFERENCIA_ESTADOS = ['PENDIENTE', 'APROBADA', 'EN_TRANSITO', 'COMPLETADA', 'RECHAZADA', 'CANCELADA'] as const;
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
  /** Estado inicial. Por defecto COMPLETADA para mantener compatibilidad. */
  estado: z.enum(TRANSFERENCIA_ESTADOS).optional().default('COMPLETADA'),
});

export const updateTransferenciaSchema = z.object({
  transferenciaId: z.string().min(1),
  productoId: z.string().min(1),
  cantidad: z.coerce.number().int().positive(),
  tipoOrigen: z.enum(['almacen', 'punto_venta']),
  origenId: z.string().min(1),
  tipoDestino: z.enum(['almacen', 'punto_venta']),
  destinoId: z.string().min(1),
  /** Estado al que cambiar la transferencia. Permite transiciones manuales. */
  estado: z.enum(TRANSFERENCIA_ESTADOS).optional(),
});

export const aprobarTransferenciaSchema = z.object({
  transferenciaId: z.string().min(1),
});

export const completarTransferenciaSchema = z.object({
  transferenciaId: z.string().min(1),
});

export const rechazarTransferenciaSchema = z.object({
  transferenciaId: z.string().min(1),
  motivo: z.string().min(1, 'El motivo de rechazo es requerido'),
});

export type CreateTransferenciaInput = z.infer<typeof createTransferenciaSchema>;
export type UpdateTransferenciaInput = z.infer<typeof updateTransferenciaSchema>;
export type AprobarTransferenciaInput = z.infer<typeof aprobarTransferenciaSchema>;
export type CompletarTransferenciaInput = z.infer<typeof completarTransferenciaSchema>;
export type RechazarTransferenciaInput = z.infer<typeof rechazarTransferenciaSchema>;
