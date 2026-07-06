import { describe, expect, it } from 'vitest'
import { createBackupSchema, createPlanSchema } from '../schemas'

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
})
