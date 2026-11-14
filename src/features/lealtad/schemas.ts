/**
 * @description Esquemas de validación Zod para el módulo de Lealtad.
 *
 * @module features/lealtad/schemas
 */
import { z } from 'zod';

// ─── Programa de Lealtad ───────────────────────────────────────────

export const programaLealtadSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  activo: z.boolean().optional(),
  puntosPorPeso: z.number().positive('Debe ser mayor a 0').default(1),
  puntosMinimos: z.number().int().positive('Debe ser mayor a 0').default(1000),
  valorCanje: z.number().int().positive('Debe ser mayor a 0').default(100),
  reglas: z.record(z.string(), z.any()).optional().nullable(),
});

export type ProgramaLealtadInput = z.infer<typeof programaLealtadSchema>;

export const programaLealtadUpdateSchema = z.object({
  programaId: z.string().min(1),
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
  puntosPorPeso: z.number().positive().optional(),
  puntosMinimos: z.number().int().positive().optional(),
  valorCanje: z.number().int().positive().optional(),
  reglas: z.record(z.string(), z.any()).optional().nullable(),
});

export type ProgramaLealtadUpdateInput = z.infer<typeof programaLealtadUpdateSchema>;

// ─── Tiers ──────────────────────────────────────────────────────────

export const tierLealtadSchema = z.object({
  programaId: z.string().min(1),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  orden: z.number().int().min(0, 'El orden debe ser 0 o mayor'),
  umbralGasto: z.number().int().min(0, 'El umbral no puede ser negativo'),
  umbralFrecuencia: z.number().int().min(0).optional().nullable(),
  beneficios: z.record(z.string(), z.any()),
  color: z.string().optional().nullable(),
  icono: z.string().optional().nullable(),
  activo: z.boolean().optional(),
});

export type TierLealtadInput = z.infer<typeof tierLealtadSchema>;

export const tierLealtadUpdateSchema = z.object({
  tierId: z.string().min(1),
  nombre: z.string().min(1).optional(),
  orden: z.number().int().min(0).optional(),
  umbralGasto: z.number().int().min(0).optional(),
  umbralFrecuencia: z.number().int().min(0).optional().nullable(),
  beneficios: z.record(z.string(), z.any()).optional(),
  color: z.string().optional().nullable(),
  icono: z.string().optional().nullable(),
  activo: z.boolean().optional(),
});

export type TierLealtadUpdateInput = z.infer<typeof tierLealtadUpdateSchema>;

// ─── Canje de Puntos ───────────────────────────────────────────────

export const canjePuntosSchema = z.object({
  clienteId: z.string().min(1),
  puntos: z.number().int().positive('Los puntos a canjear deben ser positivos'),
  referenciaId: z.string().optional().nullable(),
});

export type CanjePuntosInput = z.infer<typeof canjePuntosSchema>;

// ─── Puntos Manuales ───────────────────────────────────────────────

export const puntosManualesSchema = z.object({
  clienteId: z.string().min(1),
  puntos: z.number().int('Debe ser un número entero'),
  tipo: z.enum(['BONUS', 'CUMPLEANOS', 'MANUAL']),
  referenciaId: z.string().optional().nullable(),
});

export type PuntosManualesInput = z.infer<typeof puntosManualesSchema>;

// ─── Misiones ──────────────────────────────────────────────────────

export const misionLealtadSchema = z.object({
  programaId: z.string().min(1),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  descripcion: z.string().optional().nullable(),
  tipo: z.enum(['COMPRA_CATEGORIA', 'FRECUENCIA', 'AOV', 'PRIMERA_COMPRA']),
  reglas: z.record(z.string(), z.any()),
  recompensaPuntos: z.number().int().positive('La recompensa debe ser positiva'),
  validoDesde: z.coerce.date(),
  validoHasta: z.coerce.date().optional().nullable(),
  activo: z.boolean().optional(),
  vecesMaximo: z.number().int().positive().optional().nullable(),
});

export type MisionLealtadInput = z.infer<typeof misionLealtadSchema>;

// ─── Referidos ─────────────────────────────────────────────────────

export const referidoSchema = z.object({
  refirienteId: z.string().min(1),
  incentivoRefiriente: z.number().int().min(0).default(0),
  incentivoReferido: z.number().int().min(0).default(0),
});

export type ReferidoInput = z.infer<typeof referidoSchema>;
