/**
 * @description Tests para las Server Actions de Turnos de Punto de Venta.
 *
 * Patrón: mock de prisma y requireTenant, llamada directa a la action
 * con un mock de AuthenticatedUser.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ── Mocks de dependencias externas ────────────────────────

const mockPrisma = vi.hoisted(() => ({
  puntoDeVenta: {
    findFirst: vi.fn(),
  },
  turnoPuntoVenta: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ── Import después de mocks ───────────────────────────────

import { abrirTurnoAction, cerrarTurnoAction, getTurnosAction, getOrCreateTurnoActivo } from '../actions';

function buildTurno(overrides: Record<string, unknown> = {}) {
  return {
    id: 'turno-1',
    tenantId: 'tenant-mock-1',
    puntoDeVentaId: 'pv-1',
    empleadoId: null,
    estado: 'ABIERTO',
    fondoInicialCup: 50000,
    fondoInicialUsd: 0,
    fechaApertura: new Date(),
    fechaCierre: null,
    observaciones: null,
    tipo: 'PRINCIPAL',
    ...overrides,
  };
}

// ─── Suite: abrirTurnoAction ──────────────────────────────

describe('abrirTurnoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // puntoDeVenta.findFirst devuelve un POS válido por defecto
    mockPrisma.puntoDeVenta.findFirst.mockResolvedValue({ pvId: 'pv-1', nombre: 'PV Test', tipoCaja: 'PRINCIPAL' });
  });

  it('should open a turno when no active turno exists', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);
    mockPrisma.turnoPuntoVenta.create.mockResolvedValue(buildTurno());

    const result = await abrirTurnoAction(
      { puntoDeVentaId: 'pv-1', fondoInicialCup: 50000, fondoInicialUsd: 0 },
      mockUser,
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(mockPrisma.turnoPuntoVenta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          puntoDeVentaId: 'pv-1',
          fondoInicialCup: 50000,
          estado: 'ABIERTO',
        }),
      }),
    );
  });

  it('should register fondoInicialCup = 50000 correctly', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);
    mockPrisma.turnoPuntoVenta.create.mockResolvedValue(buildTurno({ fondoInicialCup: 50000 }));

    const result = await abrirTurnoAction(
      { puntoDeVentaId: 'pv-1', fondoInicialCup: 50000, fondoInicialUsd: 0 },
      mockUser,
    );

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.fondoInicialCup).toBe(50000);
    }
  });

  it('should fail when there is already an ABIERTO turno', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(buildTurno());

    const result = await abrirTurnoAction(
      { puntoDeVentaId: 'pv-1', fondoInicialCup: 50000, fondoInicialUsd: 0 },
      mockUser,
    );

    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      expect(result.error.message).toContain('Ya existe un turno abierto');
    }
  });

  it('should fail validation with negative fondo', async () => {
    const result = await abrirTurnoAction(
      { puntoDeVentaId: 'pv-1', fondoInicialCup: -100, fondoInicialUsd: 0 },
      mockUser,
    );

    expect(result.success).toBe(false);
  });
});

// ─── Suite: getOrCreateTurnoActivo ─────────────────────────

describe('getOrCreateTurnoActivo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.puntoDeVenta.findFirst.mockResolvedValue({ pvId: 'pv-1', nombre: 'PV Test', tipoCaja: 'PRINCIPAL' });
  });

  it('should return existing turno if found', async () => {
    const turno = buildTurno();
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(turno);

    const result = await getOrCreateTurnoActivo({ puntoDeVentaId: 'pv-1' });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.turnoId).toBe('turno-1');
      expect(result.data.created).toBe(false);
    }
  });

  it('should throw NO_TURNO_ACTIVO for PRINCIPAL without turno', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);

    const result = await getOrCreateTurnoActivo({ puntoDeVentaId: 'pv-1' });

    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      expect(result.error.code).toBe('NO_TURNO_ACTIVO');
    }
  });

  it('should auto-create turno for MOVIL without active turno', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);
    mockPrisma.puntoDeVenta.findFirst.mockResolvedValue({ pvId: 'pv-1', nombre: 'PV Test', tipoCaja: 'MOVIL' });
    mockPrisma.turnoPuntoVenta.create.mockResolvedValue(buildTurno());

    const result = await getOrCreateTurnoActivo({ puntoDeVentaId: 'pv-1' });

    expect(result.success).toBe(true);
    expect(mockPrisma.turnoPuntoVenta.create).toHaveBeenCalled();
  });
});

// ─── Suite: cerrarTurnoAction ─────────────────────────────

describe('cerrarTurnoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should close an active turno', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(
      buildTurno({ _count: { ventas: 0 }, arqueo: { id: 'arqueo-1', totalEfectivoCup: 150000 } }),
    );
    mockPrisma.turnoPuntoVenta.update.mockResolvedValue(buildTurno({ estado: 'CERRADO' }));

    const result = await cerrarTurnoAction({ turnoId: 'turno-1', forzar: false });

    expect(result.success).toBe(true);
    expect(mockPrisma.turnoPuntoVenta.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'turno-1' },
        data: expect.objectContaining({ estado: 'CERRADO' }),
      }),
    );
  });

  it('should close with forzar=true even without arqueo', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(
      buildTurno({ _count: { ventas: 5 }, arqueo: null }),
    );
    mockPrisma.turnoPuntoVenta.update.mockResolvedValue(buildTurno({ estado: 'CERRADO' }));

    const result = await cerrarTurnoAction({ turnoId: 'turno-1', forzar: true });

    expect(result.success).toBe(true);
    expect(mockPrisma.turnoPuntoVenta.update).toHaveBeenCalled();
  });

  it('should fail when turno does not exist', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);

    const result = await cerrarTurnoAction({ turnoId: 'nonexistent', forzar: false }, mockUser);

    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      expect(result.error.message).toContain('no encontrado');
    }
  });
});
