import { afterAll, describe, expect, it } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { logSafeOperationalEvent } from '../safe-sentry-logger';

const envelopes: unknown[] = [];

Sentry.init({
  dsn: 'https://public@example.ingest.sentry.io/1',
  transport: () => ({
    send: async (envelope) => {
      envelopes.push(envelope);
      return { statusCode: 200 };
    },
    flush: async () => true,
  }),
  beforeSendLog: (log) => {
    if (log.message !== 'tcp.operation.completed' && log.message !== 'tcp.operation.failed') {
      return null;
    }
    const runtime = log.attributes?.runtime;
    const result = log.attributes?.result;
    if (!['server', 'browser', 'edge'].includes(String(runtime))) return null;
    if (!['success', 'failure'].includes(String(result))) return null;
    return { ...log, attributes: { runtime, result } };
  },
});

describe('safe Sentry logger with local transport', () => {
  afterAll(async () => {
    await Sentry.close(1000);
  });

  it('buffers only the fixed log without scope data and refuses logs with ambient scope attributes', async () => {
    process.env.SENTRY_ENABLE_LOGS = 'true';

    logSafeOperationalEvent({
      event: 'tcp.operation.completed', runtime: 'server', result: 'success',
    });
    await Sentry.flush(1000);

    expect(envelopes).toHaveLength(1);
    const acceptedLog = JSON.stringify(envelopes[0]);
    expect(acceptedLog).toContain('tcp.operation.completed');
    expect(acceptedLog).toContain('runtime');
    expect(acceptedLog).toContain('result');

    await Sentry.withIsolationScope(async (scope) => {
      scope.setAttributes({ private_customer_data: 'scope-secret-value' });
      logSafeOperationalEvent({
        event: 'tcp.operation.failed', runtime: 'server', result: 'failure',
      });
      await Sentry.flush(1000);
    });

    expect(envelopes).toHaveLength(1);
    expect(JSON.stringify(envelopes)).not.toContain('scope-secret-value');

    Sentry.getGlobalScope().setAttributes({ private_global_data: 'global-secret-value' });
    logSafeOperationalEvent({
      event: 'tcp.operation.failed', runtime: 'server', result: 'failure',
    });
    await Sentry.flush(1000);
    expect(envelopes).toHaveLength(1);
    expect(JSON.stringify(envelopes)).not.toContain('global-secret-value');
  });
});
