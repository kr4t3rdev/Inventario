import { z } from 'zod';

import { APP_USER_ROLES, TENANT_ROLES } from '@/lib/auth/roles';

const roleSchema = z.enum(APP_USER_ROLES);

export const userIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createUserBodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(6),
  role: roleSchema.default('regularUser'),
  tenantRole: z.enum(['manager', 'economico', 'dependiente']).optional(),
  daysToExpire: z.number().int().positive().max(3650).optional(),
});

export const updateUserBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    password: z.string().min(6).optional(),
    role: roleSchema.optional(),
    tenantRole: z.enum(['manager', 'economico', 'dependiente']).optional(),
    isActive: z.boolean().optional(),
    daysToExpire: z.number().int().positive().max(3650).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Se requiere al menos un campo para actualizar',
  });

export const deleteSessionQuerySchema = z.object({
  sessionId: z.string().min(1),
});

export const activityLogBodySchema = z.object({
  userId: z.string().min(1),
  action: z.string().trim().min(1).max(100),
  details: z.string().max(5000).optional(),
  ipAddress: z.string().max(120).optional(),
  userAgent: z.string().max(1000).optional(),
});

export const lockUserBodySchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export const unlockUserBodySchema = z.object({
  userId: z.string().min(1),
});

export const expiringUsersBodySchema = z.object({
  days: z.number().int().positive().max(365).default(7),
});

export const expiringUsersQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(7),
});

export const activityLogQuerySchema = z.object({
  userId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const userMetricsQuerySchema = z.object({
  months: z.coerce.number().int().positive().max(60).default(12),
});

export const migrateCuentasPorPagarBodySchema = z.object({
  dryRun: z.boolean().optional(),
});

export const globalUsersQuerySchema = z.object({
  tenantId: z.string().min(1).optional(),
  search: z.string().max(100).optional(),
  role: z.string().optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  sortBy: z.enum(['name', 'email', 'createdAt', 'expiresAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
