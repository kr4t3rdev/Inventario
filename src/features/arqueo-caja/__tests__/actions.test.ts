/**
 * @description Tests para las Server Actions de Arqueo de Caja.
 *
 * Patrón: mock de prisma y requireTenant, llamada directa a la action
 * con un mock de AuthenticatedUser.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockPrisma = vi.hoisted(() => ({
  turnoPuntoVenta: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  arqueoCaja: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn((fn: any) => fn(mockPrisma)),
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

import { getEsperadosArqueoAction, realizarArqueoAction } from '../actions';

function buildTurno(overrides: Record<string, unknown> = {}) {
  return {
    id: 'turno-1',
    tenantId: 'tenant-mock-1',
    puntoDeVentaId: 'pv-1',
    empleadoId: null,
    estado: 'ABIERTO',
    fondoInicialCup: 50000,
    fondoInicialUsd: 0,
    arqueo: null,
    ventas: [
      { metodoPago: 'EFECTIVO', montoEfectivo: 100000, montoTarjeta: 0, montoTransferencia: 0, montoCredito: 0, total: 100000 },
      { metodoPago: 'TARJETA', montoEfectivo: 0, montoTarjeta: 50000, montoTransferencia: 0, montoCredito: 0, total: 50000 },
    ],
    ...overrides,
  };
}

// ─── Suite: getEsperadosArqueoAction ─────────────────────────────────

describe('getEsperadosArqueoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate expected values from turno', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(buildTurno());

    const result = await getEsperadosArqueoAction('turno-1', mockUser);

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.esperadoEfectivoCup).toBe(150000); // fondo 50000 + ventas EFECTIVO 100000
      expect(result.data.esperadoTarjeta).toBe(50000);
      expect(result.data.esperadoEfectivoUsd).toBe(0);
    }
  });

  it('should fail if turno does not exist', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);

    const result = await getEsperadosArqueoAction('nonexistent', mockUser);

    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      expect(result.error.message).toContain('no encontrado');
    }
  });
});

// ─── Suite: realizarArqueoAction ─────────────────────────────────────

describe('realizarArqueoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should succeed when contado = esperado (diferencia 0)', async () => {
    // Turno: fondo 50000 + venta EFECTIVO 100000 => esperado 150000
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(buildTurno());
    mockPrisma.arqueoCaja.create.mockResolvedValue({ id: 'arqueo-1' });
    mockPrisma.turnoPuntoVenta.update.mockResolvedValue({});

    // Contar 1 billete de $1000 (100000) + 1 billete de $500 (50000) = 150000
    const result = await realizarArqueoAction({
      turnoId: 'turno-1',
      billetes1000Cup: 1,
      billetes500Cup: 1,
      billetes200Cup: 0,
      billetes100Cup: 0,
      billetes50Cup: 0,
      billetes20Cup: 0,
      monedasCup: 0,
      billetes100Usd: 0,
      billetes50Usd: 0,
      billetes20Usd: 0,
      billetes10Usd: 0,
      billetes5Usd: 0,
      billetes1Usd: 0,
      monedasUsd: 0,
      totalTarjeta: 50000,
      totalTransferencia: 0,
      totalCredito: 0,
    }, mockUser);

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.diferencias.cup).toBe(0);
    }
  });

  it('should detect faltante when contado < esperado', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(buildTurno());
    mockPrisma.arqueoCaja.create.mockResolvedValue({ id: 'arqueo-1' });
    mockPrisma.turnoPuntoVenta.update.mockResolvedValue({});

    // Contar solo 1 billete de $1000 (100000) = faltante de 50000
    const result = await realizarArqueoAction({
      turnoId: 'turno-1',
      billetes1000Cup: 1,
      billetes500Cup: 0,
      billetes200Cup: 0,
      billetes100Cup: 0,
      billetes50Cup: 0,
      billetes20Cup: 0,
      monedasCup: 0,
      billetes100Usd: 0,
      billetes50Usd: 0,
      billetes20Usd: 0,
      billetes10Usd: 0,
      billetes5Usd: 0,
      billetes1Usd: 0,
      monedasUsd: 0,
      totalTarjeta: 50000,
      totalTransferencia: 0,
      totalCredito: 0,
    }, mockUser);

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.diferencias.cup).toBeLessThan(0);
      expect(result.data.diferencias.cup).toBe(-50000);
    }
  });

  it('should detect sobrante when contado > esperado', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(buildTurno());
    mockPrisma.arqueoCaja.create.mockResolvedValue({ id: 'arqueo-1' });
    mockPrisma.turnoPuntoVenta.update.mockResolvedValue({});

    // Contar 2 billetes de $1000 (200000) = sobrante de 50000
    const result = await realizarArqueoAction({
      turnoId: 'turno-1',
      billetes1000Cup: 2,
      billetes500Cup: 0,
      billetes200Cup: 0,
      billetes100Cup: 0,
      billetes50Cup: 0,
      billetes20Cup: 0,
      monedasCup: 0,
      billetes100Usd: 0,
      billetes50Usd: 0,
      billetes20Usd: 0,
      billetes10Usd: 0,
      billetes5Usd: 0,
      billetes1Usd: 0,
      monedasUsd: 0,
      totalTarjeta: 50000,
      totalTransferencia: 0,
      totalCredito: 0,
    }, mockUser);

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.diferencias.cup).toBeGreaterThan(0);
      expect(result.data.diferencias.cup).toBe(50000);
    }
  });

  it('should fail when turno does not exist', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);

    const result = await realizarArqueoAction({
      turnoId: 'nonexistent',
      billetes1000Cup: 1,
      billetes500Cup: 0,
      billetes200Cup: 0,
      billetes100Cup: 0,
      billetes50Cup: 0,
      billetes20Cup: 0,
      monedasCup: 0,
      billetes100Usd: 0,
      billetes50Usd: 0,
      billetes20Usd: 0,
      billetes10Usd: 0,
      billetes5Usd: 0,
      billetes1Usd: 0,
      monedasUsd: 0,
      totalTarjeta: 0,
      totalTransferencia: 0,
      totalCredito: 0,
    }, mockUser);

    expect(result.success).toBe(false);
  });

  it('should fail when turno is already closed', async () => {
    mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(
      buildTurno({ estado: 'CERRADO' }),
    );

    const result = await realizarArqueoAction({
      turnoId: 'turno-1',
      billetes1000Cup: 1,
      billetes500Cup: 0,
      billetes200Cup: 0,
      billetes100Cup: 0,
      billetes50Cup: 0,
      billetes20Cup: 0,
      monedasCup: 0,
      billetes100Usd: 0,
      billetes50Usd: 0,
      billetes20Usd: 0,
      billetes10Usd: 0,
      billetes5Usd: 0,
      billetes1Usd: 0,
      monedasUsd: 0,
      totalTarjeta: 0,
      totalTransferencia: 0,
      totalCredito: 0,
    }, mockUser);

    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      expect(result.error.message).toContain('cerrado');
      expect(result.error.code).toBe('CONFLICT');
    }
  });
});
