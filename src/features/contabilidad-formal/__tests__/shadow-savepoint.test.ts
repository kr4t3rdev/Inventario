import { describe, expect, it, vi } from 'vitest';

import { intentarPosteoShadow } from '../services/shadow-savepoint';

describe('intentarPosteoShadow', () => {
  it('always rolls back the shadow write and releases the savepoint', async () => {
    const tx = { $executeRawUnsafe: vi.fn().mockResolvedValue(1) };
    const attempt = vi.fn().mockResolvedValue(undefined);

    const result = await intentarPosteoShadow(tx as never, attempt);

    expect(result).toEqual({ ok: true });
    expect(tx.$executeRawUnsafe.mock.calls).toEqual([
      ['SAVEPOINT cta_posteo_shadow'],
      ['ROLLBACK TO SAVEPOINT cta_posteo_shadow'],
      ['RELEASE SAVEPOINT cta_posteo_shadow'],
    ]);
  });

  it('returns a posting error only after cleanup succeeds', async () => {
    const tx = { $executeRawUnsafe: vi.fn().mockResolvedValue(1) };
    const error = new Error('formal insert failed');

    const result = await intentarPosteoShadow(tx as never, async () => {
      throw error;
    });

    expect(result).toEqual({ ok: false, error });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(3);
  });

  it('does not swallow savepoint infrastructure failures or run the posting', async () => {
    const failure = new Error('savepoint unavailable');
    const tx = { $executeRawUnsafe: vi.fn().mockRejectedValue(failure) };
    const attempt = vi.fn();

    await expect(intentarPosteoShadow(tx as never, attempt)).rejects.toBe(failure);
    expect(attempt).not.toHaveBeenCalled();
  });
});
