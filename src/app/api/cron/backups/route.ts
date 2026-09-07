/**
 * @description Cron endpoint for scheduled backups (Railway Cron / any HTTP cron).
 *
 * Triggered by Railway Cron (GET). Process:
 * 1. Authenticate via the required CRON_SECRET env var
 * 2. Query enabled BackupPlans where nextRunAt <= now() or nextRunAt IS NULL
 * 3. For each plan: run backup via BackupEngine, update lastRunAt/nextRunAt, prune old backups
 * 4. Return { executed: number, failed: number }
 *
 * Railway configuration:
 *   - Create a Railway Cron job pointing to GET /api/cron/backups
 *   - No Docker/VM needed — runs as a serverless function or long-running instance
 *   - Set CRON_SECRET as a required secret for the cron request
 *
 * @module app/api/cron/backups
 */
import { NextResponse } from 'next/server'
import { prismaPlatform as prisma } from '@/lib/db/platform-prisma'
import { BackupEngine } from '@/features/backups/backup-engine'
import { createStorage } from '@/features/backups/storage'
import { pruneBackups } from '@/features/backups/prune'
import { calculateNextRun } from '@/features/backups/cron-utils'
import type { BackupType } from '@/generated/prisma'

/**
 * @description Validates the cron request via CRON_SECRET env var.
 */
function validateCronRequest(request: Request): { valid: boolean; reason?: string } {
  const cronSecret = process.env.CRON_SECRET

  // Fail closed: this endpoint mutates backup state and must never be public.
  if (!cronSecret) return { valid: false, reason: 'Cron secret is not configured' }

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
      { status: validation.reason === 'Cron secret is not configured' ? 500 : 401 },
    )
  }

  // 2. Query due plans
  const now = new Date()
  let plans: Array<{
    backupPlanId: string
    type: BackupType
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
      // Create BackupLog entry first, then pass it to the engine
      const cronLog = await prisma.backupLog.create({
        data: {
          type: plan.type,
          tenantId: plan.tenantId ?? undefined,
          status: 'running',
          createdBy: plan.createdBy,
        },
        select: { backupLogId: true },
      })

      const engine = new BackupEngine({
        storage,
        prisma,
      })

      await engine.run(
        { type: plan.type, tenantId: plan.tenantId ?? undefined },
        cronLog.backupLogId,
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
