/**
 * @description Schemas Zod compartidos para validación de categorías.
 *
 * Estos schemas se usan tanto en el cliente (React Hook Form + zodResolver)
 * como en el servidor (Server Actions con withAction).
 *
 * Basados en CategoriaSchema de src/lib/categoria-validation.ts
 */
import { z } from 'zod';

/**
 * Schema para creación de categoría.
 * Campos requeridos: nombre
 * Campos opcionales: descripcion, parentId, clasSectionId, clasSpecificId
 */
export const categoriaCreateSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .refine((val) => val.trim().length > 0, 'El nombre no puede estar vacío'),

  descripcion: z
    .string()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .optional()
    .nullable(),

  parentId: z.string().optional().nullable(),

  clasSectionId: z.string().optional().nullable(),

  clasSpecificId: z.string().optional().nullable(),
});

/**
 * Schema para actualización de categoría.
 * Todos los campos son opcionales, pero se requiere catId.
 */
export const categoriaUpdateSchema = z.object({
  catId: z.string().min(1, 'El ID de categoría es requerido'),
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .refine((val) => val.trim().length > 0, 'El nombre no puede estar vacío')
    .optional(),

  descripcion: z
    .string()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .optional()
    .nullable(),

  parentId: z.string().optional().nullable(),

  clasSectionId: z.string().optional().nullable(),

  clasSpecificId: z.string().optional().nullable(),
});

// ─── Tipos inferidos ──────────────────────────────────────

export type CategoriaCreateInput = z.infer<typeof categoriaCreateSchema>;
export type CategoriaUpdateInput = z.infer<typeof categoriaUpdateSchema>;
