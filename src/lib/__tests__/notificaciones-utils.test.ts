/**
 * @description Tests unitarios para utilidades de notificaciones.
 *
 * Regresión 2026-10-03: el modelo `User` NO tiene escalar `tenantId`
 * (la pertenencia al tenant es por `TenantMembership`) y el modelo
 * `Notification` tampoco tiene `tenantId`. El broadcast debe resolver
 * usuarios por membresía y no filtrar `user` por `tenantId`, ni pasar
 * `tenantId` al payload de `notification.create`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    tenantMembership: {
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    merma: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { crearNotificacion, notificarMerma } from '@/lib/notificaciones-utils';

/**
 * @description Falla ante cualquier consulta a User, ya que las notificaciones
 * del tenant deben resolverse mediante TenantMembership.
 */
function simularValidacionPrismaUser() {
  vi.mocked(prisma.user.findMany).mockRejectedValue(
    new Error('Unexpected User query; tenant membership is the supported lookup.'),
  );
}

describe('notificaciones-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simularValidacionPrismaUser();
  });

  it('crea notificaciones solo para usuarios del tenant vía membresía', async () => {
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([
      { userId: 'u-1' },
      { userId: 'u-2' },
    ] as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

    const result = await crearNotificacion({
      title: 'Test',
      message: 'Mensaje',
      type: 'merma',
      prioridad: 'media',
      tenantId: 'tenant-1',
    } as any);

    // NO debe consultar user por el escalar inexistente tenantId
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    // Debe resolver usuarios por TenantMembership (membresía y usuario activos)
    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true, user: { isActive: true } },
      select: { userId: true },
    });
    expect(result).toHaveLength(2);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    // El modelo Notification no tiene tenantId: no debe llegar al create
    for (const call of vi.mocked(prisma.notification.create).mock.calls) {
      expect(call[0].data).not.toHaveProperty('tenantId');
    }
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u-1' }),
    });
  });

  it('crea notificación para usuario específico sin broadcast', async () => {
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'n-1' } as any);

    const result = await crearNotificacion({
      title: 'Test',
      message: 'Mensaje',
      type: 'merma',
      prioridad: 'media',
      userId: 'u-1',
    } as any);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.tenantMembership.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        title: 'Test',
        message: 'Mensaje',
        type: 'merma',
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
        type: 'merma',
        prioridad: 'media',
      } as any),
    ).rejects.toThrow('tenantId is required');
  });

  describe('notificarMerma', () => {
    it('notifica a los miembros activos del tenant sin lanzar', async () => {
      vi.mocked(prisma.merma.findUnique).mockResolvedValue({
        mermaId: 'm-1',
        tenantId: 'tenant-1',
        cantidad: 60,
        motivo: 'rotura',
        producto: { nombre: 'Harina' },
      } as any);
      vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([
        { userId: 'u-1' },
        { userId: 'u-2' },
      ] as any);
      vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

      await expect(notificarMerma('m-1')).resolves.toBeUndefined();

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', isActive: true, user: { isActive: true } },
        select: { userId: true },
      });
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Nueva Merma Registrada',
          type: 'merma',
          prioridad: 'alta',
        }),
      });
      for (const call of vi.mocked(prisma.notification.create).mock.calls) {
        expect(call[0].data).not.toHaveProperty('tenantId');
      }
    });

    it('no hace nada si la merma no existe', async () => {
      vi.mocked(prisma.merma.findUnique).mockResolvedValue(null);

      await expect(notificarMerma('m-inexistente')).resolves.toBeUndefined();

      expect(prisma.tenantMembership.findMany).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
