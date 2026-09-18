import { describe, expect, it } from 'vitest'
import {
  createBackupSchema,
  createPlanSchema,
  updatePlanSchema,
} from '../schemas'

describe('backup schemas', () => {
  it('rejects tenant backups without tenantId', () => {
    const result = createBackupSchema.safeParse({ type: 'tenant' })

    expect(result.success).toBe(false)
  })

  it('accepts tenant backups with tenantId', () => {
    const result = createBackupSchema.safeParse({
      type: 'tenant',
      tenantId: 'tenant-1',
    })

    expect(result.success).toBe(true)
  })

  it('rejects tenant plans without tenantId', () => {
    const result = createPlanSchema.safeParse({
      type: 'tenant',
      schedule: 'daily',
      retention: 7,
    })

    expect(result.success).toBe(false)
  })

  it('accepts tenant plans with tenantId', () => {
    const result = createPlanSchema.safeParse({
      type: 'tenant',
      tenantId: 'tenant-1',
      schedule: 'daily',
      retention: 7,
    })

    expect(result.success).toBe(true)
  })

  it('rejects plans with an invalid cron expression', () => {
    const result = createPlanSchema.safeParse({
      type: 'full',
      schedule: 'not-a-cron',
    })

    expect(result.success).toBe(false)
  })

  it('accepts valid custom cron expressions', () => {
    const result = createPlanSchema.safeParse({
      type: 'full',
      schedule: '*/15 * * * *',
    })

    expect(result.success).toBe(true)
  })

  it('rejects an invalid schedule when updating a plan', () => {
    const result = updatePlanSchema.safeParse({
      planId: 'plan-1',
      schedule: 'not-a-cron',
    })

    expect(result.success).toBe(false)
  })
})
