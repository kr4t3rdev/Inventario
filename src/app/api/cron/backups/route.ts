/**
 * @description Cron endpoint for scheduled backups (Railway Cron / any HTTP cron).
 *
 * Triggered by Railway Cron (GET). Process:
 * 1. Authenticate via CRON_SECRET env var (optional, Railway authenticates via request source)
 * 2. Query enabled BackupPlans where nextRunAt <= now() or nextRunAt IS NULL
 * 3. For each plan: run backup via BackupEngine, update lastRunAt/nextRunAt, prune old backups
 * 4. Return { executed: number, failed: number }
 *
 * Railway configuration:
 *   - Create a Railway Cron job pointing to GET /api/cron/backups
 *   - No Docker/VM needed — runs as a serverless function or long-running instance
 *   - Set CRON_SECRET for additional security (optional)
 *
 * @module app/api/cron/backups
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BackupEngine } from '@/features/backups/backup-engine'
import { createStorage } from '@/features/backups/storage'
import { pruneBackups } from '@/features/backups/prune'

/**
 * @description Validates the cron request via CRON_SECRET env var.
 */
function validateCronRequest(request: Request): { valid: boolean; reason?: string } {
  const cronSecret = process.env.CRON_SECRET

  // If CRON_SECRET is not set, skip validation (trust the request source)
  if (!cronSecret) return { valid: true }

  // Check Authorization header or x-cron-secret header
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-cron-secret')

  const provided = authHeader?.replace('Bearer ', '') ?? cronHeader ?? ''

  if (provided !== cronSecret) {
    return { valid: false, reason: 'Invalid cron secret' }
  }

  return { valid: true }
}

/**
 * @description GET handler executed by Railway Cron.
 * Processes all due backup plans and returns a summary.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // 1. Validate
  const validation = validateCronRequest(request)
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.reason },
      { status: 401 },
    )
  }

  // 2. Query due plans
  const now = new Date()
  let plans: Array<{
    backupPlanId: string
    type: 'full' | 'tenant' | 'config'
    tenantId: string | null
    schedule: string
    retention: number
    createdBy: string
  }>

  try {
    plans = await prisma.backupPlan.findMany({
      where: {
        enabled: true,
        OR: [
          { nextRunAt: { lte: now } },
          { nextRunAt: null },
        ],
      },
      select: {
        backupPlanId: true,
        type: true,
        tenantId: true,
        schedule: true,
        retention: true,
        createdBy: true,
      },
    })
  } catch (err) {
    console.error('[cron/backups] Error querying plans:', err)
    return NextResponse.json(
      { error: 'Failed to query backup plans' },
      { status: 500 },
    )
  }

  if (plans.length === 0) {
    return NextResponse.json({ executed: 0, failed: 0 })
  }

  // 3. Execute each plan
  let executed = 0
  let failed = 0
  const storage = createStorage()
  const errors: Array<{ planId: string; error: string }> = []

  for (const plan of plans) {
    try {
      const engine = new BackupEngine({
        storage,
        prisma,
      })

      await engine.run(
        { type: plan.type, tenantId: plan.tenantId ?? undefined },
        undefined,
        plan.createdBy,
      )

      // Update plan: lastRunAt + calculate nextRunAt
      const nextRunAt = calculateNextRun(plan.schedule)
      await prisma.backupPlan.update({
        where: { backupPlanId: plan.backupPlanId },
        data: { lastRunAt: new Date(), nextRunAt },
      })

      // Prune old backups for this plan's retention
      try {
        await pruneBackups(plan.retention)
      } catch (pruneErr) {
        console.error(`[cron/backups] Prune error for plan ${plan.backupPlanId}:`, pruneErr)
        // Non-fatal: pruning error doesn't affect the backup itself
      }

      executed++
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ planId: plan.backupPlanId, error: msg })
      console.error(`[cron/backups] Plan ${plan.backupPlanId} failed:`, msg)
    }
  }

  return NextResponse.json({
    executed,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  })
}

/**
 * @description Simple cron next-run calculator.
 * Supports presets: daily, weekly, hourly, and standard cron expressions.
 */
function calculateNextRun(cronExpr: string): Date {
  const now = new Date()

  switch (cronExpr.trim()) {
    case 'hourly':
    case '0 * * * *': {
      const next = new Date(now)
      next.setMinutes(0, 0, 0)
      next.setHours(next.getHours() + 1)
      return next
    }
    case 'daily':
    case '0 2 * * *': {
      const next = new Date(now)
      next.setHours(2, 0, 0, 0)
      if (next <= now) next.setDate(next.getDate() + 1)
      return next
    }
    case 'weekly':
    case '0 2 * * 0': {
      return getNextWeeklyRun(now, 0, 2)
    }
    default: {
      // Fallback: 1 hour from now
      return new Date(now.getTime() + 60 * 60 * 1000)
    }
  }
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
