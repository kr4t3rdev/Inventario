import { z } from 'zod';
export const statsSchema = z.object({ periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(), fechaDesde: z.string().optional(), fechaHasta: z.string().optional() });
export type StatsInput = z.infer<typeof statsSchema>;
