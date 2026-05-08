import { z } from 'zod';
export const createLicenciaSchema = z.object({
  usuarioId: z.string().min(1),
  planId: z.string().min(1),
  duracionDias: z.coerce.number().int().positive().optional(),
  clave: z.string().optional(),
});
export const updateLicenciaSchema = z.object({
  licenciaId: z.string().min(1),
  expiracion: z.string().optional(),
  activa: z.boolean().optional(),
});
export type CreateLicenciaInput = z.infer<typeof createLicenciaSchema>;
export type UpdateLicenciaInput = z.infer<typeof updateLicenciaSchema>;
