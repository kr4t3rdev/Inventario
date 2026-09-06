/**
 * @description Tests RED para el fix de numeración concurrente en createContratoAction.
 * El helper crearContratoConConsecutivo existe pero las rutas reales no lo usan.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockTx = {
  contrato: { create: vi.fn() as any },
  contratoVersion: { create: vi.fn() as any },
  cliente: { update: vi.fn() as any },
};

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-A'),
  requireFeature: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    contratoVersion: { create: vi.fn() },
    cliente: { findFirst: vi.fn(), update: vi.fn() },
    vendor: { findFirst: vi.fn() },
  },
}));
vi.mock('@/features/contratos/lib/numeroContratoGenerator', () => ({
  generarProximoConsecutivo: vi.fn(),
  formatearNumeroContrato: vi.fn(),
  crearContratoConConsecutivo: vi.fn(),
}));

import {
  formatearNumeroContrato,
  crearContratoConConsecutivo,
} from '@/features/contratos/lib/numeroContratoGenerator';
import { createContratoAction } from '@/features/contratos/actions';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', tenantId: 'tenant-A', tenantRole: 'admin',
  role: 'admin', name: 'Test', email: 'test@test.com', isActive: true,
};

const baseInput = {
  tipo: 'COMPRA_VENTA' as const,
  fechaInicio: '2026-01-01T12:00:00.000Z',
  moneda: 'CUP',
  numeroContratoClienteProveedor: null,
  monto: '1000',
  condiciones: 'condiciones',
  observaciones: null,
  clienteId: 'cli-1',
  vendorId: null,
};

describe('createContratoAction – numeración concurrente (RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(formatearNumeroContrato).mockReturnValue('CV-0001');
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-1' } as any);
  });

  it('usa crearContratoConConsecutivo para el insert', async () => {
    vi.mocked(crearContratoConConsecutivo).mockResolvedValue({
      contratoId: 'ct-1',
    } as any);
    vi.mocked(prisma.contratoVersion.create).mockResolvedValue({} as any);
    vi.mocked(prisma.cliente.update).mockResolvedValue({} as any);

    await createContratoAction(baseInput as any);

    expect(crearContratoConConsecutivo).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-A',
        tipo: 'COMPRA_VENTA',
      }),
    );
    // No debe llamar a generarProximoConsecutivo antes del create (hace doble read)
    expect(prisma.contrato.findFirst).not.toHaveBeenCalled();
  });

  it('retrasa errores de cliente no encontrado antes del create', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);

    const result = await createContratoAction(baseInput as any);

    expect(result.success).toBe(false);
    expect(crearContratoConConsecutivo).not.toHaveBeenCalled();
  });
});
