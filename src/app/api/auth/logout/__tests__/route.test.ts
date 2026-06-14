import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/actions', () => ({
  logoutAction: vi.fn(),
}));

import { logoutAction } from '@/features/auth/actions';
import { POST } from '../route';

describe('/api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success when the logout action succeeds', async () => {
    vi.mocked(logoutAction).mockResolvedValue({ success: true } as never);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Logout exitoso');
  });

  it('still returns success when the logout action reports a handled failure', async () => {
    vi.mocked(logoutAction).mockResolvedValue({
      success: false,
      error: { message: 'No autenticado', code: 'AUTH_REQUIRED' },
    } as never);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Logout exitoso');
  });
});
