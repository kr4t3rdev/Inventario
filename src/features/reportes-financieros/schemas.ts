import { z } from 'zod';
export const reporteSchema = z.object({ periodo: z.string(), tipo: z.string() });
export type ReporteInput = z.infer<typeof reporteSchema>;
