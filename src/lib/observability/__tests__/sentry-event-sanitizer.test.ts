import { describe, expect, it, vi } from 'vitest';
import {
  sanitizeSentryEvent,
  sanitizeSentryTransaction,
  recordSafeOtelException,
} from '../sentry-event-sanitizer';

describe('Sentry event privacy', () => {
  it('keeps safe stack frames while removing free-form or request-derived data', () => {
    const event = {
      event_id: 'event-1',
      message: 'Account 123 has a balance of 456.78',
      transaction: '/api/accounts/123?balance=456.78',
      exception: { values: [{
        type: 'Error',
        value: 'PII and financial details',
        stacktrace: { frames: [{
          filename: '/Users/private/src/features/payments/action.ts',
          function: 'createPayment',
          lineno: 42,
          colno: 8,
          vars: { amount: '456.78' },
          pre_context: ['const amount = 456.78'],
        }] },
        mechanism: { type: 'onerror', handled: false, data: { message: 'sensitive' } },
      }] },
      request: { url: 'https://example.test/?token=secret', headers: { cookie: 'session' }, data: { amount: 456.78 } },
      user: { id: 'user-123', email: 'person@example.test' },
      breadcrumbs: [{ message: 'Submitted account 123 with 456.78' }],
      extra: { accountNumber: '123' },
      contexts: { custom: { taxId: '123456' } },
      tags: { tenantId: 'tenant-1' },
      logentry: { message: 'Sensitive log entry' },
    };

    const sanitized = sanitizeSentryEvent(event);

    expect(sanitized.event_id).toBe('event-1');
    expect(sanitized.exception?.values).toEqual([{
      type: 'Error',
      value: '[redacted]',
      stacktrace: { frames: [{
        filename: 'src/features/payments/action.ts',
        function: 'createPayment',
        lineno: 42,
        colno: 8,
      }] },
      mechanism: { type: 'onerror', handled: false },
    }]);
    expect(sanitized.message).toBe('Unhandled error');
    expect(sanitized.transaction).toBeUndefined();
    expect(sanitized.request).toBeUndefined();
    expect(sanitized.user).toBeUndefined();
    expect(sanitized.breadcrumbs).toBeUndefined();
    expect(sanitized.extra).toBeUndefined();
    expect(sanitized.contexts).toBeUndefined();
    expect(sanitized.tags).toBeUndefined();
    expect(sanitized.logentry).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toMatch(/123|456\.78|person@example|secret|Sensitive|Users\/private|vars|pre_context/);
    expect(event.exception.values[0].value).toBe('PII and financial details');
  });

  it('records only the error type in OTel, not its message or stack', () => {
    const span = { recordException: vi.fn(), setStatus: vi.fn() };
    const error = new Error('Account 123 has a balance of 456.78');

    recordSafeOtelException(span, error);

    expect(span.recordException).toHaveBeenCalledWith({ name: 'Error' });
    expect(span.setStatus).toHaveBeenCalledWith({ code: 2 });
    expect(JSON.stringify([span.recordException.mock.calls, span.setStatus.mock.calls]))
      .not.toMatch(/123|456\.78/);
  });

  it('preserves safe route identity and span timing while removing span content', () => {
    const transaction = {
      transaction: '/api/payments/[paymentId]',
      request: { url: 'https://example.test/api/payments?account=123' },
      spans: [{
        name: 'SELECT * FROM account WHERE id=123',
        op: 'db.query',
        description: 'account=123 balance=456.78',
        data: { statement: 'SELECT secret' },
        start_timestamp: 10,
        timestamp: 11,
        status: 'ok',
      }],
    };

    const sanitized = sanitizeSentryTransaction(transaction);

    expect(sanitized.transaction).toBe('/[segment]/[segment]/[param]');
    expect(sanitized.spans).toEqual([{
      start_timestamp: 10,
      timestamp: 11,
      status: 'ok',
      op: 'db.query',
      name: 'span',
    }]);
    expect(sanitized.request).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toMatch(/123|456\.78|secret|SELECT/);

    const unsafeRoute = sanitizeSentryTransaction({
      transaction: '/api/payments/account-123?amount=456.78',
      spans: [],
    });
    expect(unsafeRoute.transaction).toBe('/[segment]/[segment]/[segment]');
    expect(JSON.stringify(unsafeRoute)).not.toMatch(/account|123|456\.78/);

    const alphabeticRoute = sanitizeSentryTransaction({
      transaction: '/api/users/alice',
      spans: [],
    });
    expect(alphabeticRoute.transaction).toBe('/[segment]/[segment]/[segment]');
    expect(JSON.stringify(alphabeticRoute)).not.toMatch(/alice/);
  });

  it('retains stack frame identity for different errors without retaining source context', () => {
    const first = sanitizeSentryEvent({
      exception: { values: [{ type: 'Error', value: 'private one', stacktrace: { frames: [{
        filename: '/Users/private/src/features/payments/create.ts', function: 'createPayment', lineno: 8, colno: 2,
      }] } }] },
    });
    const second = sanitizeSentryEvent({
      exception: { values: [{ type: 'Error', value: 'private two', stacktrace: { frames: [{
        filename: '/Users/private/src/features/refunds/refund.ts', function: 'refundPayment', lineno: 27, colno: 2,
      }] } }] },
    });

    expect(first.exception?.values[0].stacktrace.frames[0].filename)
      .not.toBe(second.exception?.values[0].stacktrace.frames[0].filename);
    expect(first.exception?.values[0].stacktrace.frames[0].function)
      .not.toBe(second.exception?.values[0].stacktrace.frames[0].function);
    expect(JSON.stringify([first, second])).not.toMatch(/private one|private two|Users/);
  });

  it('rejects unverified route literals and unsafe exception mechanism names', () => {
    const event = sanitizeSentryEvent({
      exception: { values: [{
        type: 'Error',
        value: 'private',
        mechanism: { type: 'user-123-account', handled: false },
      }] },
    });
    const transaction = sanitizeSentryTransaction({
      transaction: '/users/alice-account',
      spans: [],
    });

    expect(event.exception?.values[0].mechanism).toEqual({ handled: false });
    expect(transaction.transaction).toBe('/[segment]/[segment]');
    expect(JSON.stringify([event, transaction])).not.toMatch(/alice|123-account/);
  });
});
