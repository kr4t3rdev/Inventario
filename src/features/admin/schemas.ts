/**
 * @description Schemas Zod para admin.
 */
import { z } from 'zod';
import { ACCOUNTING_OVERRIDE_FEATURE_KEYS } from './license-feature-overrides';

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

export const cloudinaryAssetsQuerySchema = z.object({
  status: z.enum(['all', 'active', 'replaced', 'deleted']).optional().default('replaced'),
  ownerType: z.string().optional(),
  ownerId: z.string().optional(),
  slot: z.string().optional(),
  tenantId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const cloudinaryCleanupSchema = z.object({
  mode: z.enum(['selected', 'stale']).default('stale'),
  assetIds: z.array(z.string().min(1)).optional().default([]),
  olderThanDays: z.number().int().min(0).max(365).optional().default(7),
  ownerType: z.string().optional(),
  ownerId: z.string().optional(),
  slot: z.string().optional(),
  tenantId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  dryRun: z.boolean().optional().default(false),
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
  featureOverrides: z.record(z.boolean()).optional().default({}),
});

export const updateLicenciaSchema = z.object({
  id: z.string().min(1),
  activa: z.boolean().optional(),
  expiracion: z.string().optional(),
  featureOverrides: z.record(z.boolean()).optional(),
});

export const updateLicenseAccountingOverridesSchema = z.object({
  id: z.string().min(1),
  featureOverrides: z
    .object(
      Object.fromEntries(
        ACCOUNTING_OVERRIDE_FEATURE_KEYS.map((key) => [key, z.boolean().optional()]),
      ) as Record<string, z.ZodBoolean | z.ZodOptional<z.ZodBoolean>>,
    )
    .refine((value) => Object.keys(value).length > 0, {
      message: 'Debés enviar al menos un override contable',
    }),
});

export const createDemoTenantSchema = z.object({
  planId: z.string().min(1),
  demoName: z.string().trim().optional(),
  durationDays: z.number().int().min(1).max(30).optional().default(6),
});

export const cleanupExpiredDemoLicenciasSchema = z.object({
  dryRun: z.boolean().optional().default(false),
});

export const convertDemoToPaidPlanSchema = z.object({
  tenantLicenseId: z.string().min(1),
  planId: z.string().min(1),
  durationDays: z.number().int().min(1).max(3650).optional(),
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
export type CloudinaryAssetsQueryInput = z.infer<typeof cloudinaryAssetsQuerySchema>;
export type CloudinaryCleanupInput = z.infer<typeof cloudinaryCleanupSchema>;
export type UpdateTenantUserInput = z.infer<typeof updateTenantUserSchema>;
export type MembershipActionInput = z.infer<typeof membershipActionSchema>;
export type CreateLicenciaInput = z.infer<typeof createLicenciaSchema>;
export type UpdateLicenciaInput = z.infer<typeof updateLicenciaSchema>;
export type UpdateLicenseAccountingOverridesInput = z.infer<
  typeof updateLicenseAccountingOverridesSchema
>;
export type CreateDemoTenantInput = z.infer<typeof createDemoTenantSchema>;
export type CleanupExpiredDemoLicenciasInput = z.infer<
  typeof cleanupExpiredDemoLicenciasSchema
>;
export type ConvertDemoToPaidPlanInput = z.infer<
  typeof convertDemoToPaidPlanSchema
>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

// ─── Licencias Query ────────────────────────────────────

export const getLicenciasQuerySchema = z.object({
	page: z.coerce.number().min(1).default(1),
	limit: z.coerce.number().min(1).max(100).default(25),
	sortBy: z.enum(['createdAt', 'expiracion', 'activa', 'tenantId', 'planId']).default('createdAt'),
	sortOrder: z.enum(['asc', 'desc']).default('desc'),
	search: z.string().default(''),
	planFilter: z.string().default('all'),
	statusFilter: z.string().default('all'),
	typeFilter: z.string().default('all'),
});

export type GetLicenciasQueryInput = z.infer<typeof getLicenciasQuerySchema>;

export const licenciasStatsQuerySchema = z.object({
	search: z.string().default(''),
	planFilter: z.string().default('all'),
	statusFilter: z.string().default('all'),
	typeFilter: z.string().default('all'),
});

export type LicenciasStatsQueryInput = z.infer<typeof licenciasStatsQuerySchema>;
