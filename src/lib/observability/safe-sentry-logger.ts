import * as Sentry from '@sentry/nextjs';

export type SafeOperationalLog = {
  event: 'tcp.operation.completed' | 'tcp.operation.failed';
  runtime: 'server' | 'browser' | 'edge';
  result: 'success' | 'failure';
};

const ALLOWED_EVENTS = new Set<SafeOperationalLog['event']>([
  'tcp.operation.completed',
  'tcp.operation.failed',
]);
const ALLOWED_RUNTIMES = new Set<SafeOperationalLog['runtime']>([
  'server',
  'browser',
  'edge',
]);
const ALLOWED_RESULTS = new Set<SafeOperationalLog['result']>([
  'success',
  'failure',
]);

/**
 * @description Emits only a fixed event and allowlisted, non-user attributes to Sentry.
 * @param {SafeOperationalLog} entry - Fixed event metadata with no free-form values
 * @returns {void} No return value
 */
export function logSafeOperationalEvent(entry: SafeOperationalLog): void {
  const logsEnabled = entry.runtime === 'browser'
    ? process.env.NEXT_PUBLIC_SENTRY_ENABLE_LOGS === 'true'
    : process.env.SENTRY_ENABLE_LOGS === 'true';
  if (!logsEnabled) return;

  // Sentry core 11.10 merges global, isolation, and current scope attributes after
  // `beforeSendLog`; do not emit when any scope contains uninspectable attributes.
  const globalScopeAttributes = Sentry.getGlobalScope().getScopeData().attributes;
  const activeScopeAttributes = Sentry.getCurrentScope().getScopeData().attributes;
  const isolationScopeAttributes = Sentry.getIsolationScope().getScopeData().attributes;
  if (
    Object.keys(globalScopeAttributes ?? {}).length > 0 ||
    Object.keys(activeScopeAttributes ?? {}).length > 0 ||
    Object.keys(isolationScopeAttributes ?? {}).length > 0
  ) {
    return;
  }

  if (
    !ALLOWED_EVENTS.has(entry.event) ||
    !ALLOWED_RUNTIMES.has(entry.runtime) ||
    !ALLOWED_RESULTS.has(entry.result)
  ) {
    return;
  }

  Sentry.logger.info(entry.event, {
    runtime: entry.runtime,
    result: entry.result,
  });
}
