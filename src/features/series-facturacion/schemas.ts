import { z } from 'zod';
export const serieSchema = z.object({
  prefijo: z.string().min(1).max(10),
  descripcion: z.string().min(1),
  activa: z.boolean().optional().default(true),
  esPorDefecto: z.boolean().optional().default(false),
});
export const serieUpdateSchema = z.object({
  serieId: z.string().min(1),
  prefijo: z.string().min(1).max(10).optional(),
  descripcion: z.string().min(1).optional(),
  activa: z.boolean().optional(),
  esPorDefecto: z.boolean().optional(),
});
export type SerieInput = z.infer<typeof serieSchema>;
export type SerieUpdateInput = z.infer<typeof serieUpdateSchema>;
