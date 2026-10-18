import { beforeEach, describe, expect, it, vi } from 'vitest';

const validatePeriod = vi.fn();

vi.mock('@/lib/services/with-period-validation', () => ({
  withPeriodValidation: () => validatePeriod,
}));

import { ActionError } from '@/lib/server-actions';
import { runCashActionWithReplay } from '../cash-action-replay';

describe('runCashActionWithReplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validatePeriod.mockResolvedValue(undefined);
  });

  it('returns an existing authorized replay without validating a closed period or writing', async () => {
    const replay = { id: 'payment-1' };
    const findReplay = vi.fn().mockResolvedValueOnce(replay);
    const write = vi.fn();

    await expect(runCashActionWithReplay({
      user: { userId: 'user-1' } as never,
      findReplay,
      write,
    })).resolves.toBe(replay);

    expect(validatePeriod).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('rechecks after a protected period rejection and returns a racing confirmed replay', async () => {
    const replay = { id: 'payment-raced' };
    const findReplay = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(replay);
    const write = vi.fn();
    validatePeriod.mockRejectedValueOnce(new ActionError('Closed', 'PERIODO_CERRADO'));

    await expect(runCashActionWithReplay({
      user: { userId: 'user-1' } as never,
      findReplay,
      write,
    })).resolves.toBe(replay);

    expect(findReplay).toHaveBeenCalledTimes(2);
    expect(write).not.toHaveBeenCalled();
  });
});
