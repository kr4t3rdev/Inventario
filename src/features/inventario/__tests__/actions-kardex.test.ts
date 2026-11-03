import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    stockMoveLine: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    ubicacion: { findFirst: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getKardexAction } from '@/features/inventario/actions-kardex';

describe('getKardexAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consulta el kardex paginado del tenant autenticado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'user',
      planFeatures: {},
    } as never);
    vi.mocked(prisma.stockMoveLine.findMany).mockResolvedValue([
      {
        id: 'move-1',
        tenantId: 'tenant-1',
        productoId: 'producto-1',
        tipoOrigen: 'COMPRA',
        origenId: 'compra-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'almacen-1',
        cantidad: 10,
        costoUnitario: 100,
        costoTotal: 1000,
        creadoPorId: null,
        createdAt: new Date('2026-01-01'),
      },
    ] as never);
    vi.mocked(prisma.stockMoveLine.count).mockResolvedValue(1 as never);

    const response = await getKardexAction({ productoId: 'producto-1', page: 1, limit: 50 });

    expect(response.success).toBe(true);
    expect(expectActionSuccess(response).data?.saldoInicial).toBe(0);
    expect(expectActionSuccess(response).data?.total).toBe(1);
    expect(expectActionSuccess(response).data?.items).toEqual([
      expect.objectContaining({ id: 'move-1', saldo: 10 }),
    ]);
    expect(prisma.stockMoveLine.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', productoId: 'producto-1' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 50,
    });
  });

  it('rechaza el kardex sin producto', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'user',
      planFeatures: {},
    } as never);

    const response = await getKardexAction({} as never);

    expect(response.success).toBe(false);
    expect(prisma.stockMoveLine.findMany).not.toHaveBeenCalled();
  });

  it('valida la hoja contra el tenant y filtra el kardex por ubicación hija', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'user',
      planFeatures: { 'ubicaciones-avanzadas': true },
    } as never);
    vi.mocked(prisma.ubicacion.findFirst).mockResolvedValue({ id: 'hoja-1' } as never);
    vi.mocked(prisma.stockMoveLine.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.stockMoveLine.count).mockResolvedValue(0 as never);

    const response = await getKardexAction({
      productoId: 'producto-1',
      tipoUbicacion: 'almacen',
      ubicacionId: 'alm-1',
      ubicacionHijaId: 'hoja-1',
    });

    expect(response.success).toBe(true);
    expect(prisma.ubicacion.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'hoja-1',
        tenantId: 'tenant-1',
        almacenId: 'alm-1',
        children: { none: {} },
      },
      select: { id: true },
    });
    expect(prisma.stockMoveLine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ubicacionHijaId: 'hoja-1' }),
    }));
  });

  it('rechaza ubicaciones hijas que no pertenecen al almacén o tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'user',
      planFeatures: { 'ubicaciones-avanzadas': true },
    } as never);
    vi.mocked(prisma.ubicacion.findFirst).mockResolvedValue(null as never);

    const response = await getKardexAction({
      productoId: 'producto-1',
      tipoUbicacion: 'almacen',
      ubicacionId: 'alm-1',
      ubicacionHijaId: 'hoja-other',
    });

    expect(response.success).toBe(false);
    expect(prisma.stockMoveLine.findMany).not.toHaveBeenCalled();
  });

  it('devuelve error si falta el tenant activo', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'user-1',
      role: 'user',
    } as never);

    const response = await getKardexAction({ productoId: 'producto-1' });

    expect(response.success).toBe(false);
    expect(expectActionFailure(response).error?.message).toBe('Error interno del servidor');
    expect(prisma.stockMoveLine.findMany).not.toHaveBeenCalled();
  });
});
