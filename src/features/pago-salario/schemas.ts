/**
 * @description Schemas Zod para pago de salarios.
 */
import { z } from 'zod';

export const pagoSalarioSchema = z.object({
  empleadoId: z.string().min(1),
  salario: z.coerce.number().int().positive(),
  bonificaciones: z.coerce.number().int().optional().default(0),
  deducciones: z.coerce.number().int().optional().default(0),
  horasExtras: z.coerce.number().int().optional().default(0),
  observaciones: z.string().optional().nullable(),
});

export const pagoSalarioUpdateSchema = z.object({
  pgId: z.string().min(1),
  empleadoId: z.string().min(1).optional(),
  salario: z.coerce.number().int().positive().optional(),
  bonificaciones: z.coerce.number().int().optional(),
  deducciones: z.coerce.number().int().optional(),
  horasExtras: z.coerce.number().int().optional(),
  observaciones: z.string().optional().nullable(),
});

export type PagoSalarioInput = z.infer<typeof pagoSalarioSchema>;
export type PagoSalarioUpdateInput = z.infer<typeof pagoSalarioUpdateSchema>;
