import { z } from 'zod';
export const servicioSchema = z.object({ nombre: z.string().min(1), descripcion: z.string().min(1), precio: z.coerce.number().int().positive() });
export const servicioUpdateSchema = z.object({ servicioId: z.string().min(1), nombre: z.string().min(1).optional(), descripcion: z.string().max(500).optional(), precio: z.coerce.number().int().nonnegative().optional() });
export type ServicioInput = z.infer<typeof servicioSchema>;
export type ServicioUpdateInput = z.infer<typeof servicioUpdateSchema>;
