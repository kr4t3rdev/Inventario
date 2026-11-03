import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';

vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    almacen: { findFirst: vi.fn() },
    ubicacion: { findMany: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getUbicacionesHijasAction } from '@/features/inventario/actions-ubicaciones';

const manager = {
  userId: 'user-1',
  name: 'Manager',
  email: 'manager@test.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { 'ubicaciones-avanzadas': true },
} as never;

describe('getUbicacionesHijasAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(manager);
    vi.mocked(prisma.almacen.findFirst).mockResolvedValue({ almacenId: 'alm-1' } as never);
    vi.mocked(prisma.ubicacion.findMany).mockResolvedValue([
      { id: 'hoja-general', nombre: 'General', parentId: 'zona-1' },
      { id: 'hoja-a1', nombre: 'A-1', parentId: 'pasillo-a' },
    ] as never);
  });

  it('devuelve solo hojas del almacén y tenant activo', async () => {
    const response = await getUbicacionesHijasAction({ almacenId: 'alm-1' });

    expect(response.success).toBe(true);
    expect(expectActionSuccess(response).data).toHaveLength(2);
    expect(prisma.ubicacion.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        almacenId: 'alm-1',
        children: { none: {} },
      },
      select: { id: true, nombre: true, parentId: true },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
  });

  it('rechaza almacenes de otro tenant', async () => {
    vi.mocked(prisma.almacen.findFirst).mockResolvedValue(null as never);

    const response = await getUbicacionesHijasAction({ almacenId: 'alm-otro' });

    expect(response.success).toBe(false);
    expect(expectActionFailure(response).error?.code).toBe('NOT_FOUND');
    expect(prisma.ubicacion.findMany).not.toHaveBeenCalled();
  });

  it('bloquea el acceso si el plan no incluye ubicaciones avanzadas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...manager,
      planFeatures: { 'ubicaciones-avanzadas': false },
    } as never);

    const response = await getUbicacionesHijasAction({ almacenId: 'alm-1' });

    expect(response.success).toBe(false);
    expect(expectActionFailure(response).error?.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(prisma.almacen.findFirst).not.toHaveBeenCalled();
  });
});