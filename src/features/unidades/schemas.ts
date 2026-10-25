/**
 * @description Schemas Zod compartidos para validación de unidades de medida.
 */
import { z } from 'zod';

export const UNIDAD_DIMENSIONS = ['COUNT', 'MASS', 'VOLUME', 'LENGTH', 'AREA', 'UNKNOWN'] as const;

export const unidadDimensionSchema = z.enum(UNIDAD_DIMENSIONS);
export type UnidadDimension = z.infer<typeof unidadDimensionSchema>;

export const unidadSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre es requerido' })
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  simbolo: z
    .string({ required_error: 'El símbolo es requerido' })
    .min(1, 'El símbolo es requerido')
    .max(20, 'El símbolo no puede exceder 20 caracteres'),
  dimension: unidadDimensionSchema.default('UNKNOWN'),
});

export const unidadUpdateSchema = z.object({
  unidadId: z.string().min(1, 'El ID de la unidad es requerido'),
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .optional(),
  simbolo: z
    .string()
    .min(1, 'El símbolo es requerido')
    .max(20, 'El símbolo no puede exceder 20 caracteres')
    .optional(),
});

export type UnidadInput = z.infer<typeof unidadSchema>;
export type UnidadFormInput = z.input<typeof unidadSchema>;
export type UnidadUpdateInput = z.infer<typeof unidadUpdateSchema>;
