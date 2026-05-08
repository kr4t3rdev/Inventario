/**
 * @description Schemas Zod compartidos para validación de clientes.
 */
import { z } from 'zod';

export const clienteSchema = z.object({
  nombre: z.string({ required_error: 'El nombre es requerido' }).min(1, 'El nombre es requerido'),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  numeroCuentaCUP: z.string().optional().nullable(),
  numeroCuentaUSD: z.string().optional().nullable(),
  numeroContrato: z.string().optional().nullable(),
});

export const clienteUpdateSchema = z.object({
  clienteId: z.string().min(1),
  nombre: z.string().min(1).optional(),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  numeroCuentaCUP: z.string().optional().nullable(),
  numeroCuentaUSD: z.string().optional().nullable(),
  numeroContrato: z.string().optional().nullable(),
});

export type ClienteInput = z.infer<typeof clienteSchema>;
export type ClienteUpdateInput = z.infer<typeof clienteUpdateSchema>;
