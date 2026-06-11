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

export const addTenantMembershipSchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  tenantRole: z.enum(["manager", "economico", "dependiente"]),
});

export type AddTenantMembershipInput = z.infer<typeof addTenantMembershipSchema>;

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
  descripcion: z.string().optional(),
  precio: z.number().min(0).default(0),
  duracionDias: z.number().int().min(1),
  maxUsuarios: z.number().int().min(1),
  maxAlmacenes: z.number().int().min(1),
  maxProductos: z.number().int().min(1),
  maxClientes: z.number().int().min(0).default(200),
  maxPuntosVenta: z.number().int().min(1),
  maxFacturasMes: z.number().int().min(0).default(200),
  maxContratos: z.number().int().min(0).default(0),
  incluyeBackups: z.boolean().default(false),
  features: z.record(z.boolean()).default({}),
});

export const updatePlanSchema = z.object({
  planId: z.string().min(1),
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  precio: z.number().min(0).optional(),
  duracionDias: z.number().int().min(1).optional(),
  maxUsuarios: z.number().int().min(1).optional(),
  maxAlmacenes: z.number().int().min(1).optional(),
  maxProductos: z.number().int().min(1).optional(),
  maxClientes: z.number().int().min(0).optional(),
  maxPuntosVenta: z.number().int().min(1).optional(),
  maxFacturasMes: z.number().int().min(0).optional(),
  maxContratos: z.number().int().min(0).optional(),
  incluyeBackups: z.boolean().optional(),
  features: z.record(z.boolean()).optional(),
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
