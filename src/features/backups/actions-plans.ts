/**
 * @description Server Actions for backup plan CRUD.
 *
 * Plans define scheduled backups with cron expressions, retention policies,
 * and optional tenant scoping.
 *
 * @module features/backups/actions-plans
 */
'use server'

import { revalidatePath } from 'next/cache'
import { withAction, ActionError } from '@/lib/server-actions'
import { requireFeature } from '@/lib/services/tenant-scope'
import { prisma } from '@/lib/prisma'
import { createPlanSchema, updatePlanSchema } from './schemas'
import { calculateNextRun } from './cron-utils'
import type { CreatePlanInput, UpdatePlanInput } from './schemas'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

// ─── Create Plan ────────────────────────────────────────────

/**
 * @description Creates a new backup plan with cron schedule and retention.
 *
 * Auth: admin only
 */
export const createPlanAction = withAction(
  async (input: CreatePlanInput, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      requireFeature(user, 'backups-tiempo-real', 'gestión de backups');
    }

    const parsed = createPlanSchema.parse(input)

    // Validate tenant exists if scoped
    if (parsed.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { tenantId: parsed.tenantId },
        select: { tenantId: true },
      })
      if (!tenant) {
        throw new ActionError('Tenant no encontrado', 'NOT_FOUND')
      }
    }

    // Calculate next run
    const nextRunAt = calculateNextRun(parsed.schedule)

    const plan = await prisma.backupPlan.create({
      data: {
        type: parsed.type,
        tenantId: parsed.tenantId ?? null,
        schedule: parsed.schedule,
        enabled: true,
        retention: parsed.retention,
        nextRunAt,
        createdBy: user.userId,
      },
    })

    revalidatePath('/admin/backups')
    return plan
  },
)

// ─── Update Plan ────────────────────────────────────────────

/**
 * @description Updates a backup plan's schedule, enabled state, or retention.
 *
 * Auth: admin only
 */
export const updatePlanAction = withAction(
  async (input: UpdatePlanInput, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      requireFeature(user, 'backups-tiempo-real', 'gestión de backups');
    }

    const parsed = updatePlanSchema.parse(input)

    const existing = await prisma.backupPlan.findUnique({
      where: { backupPlanId: parsed.planId },
    })

    if (!existing) {
      throw new ActionError('Plan no encontrado', 'NOT_FOUND')
    }

    const data: Record<string, unknown> = {}
    if (parsed.schedule !== undefined) {
      data.schedule = parsed.schedule
      data.nextRunAt = calculateNextRun(parsed.schedule)
    }
    if (parsed.enabled !== undefined) data.enabled = parsed.enabled
    if (parsed.retention !== undefined) data.retention = parsed.retention

    const plan = await prisma.backupPlan.update({
      where: { backupPlanId: parsed.planId },
      data,
    })

    revalidatePath('/admin/backups')
    return plan
  },
)

// ─── Delete Plan ────────────────────────────────────────────

/**
 * @description Deletes a backup plan.
 *
 * Auth: admin only
 */
export const deletePlanAction = withAction(
  async (input: { planId: string }, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      requireFeature(user, 'backups-tiempo-real', 'gestión de backups');
    }

    const plan = await prisma.backupPlan.findUnique({
      where: { backupPlanId: input.planId },
    })

    if (!plan) {
      throw new ActionError('Plan no encontrado', 'NOT_FOUND')
    }

    await prisma.backupPlan.delete({
      where: { backupPlanId: input.planId },
    })

    revalidatePath('/admin/backups')
    return { success: true }
  },
)

// ─── List Plans ─────────────────────────────────────────────

/**
 * @description Lists all backup plans.
 *
 * Auth: admin only
 */
export const getPlansAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      requireFeature(user, 'backups-tiempo-real', 'gestión de backups');
    }

    const plans = await prisma.backupPlan.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return plans
  },
)

  // ═══ Cron Helpers — moved to cron-utils.ts ═══

