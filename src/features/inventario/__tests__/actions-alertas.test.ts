/**
 * @description Pruebas de la Server Action de alertas de vencimiento de lotes.
 * Cubre el gating por plan, el aislamiento por tenant y la ventana configurable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lote: {
      findMany: vi.fn(),
    },
    miEmpresa: {
      findFirst: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getAlertasVencimientoAction } from '@/features/inventario/actions-alertas';

const HOY = new Date('2026-11-03T00:00:00.000Z');

function usuarioConPlan(planFeatures: Record<string, boolean>) {
  return {
    userId: 'user-1',
    name: 'Usuario',
    email: 'usuario@test.com',
    role: 'regularUser',
    isActive: true,
    tenantId: 'tenant-1',
    tenantRole: 'manager',
    planFeatures,
  } as never;
}

describe('getAlertasVencimientoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(HOY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('devuelve las alertas del tenant usando la ventana configurada', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(usuarioConPlan({ 'lotes-series': true }));
    vi.mocked(prisma.miEmpresa.findFirst).mockResolvedValue({
      diasAlertaVencimientoLotes: 15,
    } as never);
    vi.mocked(prisma.lote.findMany).mockResolvedValue([
      {
        id: 'lote-1',
        codigo: 'L-1',
        fechaVencimiento: new Date('2026-11-10T00:00:00.000Z'),
        cantidadDisponible: 5,
        producto: { id: 'prod-1', nombre: 'Arroz' },
      },
      {
        id: 'lote-2',
        codigo: 'L-2',
        fechaVencimiento: new Date('2026-11-01T00:00:00.000Z'),
        cantidadDisponible: 3,
        producto: { id: 'prod-2', nombre: 'Frijoles' },
      },
    ] as never);

    const response = await getAlertasVencimientoAction();

    expect(response.success).toBe(true);
    const data = expectActionSuccess(response).data!;
    expect(data.diasAlerta).toBe(15);
    expect(data.total).toBe(2);
    expect(data.vencidos).toBe(1);
    expect(data.porVencer).toBe(1);
    expect(data.alertas[0]).toMatchObject({ loteId: 'lote-2', estado: 'VENCIDO' });
    expect(prisma.lote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
    expect(prisma.lote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaVencimiento: {
            not: null,
            lte: new Date('2026-11-18T23:59:59.999Z'),
          },
        }),
      }),
    );
  });

  it('permite ajustar la ventana por llamada y la acota a 30 días', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(usuarioConPlan({ 'lotes-series': true }));
    vi.mocked(prisma.miEmpresa.findFirst).mockResolvedValue({
      diasAlertaVencimientoLotes: 10,
    } as never);
    vi.mocked(prisma.lote.findMany).mockResolvedValue([] as never);

    const response = await getAlertasVencimientoAction({ diasAlerta: 90 });

    expect(response.success).toBe(true);
    expect(expectActionSuccess(response).data?.diasAlerta).toBe(30);
  });

  it('bloquea la consulta cuando el plan no incluye lotes y series', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(usuarioConPlan({ 'lotes-series': false }));

    const response = await getAlertasVencimientoAction();

    expect(response.success).toBe(false);
    expect(expectActionFailure(response).error?.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(prisma.lote.findMany).not.toHaveBeenCalled();
  });

  it('devuelve error si falta el tenant activo', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'user-1',
      name: 'Usuario',
      email: 'usuario@test.com',
      role: 'regularUser',
      isActive: true,
      tenantRole: 'manager',
      planFeatures: { 'lotes-series': true },
    } as never);

    const response = await getAlertasVencimientoAction();

    expect(response.success).toBe(false);
    expect(expectActionFailure(response).error?.message).toBe('Error interno del servidor');
    expect(prisma.lote.findMany).not.toHaveBeenCalled();
  });
});
