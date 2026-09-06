/**
 * @description Tests para aislamiento tenant en getOrCreateTurnoActivo.
 * El flujo actual busca el turno activo por puntoDeVentaId sin verificar
 * que el POS pertenece al tenant antes de leer el turno.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockPrisma = vi.hoisted(() => ({
  puntoDeVenta: { findFirst: vi.fn() },
  turnoPuntoVenta: { findFirst: vi.fn(), create: vi.fn() },
}));

const mockUser = vi.hoisted(
  (): AuthenticatedUser => ({
    userId: 'user-1', tenantId: 'tenant-A',
    role: 'ADMIN', email: 'admin@test.com', name: 'Admin',
  }),
);

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-A'),
  requireFeature: vi.fn(),
}));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(() => Promise.resolve(mockUser)),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getOrCreateTurnoActivo } from '../actions';

describe('getOrCreateTurnoActivo – aislamiento tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza POS de otro tenant aunque haya turno activo', async () => {
    mockPrisma.puntoDeVenta.findFirst.mockResolvedValue(null);
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);

    const result = await getOrCreateTurnoActivo({ puntoDeVentaId: 'pv-B' });

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('NOT_FOUND');
  });

  it('incluye tenantId al buscar turno activo', async () => {
    mockPrisma.puntoDeVenta.findFirst.mockResolvedValue({ pvId: 'pv-1', tipoCaja: 'MOVIL' });
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue({ id: 'turno-1', tenantId: 'tenant-A' });

    await getOrCreateTurnoActivo({ puntoDeVentaId: 'pv-1' });

    expect(mockPrisma.turnoPuntoVenta.findFirst).toHaveBeenCalledWith({
      where: { puntoDeVentaId: 'pv-1', tenantId: 'tenant-A', estado: 'ABIERTO' },
    });
  });

  it('incluye tenantId al crear turno automático', async () => {
    mockPrisma.puntoDeVenta.findFirst.mockResolvedValue({ pvId: 'pv-1', tipoCaja: 'MOVIL' });
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);
    mockPrisma.turnoPuntoVenta.create.mockResolvedValue({ id: 'turno-2' });

    await getOrCreateTurnoActivo({ puntoDeVentaId: 'pv-1' });

    expect(mockPrisma.turnoPuntoVenta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-A' }),
      }),
    );
  });
});
