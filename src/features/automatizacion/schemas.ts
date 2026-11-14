/**
 * @description Schemas Zod para automatización (triggers y webhooks).
 *
 * @module features/automatizacion/schemas
 */
import { z } from 'zod';

export const triggerAutomatizacionSchema = z.object({
  nombre: z.string().min(1),
  evento: z.enum(['COMPRA_COMPLETADA', 'CUMPLEANOS', 'TIER_ALCANZADO', 'CHURN_RISK', 'CARRITO_ABANDONADO', 'MISION_COMPLETADA']),
  condiciones: z.record(z.unknown()).default({}),
  accion: z.enum(['EMAIL', 'SMS', 'PUSH', 'CUPON', 'PUNTOS_BONUS']),
  payload: z.record(z.unknown()).default({}),
  canal: z.string().min(1),
  delayMinutos: z.number().min(0).default(0),
  activo: z.boolean().default(true),
  vecesMaximo: z.number().int().positive().nullable().optional(),
});

export const triggerAutomatizacionUpdateSchema = triggerAutomatizacionSchema.extend({
  triggerId: z.string(),
}).partial().extend({ triggerId: z.string() });

export const webhookLealtadSchema = z.object({
  url: z.string().url(),
  eventos: z.array(z.string()).min(1),
  secreto: z.string().min(8),
  activo: z.boolean().default(true),
});

export const webhookLealtadUpdateSchema = webhookLealtadSchema.extend({
  webhookId: z.string(),
}).partial().extend({ webhookId: z.string() });

export type TriggerAutomatizacionInput = z.infer<typeof triggerAutomatizacionSchema>;
export type TriggerAutomatizacionUpdateInput = z.infer<typeof triggerAutomatizacionUpdateSchema>;
export type WebhookLealtadInput = z.infer<typeof webhookLealtadSchema>;
export type WebhookLealtadUpdateInput = z.infer<typeof webhookLealtadUpdateSchema>;
