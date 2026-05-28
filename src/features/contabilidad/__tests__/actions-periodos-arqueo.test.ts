/**
 * @description Tests para integrarArqueosEnPeriodoAction.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockPrisma = vi.hoisted(() => ({
  periodoContable: {
    findFirst: vi.fn(),
  },
  arqueoCaja: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  venta: {
    findMany: vi.fn(),
  },
  aperturaPeriodo: {
    upsert: vi.fn(),
  },
}));

const mockUser = vi.hoisted((): AuthenticatedUser => ({
  userId: 'user-1',
  tenantId: 'tenant-mock-1',
  role: 'ADMIN',
  email: 'test@test.com',
  name: 'Test User',
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-mock-1'),
}));

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(() => Promise.resolve(mockUser)),
}));

import { integrarArqueosEnPeriodoAction } from '../actions-periodos';

describe('integrarArqueosEnPeriodoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should integrate arqueos and update detalleJson', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'periodo-1',
      tenantId: 'tenant-mock-1',
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2026-01-31'),
      apertura: null,
    });

    mockPrisma.arqueoCaja.findMany.mockResolvedValue([
      {
        id: 'arqueo-1',
        puntoDeVentaId: 'pv-1',
        totalEfectivoCup: 150000,
        totalEfectivoUsd: 0,
        totalTarjeta: 50000,
        totalTransferencia: 0,
        totalCredito: 0,
        diferenciaCup: 0,
        diferenciaUsd: 0,
        contabilizado: false,
      },
    ]);

    mockPrisma.venta.findMany.mockResolvedValue([
      { metodoPago: 'EFECTIVO', total: 100000 },
      { metodoPago: 'TARJETA', total: 50000 },
    ]);

    const result = await integrarArqueosEnPeriodoAction('periodo-1', mockUser);

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.arqueosIntegrados).toBe(1);
    }

    // Verificar que se actualizó detalleJson
    expect(mockPrisma.aperturaPeriodo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodoId: 'periodo-1' },
        create: expect.objectContaining({
          periodoId: 'periodo-1',
          detalleJson: expect.objectContaining({
            ventasPorMetodoPago: expect.objectContaining({
              efectivo: 100000,
              tarjeta: 50000,
            }),
          }),
        }),
      }),
    );

    // Verificar que se marcaron como contabilizados
    expect(mockPrisma.arqueoCaja.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['arqueo-1'] } },
        data: { contabilizado: true },
      }),
    );
  });

  it('should return 0 when no arqueos to integrate', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'periodo-1',
      tenantId: 'tenant-mock-1',
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2026-01-31'),
      apertura: null,
    });

    mockPrisma.arqueoCaja.findMany.mockResolvedValue([]);

    const result = await integrarArqueosEnPeriodoAction('periodo-1', mockUser);

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.arqueosIntegrados).toBe(0);
    }

    // No debe llamar upsert ni updateMany si no hay arqueos
    expect(mockPrisma.aperturaPeriodo.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.arqueoCaja.updateMany).not.toHaveBeenCalled();
  });

  it('should not re-integrate already contabilizado arqueos', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'periodo-1',
      tenantId: 'tenant-mock-1',
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2026-01-31'),
      apertura: null,
    });

    // Primera integración: 1 arqueo
    mockPrisma.arqueoCaja.findMany
      .mockResolvedValueOnce([{ id: 'arqueo-1', /* ... */ }])
      .mockResolvedValueOnce([]); // Segunda llamada: 0 arqueos no contabilizados
    mockPrisma.venta.findMany.mockResolvedValue([]);

    const firstResult = await integrarArqueosEnPeriodoAction('periodo-1', mockUser);
    expect(firstResult.success).toBe(true);

    const secondResult = await integrarArqueosEnPeriodoAction('periodo-1', mockUser);
    expect(secondResult.success).toBe(true);
    if (secondResult.success && secondResult.data) {
      expect(secondResult.data.arqueosIntegrados).toBe(0);
    }
  });

  it('should fail when periodo does not exist', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const result = await integrarArqueosEnPeriodoAction('periodo-invalid', mockUser);

    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      expect(result.error.message).toContain('no encontrado');
    }
  });
});
