/**
 * @description Schemas Zod compartidos para validación de clientes.
 */
import { z } from 'zod';
import { cloudinaryAssetSchema } from '@/lib/upload/cloudinary-asset';

export const clienteSchema = z.object({
  nombre: z.string({ required_error: 'El nombre es requerido' }).min(1, 'El nombre es requerido'),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  logoAsset: cloudinaryAssetSchema.optional().nullable(),
  numeroCuentaCUP: z.string().optional().nullable(),
  numeroCuentaUSD: z.string().optional().nullable(),
  numeroContrato: z.string().optional().nullable(),
  listaPrecioId: z.string().min(1).optional().nullable(),
});

export const clienteUpdateSchema = z.object({
  clienteId: z.string().min(1),
  nombre: z.string().min(1).optional(),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  logoAsset: cloudinaryAssetSchema.optional().nullable(),
  numeroCuentaCUP: z.string().optional().nullable(),
  numeroCuentaUSD: z.string().optional().nullable(),
  numeroContrato: z.string().optional().nullable(),
  listaPrecioId: z.string().min(1).optional().nullable(),
});

/**
 * Schema del escritor del límite de crédito (C-1): entero ≥ 0 o null = sin tope.
 * Es una action dedicada (no parte del CRUD general) porque es una política
 * financiera sensible con permiso y auditoría propios.
 */
export const limiteCreditoSchema = z.object({
  clienteId: z.string().min(1),
  limiteCredito: z
    .number({ invalid_type_error: 'El límite de crédito debe ser un número' })
    .int('El límite de crédito debe ser un número entero')
    .min(0, 'El límite de crédito no puede ser negativo')
    .nullable(),
});

export type ClienteInput = z.infer<typeof clienteSchema>;
export type ClienteUpdateInput = z.infer<typeof clienteUpdateSchema>;
export type LimiteCreditoInput = z.infer<typeof limiteCreditoSchema>;
