import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/actions', () => ({
  meAction: vi.fn(),
}));

import { meAction } from '@/features/auth/actions';
import { GET } from '../route';

describe('/api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the authenticated user payload when the action succeeds', async () => {
    vi.mocked(meAction).mockResolvedValue({
      success: true,
      data: {
        user: {
          userId: 'user-1',
          email: 'test@example.com',
          tenantId: 'tenant-1',
        },
      },
    } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.userId).toBe('user-1');
    expect(data.tenantId).toBe('tenant-1');
  });

  it('maps auth-required errors to 401', async () => {
    vi.mocked(meAction).mockResolvedValue({
      success: false,
      error: {
        message: 'No autenticado',
        code: 'AUTH_REQUIRED',
      },
    } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('No autenticado');
  });
});
