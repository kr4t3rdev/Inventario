/**
 * @description Schemas Zod compartidos para validación de almacenes.
 *
 * Se usan tanto en el cliente (React Hook Form + zodResolver)
 * como en el servidor (Server Actions con withAction).
 */
import { z } from 'zod';

/**
 * Schema para creación de almacén.
 * Solo requiere nombre (único por tenant a nivel BD).
 */
export const almacenSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre es requerido' })
    .min(1, 'El nombre es requerido')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
});

/**
 * Schema para actualización de almacén.
 * Todos los campos son opcionales, pero se requiere almacenId.
 */
export const almacenUpdateSchema = z.object({
  almacenId: z.string().min(1, 'El ID del almacén es requerido'),
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(150, 'El nombre no puede exceder 150 caracteres')
    .optional(),
});

// ─── Tipos inferidos ──────────────────────────────────────

export type AlmacenInput = z.infer<typeof almacenSchema>;
export type AlmacenUpdateInput = z.infer<typeof almacenUpdateSchema>;
