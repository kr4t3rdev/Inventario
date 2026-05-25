/**
 * @description Zod schemas for backup feature.
 */
import { z } from 'zod'

export const createBackupSchema = z.object({
  type: z.enum(['full', 'tenant', 'config']),
  tenantId: z.string().min(1).optional(),
})

export const createPlanSchema = z.object({
  type: z.enum(['full', 'tenant', 'config']),
  tenantId: z.string().min(1).optional(),
  schedule: z.string().min(1, 'Cron expression is required'),
  retention: z.number().int().min(1).max(365).default(30),
})

export const updatePlanSchema = z.object({
  planId: z.string().min(1),
  schedule: z.string().optional(),
  enabled: z.boolean().optional(),
  retention: z.number().int().min(1).max(365).optional(),
})

export const deleteBackupSchema = z.object({
  backupLogId: z.string().min(1),
})

export const restoreBackupSchema = z.object({
  backupLogId: z.string().min(1),
  confirmation: z.string().min(1),
})

export const getBackupsSchema = z.object({
  type: z.enum(['full', 'tenant', 'config']).optional(),
  tenantId: z.string().optional(),
  status: z.enum(['running', 'completed', 'failed', 'pruned', 'deleted']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
})

export type CreateBackupInput = z.infer<typeof createBackupSchema>
export type CreatePlanInput = z.infer<typeof createPlanSchema>
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>
export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>
export type GetBackupsInput = z.infer<typeof getBackupsSchema>
