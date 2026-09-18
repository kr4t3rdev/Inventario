/**
 * @description Schemas Zod compartidos para validación de proveedores.
 */
import { z } from 'zod';
import { cloudinaryAssetSchema } from '@/lib/upload/cloudinary-asset';

export const vendorSchema = z.object({
  nombre: z.string({ required_error: 'El nombre es requerido' }).min(1, 'El nombre es requerido'),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  contacto: z.string().optional().nullable(),
  contrato: z.string().optional().nullable(),
  cuentaCUP: z.string().optional().nullable(),
  cuentaUSD: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  logoAsset: cloudinaryAssetSchema.optional().nullable(),
});

export const vendorUpdateSchema = z.object({
  vendorId: z.string().min(1),
  nombre: z.string().min(1).optional(),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  contacto: z.string().optional().nullable(),
  contrato: z.string().optional().nullable(),
  cuentaCUP: z.string().optional().nullable(),
  cuentaUSD: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  logoAsset: cloudinaryAssetSchema.optional().nullable(),
});

export type VendorInput = z.infer<typeof vendorSchema>;
export type VendorUpdateInput = z.infer<typeof vendorUpdateSchema>;
