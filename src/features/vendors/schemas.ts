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
  // CTF-7: contrato (Vendor.contrato) deprecado; los contratos se gestionan por
  // la relación Contrato.vendorId y el campo legacy ya no es escribible.
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
  // CTF-7: contrato (Vendor.contrato) deprecado; no escribible por clientes.
  cuentaCUP: z.string().optional().nullable(),
  cuentaUSD: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  logoAsset: cloudinaryAssetSchema.optional().nullable(),
});

export type VendorInput = z.infer<typeof vendorSchema>;
export type VendorUpdateInput = z.infer<typeof vendorUpdateSchema>;
