import { describe, expect, it, vi } from 'vitest';
import { getVentaCreateIntentKey, resetVentaCreateIntent } from './venta-create-intent';

describe('sale create intent key lifecycle', () => {
  it('reuses the same key after an ambiguous failure and for concurrent submits', () => {
    const intent = { key: null };
    const createKey = vi.fn(() => 'intent-1');

    const firstAttempt = getVentaCreateIntentKey(intent, createKey);
    const retryAfterNetworkError = getVentaCreateIntentKey(intent, createKey);
    const doubleClick = getVentaCreateIntentKey(intent, createKey);

    expect([firstAttempt, retryAfterNetworkError, doubleClick]).toEqual([
      'intent-1', 'intent-1', 'intent-1',
    ]);
    expect(createKey).toHaveBeenCalledTimes(1);
  });

  it('retains the key for an edited payload so the server can fail closed on conflict', () => {
    const intent = { key: null };
    const first = getVentaCreateIntentKey(intent, () => 'intent-1');
    const editedPayloadRetry = getVentaCreateIntentKey(intent, () => 'intent-2');

    expect(editedPayloadRetry).toBe(first);
  });

  it('rotates only after success or explicit abandonment', () => {
    const intent = { key: null };
    let sequence = 0;
    const createKey = () => `intent-${++sequence}`;

    expect(getVentaCreateIntentKey(intent, createKey)).toBe('intent-1');
    resetVentaCreateIntent(intent);
    expect(getVentaCreateIntentKey(intent, createKey)).toBe('intent-2');
    resetVentaCreateIntent(intent);
    expect(getVentaCreateIntentKey(intent, createKey)).toBe('intent-3');
  });
});
