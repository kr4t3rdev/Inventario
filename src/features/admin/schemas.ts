/**
 * @description Schemas Zod para admin.
 */
import { z } from 'zod';

// ─── Users ─────────────────────────────────────────────────

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().min(1),
  tenantRole: z.string().optional(),
  daysToExpire: z.number().int().optional(),
});

export const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.string().optional(),
  tenantRole: z.string().optional(),
  isActive: z.boolean().optional(),
  daysToExpire: z.number().int().optional(),
});

export const lockUnlockSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().optional(),
});

// ─── Tenant User Management ────────────────────────────────

export const updateTenantUserSchema = z.object({
  userId: z.string().min(1),
  tenantRole: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Memberships ───────────────────────────────────────────

export const membershipActionSchema = z.object({
  id: z.string().min(1),
  tenantRole: z.string().min(1),
});

// ─── Licencias ─────────────────────────────────────────────

export const createLicenciaSchema = z.object({
  tenantId: z.string().min(1),
  planId: z.string().min(1),
  inicio: z.string(),
  expiracion: z.string(),
  activa: z.boolean().optional().default(true),
});

export const updateLicenciaSchema = z.object({
  id: z.string().min(1),
  activa: z.boolean().optional(),
  expiracion: z.string().optional(),
});

// ─── Planes ────────────────────────────────────────────────

export const createPlanSchema = z.object({
  nombre: z.string().min(1),
  duracionDias: z.number().int().min(1),
  maxUsuarios: z.number().int().min(1),
  maxAlmacenes: z.number().int().min(1),
  maxProductos: z.number().int().min(1),
  precio: z.number().optional(),
  descripcion: z.string().optional(),
});

export const updatePlanSchema = z.object({
  planId: z.string().min(1),
  nombre: z.string().min(1).optional(),
  duracionDias: z.number().int().min(1).optional(),
  maxUsuarios: z.number().int().min(1).optional(),
  maxAlmacenes: z.number().int().min(1).optional(),
  maxProductos: z.number().int().min(1).optional(),
  precio: z.number().optional(),
  descripcion: z.string().optional(),
});

// ─── Types ─────────────────────────────────────────────────

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LockUnlockInput = z.infer<typeof lockUnlockSchema>;
export type UpdateTenantUserInput = z.infer<typeof updateTenantUserSchema>;
export type MembershipActionInput = z.infer<typeof membershipActionSchema>;
export type CreateLicenciaInput = z.infer<typeof createLicenciaSchema>;
export type UpdateLicenciaInput = z.infer<typeof updateLicenciaSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
