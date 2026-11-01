import { beforeEach, describe, expect, it, vi } from 'vitest';

const { init, captureRouterTransitionStart } = vi.hoisted(() => ({
  init: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({ init, captureRouterTransitionStart }));

const DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

describe('Sentry runtime configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.SENTRY_TRACES_SAMPLE_RATE;
    delete process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;
  });

  it.each([
    ['browser entrypoint', '@/instrumentation-client', 'NEXT_PUBLIC_SENTRY_DSN'],
    ['browser config', '@/sentry.client.config', 'NEXT_PUBLIC_SENTRY_DSN'],
    ['Node config', '@/sentry.server.config', 'SENTRY_DSN'],
    ['Edge config', '@/sentry.edge.config', 'SENTRY_DSN'],
  ])('%s requires its environment DSN and minimizes collected data', async (_name, path, envKey) => {
    process.env[envKey] = DSN;

    await import(path);

    const options = init.mock.calls[0][0];
    expect(options.dsn).toBe(DSN);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
    expect(options.replaysSessionSampleRate ?? 0).toBe(0);
    expect(options.replaysOnErrorSampleRate ?? 0).toBe(0);
    expect(options.beforeSend({
      message: 'sensitive amount 9876',
      exception: { values: [{ type: 'Error', value: 'account 123' }] },
    }).exception.values[0].value).toBe('[redacted]');
    expect(options.beforeSendTransaction({
      transaction: '/accounts/alice?amount=9876',
      spans: [],
    }).transaction).toBe('/[segment]/[segment]');
  });

  it('does not send events when no DSN is configured', async () => {
    await import('@/sentry.server.config');

    expect(init.mock.calls[0][0].dsn).toBeUndefined();
  });
});
