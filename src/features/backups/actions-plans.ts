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
import { prismaPlatform } from '@/lib/db/platform-prisma'
import { backupPlanWhere, resolveBackupActorScope } from './actor-scope'
import { createPlanSchema, updatePlanSchema } from './schemas'
import { calculateNextRun } from './cron-utils'
import type { CreatePlanInput, UpdatePlanInput } from './schemas'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

// ─── Create Plan ────────────────────────────────────────────

/**
 * @description Creates a new backup plan with cron schedule and retention.
 *
 * Auth: platform admin globally; tenant feature users for their own tenant.
 */
export const createPlanAction = withAction(
  async (input: CreatePlanInput, user: AuthenticatedUser) => {
    const scope = resolveBackupActorScope(user)
    const parsed = createPlanSchema.parse(input)
    if (scope.kind === 'tenant' && (parsed.type !== 'tenant' || parsed.tenantId !== scope.tenantId)) {
      throw new ActionError('No tienes autorización para crear este plan', 'FORBIDDEN')
    }
    const tenantId = scope.kind === 'tenant' ? scope.tenantId : parsed.tenantId

    // Validate tenant exists if scoped
    if (tenantId) {
      const tenant = await prismaPlatform.tenant.findUnique({
        where: { tenantId },
        select: { tenantId: true },
      })
      if (!tenant) {
        throw new ActionError('Tenant no encontrado', 'NOT_FOUND')
      }
    }

    // Calculate next run
    const nextRunAt = calculateNextRun(parsed.schedule)

    const plan = await prismaPlatform.backupPlan.create({
      data: {
        type: parsed.type,
        tenantId: tenantId ?? null,
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
 * Auth: platform admin globally; tenant feature users for their own tenant.
 */
export const updatePlanAction = withAction(
  async (input: UpdatePlanInput, user: AuthenticatedUser) => {
    const scope = resolveBackupActorScope(user)
    const parsed = updatePlanSchema.parse(input)

    const where = backupPlanWhere(scope, { backupPlanId: parsed.planId })
    const existing = await prismaPlatform.backupPlan.findFirst({
      where,
    })

    if (!existing) {
      throw new ActionError('Plan no encontrado', 'NOT_FOUND')
    }

    const data: {
      schedule?: string
      enabled?: boolean
      retention?: number
      nextRunAt?: Date
    } = {}
    if (parsed.schedule !== undefined) {
      data.schedule = parsed.schedule
      data.nextRunAt = calculateNextRun(parsed.schedule)
    }
    if (parsed.enabled !== undefined) {
      data.enabled = parsed.enabled
      if (parsed.enabled && !existing.enabled && parsed.schedule === undefined) {
        data.nextRunAt = calculateNextRun(existing.schedule)
      }
    }
    if (parsed.retention !== undefined) data.retention = parsed.retention

    let plan
    if (scope.kind === 'platform') {
      plan = await prismaPlatform.backupPlan.update({
        where: { backupPlanId: parsed.planId },
        data,
      })
    } else {
      const updated = await prismaPlatform.backupPlan.updateMany({ where, data })
      if (updated.count !== 1) {
        throw new ActionError('Plan no encontrado', 'NOT_FOUND')
      }
      plan = await prismaPlatform.backupPlan.findFirst({ where })
      if (!plan) throw new ActionError('Plan no encontrado', 'NOT_FOUND')
    }

    revalidatePath('/admin/backups')
    return plan
  },
)

// ─── Delete Plan ────────────────────────────────────────────

/**
 * @description Deletes a backup plan.
 *
 * Auth: platform admin globally; tenant feature users for their own tenant.
 */
export const deletePlanAction = withAction(
  async (input: { planId: string }, user: AuthenticatedUser) => {
    const scope = resolveBackupActorScope(user)
    const where = backupPlanWhere(scope, { backupPlanId: input.planId })

    if (scope.kind === 'platform') {
      const plan = await prismaPlatform.backupPlan.findUnique({ where: { backupPlanId: input.planId } })
      if (!plan) throw new ActionError('Plan no encontrado', 'NOT_FOUND')
      await prismaPlatform.backupPlan.delete({ where: { backupPlanId: input.planId } })
    } else {
      const deleted = await prismaPlatform.backupPlan.deleteMany({ where })
      if (deleted.count !== 1) throw new ActionError('Plan no encontrado', 'NOT_FOUND')
    }

    revalidatePath('/admin/backups')
    return { success: true }
  },
)

// ─── List Plans ─────────────────────────────────────────────

/**
 * @description Lists all backup plans.
 *
 * Auth: platform admin globally; tenant feature users for their own tenant.
 */
export const getPlansAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    const scope = resolveBackupActorScope(user)

    const plans = await prismaPlatform.backupPlan.findMany({
      where: backupPlanWhere(scope),
      orderBy: { createdAt: 'desc' },
    })

    return plans
  },
)

  // ═══ Cron Helpers — moved to cron-utils.ts ═══
