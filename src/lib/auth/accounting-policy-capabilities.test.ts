import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  tenantMembership: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('accounting policy capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite manage solo a manager activo del tenant exacto', async () => {
    prismaMock.tenantMembership.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      userId: 'user-a',
      tenantRole: 'manager',
      isActive: true,
      user: { isActive: true },
    });
    const { canManageAccountingPolicy } = await import('./accounting-policy-capabilities');

    await expect(canManageAccountingPolicy('user-a', 'tenant-a')).resolves.toBe(true);
    expect(prismaMock.tenantMembership.findUnique).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: 'tenant-a', userId: 'user-a' } },
      select: expect.objectContaining({ tenantRole: true, isActive: true }),
    });
  });

  it.each(['economico', 'dependiente', 'admin'])('deniega manage al rol nominal %s', async (role) => {
    prismaMock.tenantMembership.findUnique.mockResolvedValue({
      tenantRole: role,
      isActive: true,
      user: { isActive: true },
    });
    const { canManageAccountingPolicy } = await import('./accounting-policy-capabilities');

    await expect(canManageAccountingPolicy('user-a', 'tenant-a')).resolves.toBe(false);
  });

  it('permite rollout solo al admin de plataforma activo', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'admin', isActive: true });
    const { canRunAccountingPolicyRollout } = await import('./accounting-policy-capabilities');

    await expect(canRunAccountingPolicyRollout('operator-a')).resolves.toBe(true);

    prismaMock.user.findUnique.mockResolvedValue({ role: 'admin', isActive: false });
    await expect(canRunAccountingPolicyRollout('operator-a')).resolves.toBe(false);
  });
});
