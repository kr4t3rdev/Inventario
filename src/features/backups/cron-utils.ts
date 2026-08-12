/**
 * @description Cron utilities for backup plans.
 * Supports five-field cron expressions plus the UI presets used by the admin panel.
 *
 * @module features/backups/cron-utils
 */

const PRESET_EXPRESSIONS = {
  hourly: '0 * * * *',
  daily: '0 2 * * *',
  weekly: '0 2 * * 0',
} as const

type CronField = {
  values: Set<number>
  isWildcard: boolean
}

type ParsedCron = {
  minute: CronField
  hour: CronField
  dayOfMonth: CronField
  month: CronField
  dayOfWeek: CronField
}

const FIELD_RANGES = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12 },
  { min: 0, max: 7 },
] as const

function normalizeExpression(expression: string): string {
  return PRESET_EXPRESSIONS[expression as keyof typeof PRESET_EXPRESSIONS] ?? expression
}

function parseField(expression: string, min: number, max: number): CronField | null {
  if (!expression) return null

  const values = new Set<number>()
  for (const part of expression.split(',')) {
    if (!part) return null

    const [rangeExpression, stepExpression] = part.split('/')
    if (part.split('/').length > 2) return null

    const step = stepExpression === undefined ? 1 : Number(stepExpression)
    if (!Number.isInteger(step) || step < 1) return null

    let rangeMin = min
    let rangeMax = max
    if (rangeExpression !== '*') {
      const range = rangeExpression.split('-')
      if (range.length > 2) return null
      rangeMin = Number(range[0])
      rangeMax = range.length === 1
        ? (stepExpression === undefined ? rangeMin : max)
        : Number(range[1])
      if (
        !Number.isInteger(rangeMin) ||
        !Number.isInteger(rangeMax) ||
        rangeMin < min ||
        rangeMax > max ||
        rangeMin > rangeMax
      ) {
        return null
      }
    }

    for (let value = rangeMin; value <= rangeMax; value += step) {
      values.add(value === 7 && max === 7 ? 0 : value)
    }
  }

  const isWildcard = expression === '*' || /^\*\/1$/.test(expression)
  return values.size > 0 ? { values, isWildcard } : null
}

function parseCronExpression(expression: string): ParsedCron | null {
  const fields = normalizeExpression(expression.trim()).split(/\s+/)
  if (fields.length !== 5) return null

  const parsed = fields.map((field, index) =>
    parseField(field, FIELD_RANGES[index].min, FIELD_RANGES[index].max),
  )
  if (parsed.some((field): field is null => field === null)) return null

  return {
    minute: parsed[0]!,
    hour: parsed[1]!,
    dayOfMonth: parsed[2]!,
    month: parsed[3]!,
    dayOfWeek: parsed[4]!,
  }
}

/**
 * @description Validates a preset or standard five-field cron expression.
 * @param expression - Cron expression or supported preset.
 * @returns True when the expression is syntactically valid.
 */
export function isValidCronExpression(expression: string): boolean {
  return typeof expression === 'string' && parseCronExpression(expression) !== null
}

function matchesDay(cron: ParsedCron, date: Date): boolean {
  const dayOfMonthMatches = cron.dayOfMonth.values.has(date.getDate())
  const dayOfWeekMatches = cron.dayOfWeek.values.has(date.getDay())

  if (cron.dayOfMonth.isWildcard && cron.dayOfWeek.isWildcard) return true
  if (cron.dayOfMonth.isWildcard) return dayOfWeekMatches
  if (cron.dayOfWeek.isWildcard) return dayOfMonthMatches
  return dayOfMonthMatches || dayOfWeekMatches
}

/**
 * @description Calculates the next matching minute for a cron expression.
 * @param cronExpr - Cron expression or preset name.
 * @param now - Optional clock value used as the lower bound.
 * @returns The next scheduled date.
 * @throws Error when the expression is invalid or has no occurrence in the search window.
 */
export function calculateNextRun(cronExpr: string, now: Date = new Date()): Date {
  const parsed = parseCronExpression(cronExpr)
  if (!parsed) throw new Error(`Invalid cron expression: ${cronExpr}`)

  const candidate = new Date(now)
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1)

  const maxMinutes = 366 * 24 * 60 * 5
  for (let index = 0; index < maxMinutes; index += 1) {
    if (
      parsed.minute.values.has(candidate.getMinutes()) &&
      parsed.hour.values.has(candidate.getHours()) &&
      parsed.month.values.has(candidate.getMonth() + 1) &&
      matchesDay(parsed, candidate)
    ) {
      return candidate
    }
    candidate.setMinutes(candidate.getMinutes() + 1)
  }

  throw new Error(`Cron expression has no upcoming occurrence: ${cronExpr}`)
}

/**
 * @description Returns the next occurrence of a specific hour today or tomorrow.
 * @param now - Current date/time reference.
 * @param hour - Hour of day (0-23).
 * @returns Next date at the given hour.
 */
export function getNextDailyRun(now: Date, hour: number): Date {
  return calculateNextRun(`0 ${hour} * * *`, now)
}

/**
 * @description Returns the next occurrence of a weekday and hour.
 * @param now - Current date/time reference.
 * @param dayOfWeek - Day of week (0=Sunday, 6=Saturday).
 * @param hour - Hour of day (0-23).
 * @returns Next matching date.
 */
export function getNextWeeklyRun(now: Date, dayOfWeek: number, hour: number): Date {
  return calculateNextRun(`0 ${hour} * * ${dayOfWeek}`, now)
}

/**
 * @description Returns the next hour boundary.
 * @param now - Current date/time reference.
 * @returns Next hour (HH:00:00).
 */
export function getNextHourlyRun(now: Date): Date {
  return calculateNextRun('0 * * * *', now)
}
