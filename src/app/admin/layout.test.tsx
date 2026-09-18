import { describe, expect, it, vi } from 'vitest';

const { getProtectedRouteIdentity, redirect } = vi.hoisted(() => ({
  getProtectedRouteIdentity: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock('@/lib/auth/server-route-identity', () => ({
  getProtectedRouteIdentity,
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('@/components/admin-layout-client', () => ({
  AdminLayoutClient: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/admin-sidebar', () => ({
  AdminSidebar: () => null,
}));

import AdminLayout from './layout';

describe('AdminLayout authorization', () => {
  it('denies an active tenant user because /admin requires platform admin', async () => {
    getProtectedRouteIdentity.mockResolvedValue({
      role: 'manager',
      isActive: true,
      tenantId: 'tenant-1',
    });

    await expect(AdminLayout({ children: null })).rejects.toThrow(
      'NEXT_REDIRECT:/busy/dashboard',
    );
    expect(redirect).toHaveBeenCalledWith('/busy/dashboard');
  });
});
