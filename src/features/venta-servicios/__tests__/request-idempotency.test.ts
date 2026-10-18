import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveServiceSaleRequestKey } from '../request-idempotency';

describe('service-sale retry keys', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reuses a key for the same payload and rotates it for changed user intent', () => {
    const randomUUID = vi.fn()
      .mockReturnValueOnce('retry-key')
      .mockReturnValueOnce('new-intent-key');
    vi.stubGlobal('crypto', { randomUUID });

    const first = resolveServiceSaleRequestKey(null, '{"quantity":1}');
    const retry = resolveServiceSaleRequestKey(first, '{"quantity":1}');
    const changed = resolveServiceSaleRequestKey(retry, '{"quantity":2}');

    expect(retry).toBe(first);
    expect(changed).toEqual({ fingerprint: '{"quantity":2}', key: 'new-intent-key' });
    expect(randomUUID).toHaveBeenCalledTimes(2);
  });
});
