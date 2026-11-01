import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerInfo, scopeAttributes } = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  scopeAttributes: {
    global: {} as Record<string, unknown>,
    current: {} as Record<string, unknown>,
    isolation: {} as Record<string, unknown>,
  },
}));
vi.mock('@sentry/nextjs', () => ({
  logger: { info: loggerInfo },
  getGlobalScope: () => ({ getScopeData: () => ({ attributes: scopeAttributes.global }) }),
  getCurrentScope: () => ({ getScopeData: () => ({ attributes: scopeAttributes.current }) }),
  getIsolationScope: () => ({ getScopeData: () => ({ attributes: scopeAttributes.isolation }) }),
}));

describe('safe Sentry operational logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeAttributes.current = {};
    scopeAttributes.isolation = {};
    scopeAttributes.global = {};
    delete process.env.SENTRY_ENABLE_LOGS;
    delete process.env.NEXT_PUBLIC_SENTRY_ENABLE_LOGS;
  });

  it('sends no logs until explicitly enabled', async () => {
    const { logSafeOperationalEvent } = await import('../safe-sentry-logger');
    logSafeOperationalEvent({
      event: 'tcp.operation.completed', runtime: 'server', result: 'success',
    });
    expect(loggerInfo).not.toHaveBeenCalled();
  });

  it('sends only the fixed event and allowlisted safe attributes when enabled', async () => {
    process.env.SENTRY_ENABLE_LOGS = 'true';
    process.env.NEXT_PUBLIC_SENTRY_ENABLE_LOGS = 'true';
    const { logSafeOperationalEvent } = await import('../safe-sentry-logger');
    logSafeOperationalEvent({
      event: 'tcp.operation.completed',
      runtime: 'server',
      result: 'success',
    });

    expect(loggerInfo).toHaveBeenCalledWith('tcp.operation.completed', {
      runtime: 'server',
      result: 'success',
    });
  });

  it('rejects unexpected values even if passed from untyped JavaScript', async () => {
    process.env.SENTRY_ENABLE_LOGS = 'true';
    process.env.NEXT_PUBLIC_SENTRY_ENABLE_LOGS = 'true';
    const { logSafeOperationalEvent } = await import('../safe-sentry-logger');
    logSafeOperationalEvent({
      event: 'user@example.com' as never,
      runtime: 'server',
      result: 'success',
    });
    expect(loggerInfo).not.toHaveBeenCalled();
  });

  it('does not emit when ambient scope attributes could be appended after filtering', async () => {
    process.env.SENTRY_ENABLE_LOGS = 'true';
    const { logSafeOperationalEvent } = await import('../safe-sentry-logger');
    scopeAttributes.isolation = { secret: 'tenant data' };
    logSafeOperationalEvent({
      event: 'tcp.operation.failed', runtime: 'server', result: 'failure',
    });
    expect(loggerInfo).not.toHaveBeenCalled();
  });
});
