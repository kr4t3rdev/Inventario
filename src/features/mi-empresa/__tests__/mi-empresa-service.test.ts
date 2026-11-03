/**
 * @description Pruebas del servicio de Mi Empresa para la ventana configurable
 * de alerta de vencimiento de lotes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    miEmpresa: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/ean13-reset', () => ({
  clearEan13Codes: vi.fn(),
  resetProductsForEan13: vi.fn(),
}));

vi.mock('@/lib/upload/cloudinary-admin', () => ({
  replaceOwnerAsset: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { upsertMiEmpresa } from '@/features/mi-empresa/services/mi-empresa-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const manager: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Manager',
  email: 'manager@test.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { 'lotes-series': true },
};

describe('upsertMiEmpresa - ventana de alerta de vencimiento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.miEmpresa.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.miEmpresa.upsert).mockResolvedValue({ id: 'empresa-1' } as never);
  });

  it('persiste la ventana configurada por el tenant', async () => {
    await upsertMiEmpresa({
      input: { diasAlertaVencimientoLotes: 15 },
      user: manager,
    });

    expect(prisma.miEmpresa.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ diasAlertaVencimientoLotes: 15 }),
      }),
    );
  });

  it('rechaza una ventana fuera del rango permitido', async () => {
    await expect(
      upsertMiEmpresa({
        input: { diasAlertaVencimientoLotes: 90 },
        user: manager,
      }),
    ).rejects.toThrow();

    expect(prisma.miEmpresa.upsert).not.toHaveBeenCalled();
  });

  it('usa 30 días por defecto al crear la empresa', async () => {
    await upsertMiEmpresa({ input: { nombre: 'Mi Empresa' }, user: manager });

    expect(prisma.miEmpresa.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ diasAlertaVencimientoLotes: 30 }),
      }),
    );
  });
});
