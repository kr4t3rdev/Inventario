/**
 * @description Cron utilities for backup plans — shared between Server Actions
 * and the cron API route.
 *
 * Simple parser for common presets; for full cron support, integrate node-cron.
 *
 * Presets:
 *   'daily' / '0 2 * * *' → next 2 AM
 *   'weekly' / '0 2 * * 0' → next Sunday 2 AM
 *   'hourly' / '0 * * * *' → next hour
 *
 * @module features/backups/cron-utils
 */

/**
 * @description Calculates the next run time from a cron expression.
 * @param cronExpr - Cron expression or preset name
 * @returns Date of the next scheduled run
 */
export function calculateNextRun(cronExpr: string): Date {
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

/**
 * @description Returns the next occurrence of a specific hour today or tomorrow.
 * @param now - Current date/time reference
 * @param hour - Hour of day (0-23)
 * @returns Next date at the given hour
 */
export function getNextDailyRun(now: Date, hour: number): Date {
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next
}

/**
 * @description Returns the next occurrence of a specific day-of-week and hour.
 * @param now - Current date/time reference
 * @param dayOfWeek - Day of week (0=Sunday, 6=Saturday)
 * @param hour - Hour of day (0-23)
 * @returns Next date matching the weekday and hour
 */
export function getNextWeeklyRun(now: Date, dayOfWeek: number, hour: number): Date {
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

/**
 * @description Returns the next hour boundary.
 * @param now - Current date/time reference
 * @returns Next hour (HH:00:00)
 */
export function getNextHourlyRun(now: Date): Date {
  const next = new Date(now)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return next
}
