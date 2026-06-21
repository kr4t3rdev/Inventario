/**
 * @description Tests unitarios para utilidades de notificaciones.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { crearNotificacion } from '@/lib/notificaciones-utils';

describe('notificaciones-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea notificaciones solo para usuarios del tenant', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { userId: 'u-1' },
      { userId: 'u-2' },
    ] as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

    const result = await crearNotificacion({
      title: 'Test',
      message: 'Mensaje',
      type: 'info',
      prioridad: 'media',
      tenantId: 'tenant-1',
    } as any);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { isActive: true, tenantId: 'tenant-1' },
      select: { userId: true },
    });
    expect(result).toHaveLength(2);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it('crea notificación para usuario específico sin broadcast', async () => {
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'n-1' } as any);

    const result = await crearNotificacion({
      title: 'Test',
      message: 'Mensaje',
      type: 'info',
      prioridad: 'media',
      userId: 'u-1',
    } as any);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        title: 'Test',
        message: 'Mensaje',
        type: 'info',
        prioridad: 'media',
        userId: 'u-1',
      },
    });
    expect(result).toHaveLength(1);
  });

  it('rechaza broadcast sin tenantId', async () => {
    await expect(
      crearNotificacion({
        title: 'Test',
        message: 'Mensaje',
        type: 'info',
        prioridad: 'media',
      } as any),
    ).rejects.toThrow('tenantId is required');
  });
});
