import { describe, expect, it } from 'vitest'

import {
  calculateNextRun,
  isValidCronExpression,
} from '../cron-utils'

describe('backup cron utilities', () => {
  const now = new Date('2026-05-24T10:07:00.000Z')

  it('preserves the hourly preset and its equivalent expression', () => {
    expect(calculateNextRun('hourly', now)).toEqual(
      calculateNextRun('0 * * * *', now),
    )
  })

  it('preserves daily and weekly presets and their equivalent expressions', () => {
    expect(calculateNextRun('daily', now)).toEqual(
      calculateNextRun('0 2 * * *', now),
    )
    expect(calculateNextRun('weekly', now)).toEqual(
      calculateNextRun('0 2 * * 0', now),
    )
  })

  it('calculates the next occurrence of a valid custom cron expression', () => {
    const nextRun = calculateNextRun('*/15 * * * *', now)

    expect(nextRun.getMinutes()).toBe(15)
    expect(nextRun.getSeconds()).toBe(0)
    expect(nextRun.getTime()).toBeGreaterThan(now.getTime())
  })

  it('rejects invalid cron expressions instead of falling back silently', () => {
    expect(isValidCronExpression('not-a-cron')).toBe(false)
    expect(() => calculateNextRun('not-a-cron', now)).toThrow()
  })

  it('accepts current presets and valid custom expressions in schema-compatible validation', () => {
    expect(isValidCronExpression('hourly')).toBe(true)
    expect(isValidCronExpression('daily')).toBe(true)
    expect(isValidCronExpression('weekly')).toBe(true)
    expect(isValidCronExpression('0 4 * * *')).toBe(true)
  })

  it('accepts wildcards, lists, ranges, and steps in all cron fields', () => {
    expect(isValidCronExpression('* * * * *')).toBe(true)
    expect(isValidCronExpression('5,20 1,13 1,15 1,6 0,6')).toBe(true)
    expect(isValidCronExpression('0-30 0-23 1-31 1-12 0-7')).toBe(true)
    expect(isValidCronExpression('*/15 1-23/2 1-31/3 */2 1-7/2')).toBe(true)
    expect(isValidCronExpression('5/15 * * * *')).toBe(true)
  })

  it('rejects expressions with the wrong field count or out-of-range values', () => {
    for (const expression of [
      '* * * *',
      '* * * * * *',
      '60 * * * *',
      '* 24 * * *',
      '* * 0 * *',
      '* * * 13 *',
      '* * * * 8',
      '*/0 * * * *',
      '1-5/0 * * * *',
      '5-1 * * * *',
    ]) {
      expect(isValidCronExpression(expression)).toBe(false)
    }
  })

  it('calculates the next occurrence for lists and ranges', () => {
    expect(calculateNextRun('5,20 * * * *', now).getMinutes()).toBe(20)
    expect(calculateNextRun('10-12 * * * *', now).getMinutes()).toBe(10)
  })

  it('calculates a step from a starting value through the field range', () => {
    expect(calculateNextRun('5/15 * * * *', now).getMinutes()).toBe(20)
  })

  it('treats */1 as an unrestricted day field', () => {
    const monday = new Date('2026-05-25T10:07:00.000Z')
    const nextRun = calculateNextRun('0 2 */1 * 1', monday)

    expect(nextRun.getDay()).toBe(1)
  })
})
