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
import { prisma } from '@/lib/prisma'
import { createPlanSchema, updatePlanSchema } from './schemas'
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
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
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
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
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
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
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
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
    }

    const plans = await prisma.backupPlan.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return plans
  },
)

// ─── Cron Helpers ───────────────────────────────────────────

/**
 * @description Calculates the next run time from a cron expression.
 * Simple parser for common presets; for full cron support, integrate node-cron.
 *
 * Presets:
 *   'daily' / '0 2 * * *' → next 2 AM
 *   'weekly' / '0 2 * * 0' → next Sunday 2 AM
 *   'hourly' / '0 * * * *' → next hour
 */
function calculateNextRun(cronExpr: string): Date {
  const now = new Date()

  // Handle presets
  switch (cronExpr) {
    case 'daily':
    case '0 2 * * *':
      return getNextDailyRun(now, 2)
    case 'weekly':
    case '0 2 * * 0':
      return getNextWeeklyRun(now, 0, 2)
    case 'hourly':
    case '0 * * * *':
      return getNextHourlyRun(now)
  }

  // Default: schedule 1 hour from now (fallback for unrecognized patterns)
  const fallback = new Date(now.getTime() + 60 * 60 * 1000)
  return fallback
}

function getNextDailyRun(now: Date, hour: number): Date {
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next
}

function getNextWeeklyRun(now: Date, dayOfWeek: number, hour: number): Date {
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  const daysUntil = (dayOfWeek - next.getDay() + 7) % 7
  if (daysUntil === 0 && next <= now) {
    next.setDate(next.getDate() + 7)
  } else {
    next.setDate(next.getDate() + daysUntil)
  }
  return next
}

function getNextHourlyRun(now: Date): Date {
  const next = new Date(now)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return next
}
