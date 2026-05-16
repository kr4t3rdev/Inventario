/**
 * @description Schemas Zod para empleados (CRUD básico).
 */
import { z } from 'zod';

export const empleadoSchema = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  telefono: z.string().optional().nullable(),
  cargo: z.string().min(1),
  salarioBases: z.coerce.number().int().nonnegative(),
  fechaContratacion: z.string().optional(),
  esTiempoCompleto: z.boolean().optional().default(true),
  diasVacacionesAnuales: z.number().int().optional().default(15),
});

export const empleadoUpdateSchema = z.object({
  empleadoId: z.string().min(1),
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  telefono: z.string().optional().nullable(),
  cargo: z.string().min(1).optional(),
  salarioBases: z.coerce.number().int().nonnegative().optional(),
  esTiempoCompleto: z.boolean().optional(),
  diasVacacionesAnuales: z.number().int().optional(),
});

export type EmpleadoInput = z.infer<typeof empleadoSchema>;
export type EmpleadoUpdateInput = z.infer<typeof empleadoUpdateSchema>;
