import { z } from 'zod';

/**
 * @description Schema de creación de Servicios.
 * Solo acepta campos persistidos en Prisma (nombre, descripcion, precio, moneda).
 * Campos extra son rechazados con VALIDATION_ERROR via .strict().
 */
export const servicioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  precio: z.coerce.number().int().positive('El precio debe ser mayor a 0'),
  // C-3: costo estándar unitario (opcional, default 0); es la única fuente
  // del costo de las ventas de servicios.
  costo: z.coerce.number().int().min(0, 'El costo no puede ser negativo').optional(),
  moneda: z.string().optional(), // Persistido en Prisma con default "CUP"
}).strict();

/**
 * @description Schema de actualización de Servicios.
 * Mismos campos que create, todos opcionales excepto servicioId.
 */
export const servicioUpdateSchema = z.object({
  servicioId: z.string().min(1),
  nombre: z.string().min(1).optional(),
  descripcion: z.string().min(1).optional(),
  precio: z.coerce.number().int().positive().optional(),
  costo: z.coerce.number().int().min(0, 'El costo no puede ser negativo').optional(),
  moneda: z.string().optional(),
}).strict();

export type ServicioInput = z.infer<typeof servicioSchema>;
export type ServicioUpdateInput = z.infer<typeof servicioUpdateSchema>;
