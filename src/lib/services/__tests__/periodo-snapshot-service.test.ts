/**
 * @description Tests unitarios del SnapshotService para períodos contables.
 *
 * Cubre: generación de snapshots (caja y devengo), verificación de integridad,
 * y obtención del último snapshot.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock de Prisma ────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    periodoContable: {
      findUnique: vi.fn(),
    },
    cuentaBancaria: {
      findMany: vi.fn(),
    },
    saldoSnapshot: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    reconciliacionVenta: {
      aggregate: vi.fn(),
    },
    reconciliacionServicio: {
      aggregate: vi.fn(),
    },
    reconciliacionGasto: {
      aggregate: vi.fn(),
    },
    ajusteBancario: {
      aggregate: vi.fn(),
    },
    transferenciaBancaria: {
      aggregate: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// ── Imports bajo test ─────────────────────────────────────────────────────

import { SnapshotService } from '@/lib/services/periodo-snapshot-service';
import { EstadoPeriodo, TipoPeriodo } from '@/lib/services/periodo-contable-types';

// ── Helpers ───────────────────────────────────────────────────────────────

const TENANT = 'tenant-1';
const ACTOR = 'user-1';
const PERIODO_ID = 'p-1';

function makePeriodo(overrides: Record<string, unknown> = {}) {
  return {
    periodoId: PERIODO_ID,
    tenantId: TENANT,
    tipo: TipoPeriodo.MENSUAL,
    fechaInicio: new Date('2026-03-01T00:00:00Z'),
    fechaFin: new Date('2026-03-31T23:59:59Z'),
    estado: EstadoPeriodo.ABIERTO,
    motivoReapertura: null,
    cerradoPor: null,
    cerradoAt: null,
    aprobadoPor: null,
    aprobadoAt: null,
    observaciones: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCuenta(overrides: Record<string, unknown> = {}) {
  return {
    cuentaId: 'cuenta-1',
    tenantId: TENANT,
    nombreBanco: 'Banco Nacional',
    numeroCuenta: '1234567890',
    tipoCuenta: 'corriente',
    saldo: 50000,
    moneda: 'ARS',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function resetMocks() {
  vi.clearAllMocks();
}

// ── Tests: generarSnapshot (caja) ─────────────────────────────────────────

describe('generarSnapshot — tipo caja', () => {
  beforeEach(resetMocks);

  it('genera snapshot por cada cuenta activa del tenant', async () => {
    const periodo = makePeriodo();
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);

    const cuentas = [makeCuenta(), makeCuenta({ cuentaId: 'cuenta-2', moneda: 'USD' })];
    mockPrisma.cuentaBancaria.findMany.mockResolvedValue(cuentas);

    // Todas las agregaciones retornan null (sin movimientos)
    const nullAgg = { _sum: { montoConvertido: null, montoOrigen: null, montoDestino: null } };
    mockPrisma.reconciliacionVenta.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.reconciliacionServicio.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.reconciliacionGasto.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.ajusteBancario.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.transferenciaBancaria.aggregate.mockResolvedValue({ _sum: { montoOrigen: null, montoDestino: null } });

    mockPrisma.saldoSnapshot.create.mockResolvedValue({
      snapshotId: 'snap-1',
      periodoId: PERIODO_ID,
      cuentaBancariaId: 'cuenta-1',
      saldo: 0,
      moneda: 'ARS',
      metadata: { tipo: 'caja' },
      createdAt: new Date(),
    });

    const service = new SnapshotService();
    const result = await service.generarSnapshot(PERIODO_ID, 'caja', ACTOR);

    expect(result).toHaveLength(2);
    expect(mockPrisma.saldoSnapshot.create).toHaveBeenCalledTimes(2);

    // Verificar que usó fechaReconciliacion (caja)
    const callArgs = mockPrisma.reconciliacionVenta.aggregate.mock.calls[0][0];
    expect(callArgs.where.fechaReconciliacion).toBeDefined();
    expect(callArgs.where.createdAt).toBeUndefined();
  });

  it('calcula saldo correctamente con ingresos y egresos', async () => {
    const periodo = makePeriodo();
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.cuentaBancaria.findMany.mockResolvedValue([makeCuenta()]);

    // Ventas: $30,000
    mockPrisma.reconciliacionVenta.aggregate.mockResolvedValue({ _sum: { montoConvertido: 30000 } });
    // Servicios: $20,000
    mockPrisma.reconciliacionServicio.aggregate.mockResolvedValue({ _sum: { montoConvertido: 20000 } });
    // Gastos: $15,000
    mockPrisma.reconciliacionGasto.aggregate.mockResolvedValue({ _sum: { montoConvertido: 15000 } });
    // Ajustes: $5,000
    mockPrisma.ajusteBancario.aggregate.mockResolvedValue({ _sum: { montoConvertido: 5000 } });
    // Transferencias: $10,000 salientes, $8,000 entrantes
    mockPrisma.transferenciaBancaria.aggregate
      .mockResolvedValueOnce({ _sum: { montoOrigen: 10000 } }) // origen
      .mockResolvedValueOnce({ _sum: { montoDestino: 8000 } }); // destino

    mockPrisma.saldoSnapshot.create.mockResolvedValue({
      snapshotId: 'snap-1',
      periodoId: PERIODO_ID,
      cuentaBancariaId: 'cuenta-1',
      saldo: 38000, // 30000 + 20000 - 15000 + 5000 - 10000 + 8000
      moneda: 'ARS',
      metadata: { tipo: 'caja' },
      createdAt: new Date(),
    });

    const service = new SnapshotService();
    const result = await service.generarSnapshot(PERIODO_ID, 'caja', ACTOR);

    expect(result).toHaveLength(1);
    expect(mockPrisma.saldoSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        periodoId: PERIODO_ID,
        cuentaBancariaId: 'cuenta-1',
        saldo: 38000,
        moneda: 'ARS',
      }),
    });
  });

  it('no genera snapshots para cuentas inactivas', async () => {
    const periodo = makePeriodo();
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);

    // Solo cuentas activas
    mockPrisma.cuentaBancaria.findMany.mockResolvedValue([]);

    const service = new SnapshotService();
    const result = await service.generarSnapshot(PERIODO_ID, 'caja', ACTOR);

    expect(result).toHaveLength(0);
    expect(mockPrisma.saldoSnapshot.create).not.toHaveBeenCalled();
  });

  it('lanza error si el período no existe', async () => {
    mockPrisma.periodoContable.findUnique.mockResolvedValue(null);

    const service = new SnapshotService();

    await expect(service.generarSnapshot('no-existe', 'caja', ACTOR))
      .rejects.toThrow('Período no encontrado');
  });
});

// ── Tests: generarSnapshot (devengo) ──────────────────────────────────────

describe('generarSnapshot — tipo devengo', () => {
  beforeEach(resetMocks);

  it('usa createdAt para filtrar movimientos', async () => {
    const periodo = makePeriodo();
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.cuentaBancaria.findMany.mockResolvedValue([makeCuenta()]);

    mockPrisma.reconciliacionVenta.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.reconciliacionServicio.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.reconciliacionGasto.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.ajusteBancario.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.transferenciaBancaria.aggregate.mockResolvedValue({ _sum: { montoOrigen: null, montoDestino: null } });

    mockPrisma.saldoSnapshot.create.mockResolvedValue({
      snapshotId: 'snap-1',
      periodoId: PERIODO_ID,
      cuentaBancariaId: 'cuenta-1',
      saldo: 0,
      moneda: 'ARS',
      metadata: { tipo: 'devengo' },
      createdAt: new Date(),
    });

    const service = new SnapshotService();
    await service.generarSnapshot(PERIODO_ID, 'devengo', ACTOR);

    // Verificar que usó createdAt (devengo)
    const callArgs = mockPrisma.reconciliacionVenta.aggregate.mock.calls[0][0];
    expect(callArgs.where.createdAt).toBeDefined();
    expect(callArgs.where.fechaReconciliacion).toBeUndefined();
  });

  it('incluye tipo devengo en metadata del snapshot', async () => {
    const periodo = makePeriodo();
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.cuentaBancaria.findMany.mockResolvedValue([makeCuenta()]);

    mockPrisma.reconciliacionVenta.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.reconciliacionServicio.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.reconciliacionGasto.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.ajusteBancario.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
    mockPrisma.transferenciaBancaria.aggregate.mockResolvedValue({ _sum: { montoOrigen: null, montoDestino: null } });

    mockPrisma.saldoSnapshot.create.mockResolvedValue({
      snapshotId: 'snap-1',
      periodoId: PERIODO_ID,
      cuentaBancariaId: 'cuenta-1',
      saldo: 0,
      moneda: 'ARS',
      metadata: { tipo: 'devengo' },
      createdAt: new Date(),
    });

    const service = new SnapshotService();
    await service.generarSnapshot(PERIODO_ID, 'devengo', ACTOR);

    const createCall = mockPrisma.saldoSnapshot.create.mock.calls[0][0];
    expect(createCall.data.metadata).toMatchObject({ tipo: 'devengo' });
  });
});

// ── Tests: verificarIntegridad ────────────────────────────────────────────

describe('verificarIntegridad', () => {
  beforeEach(resetMocks);

  it('retorna true si el saldo coincide', async () => {
    const periodo = makePeriodo();
    mockPrisma.saldoSnapshot.findUnique.mockResolvedValue({
      snapshotId: 'snap-1',
      periodoId: PERIODO_ID,
      cuentaBancariaId: 'cuenta-1',
      saldo: 38000,
      moneda: 'ARS',
      metadata: { tipo: 'caja' },
      createdAt: new Date(),
      periodo,
    });

    // El cálculo actual da el mismo resultado
    mockPrisma.reconciliacionVenta.aggregate.mockResolvedValue({ _sum: { montoConvertido: 30000 } });
    mockPrisma.reconciliacionServicio.aggregate.mockResolvedValue({ _sum: { montoConvertido: 20000 } });
    mockPrisma.reconciliacionGasto.aggregate.mockResolvedValue({ _sum: { montoConvertido: 15000 } });
    mockPrisma.ajusteBancario.aggregate.mockResolvedValue({ _sum: { montoConvertido: 5000 } });
    mockPrisma.transferenciaBancaria.aggregate
      .mockResolvedValueOnce({ _sum: { montoOrigen: 10000 } })
      .mockResolvedValueOnce({ _sum: { montoDestino: 8000 } });

    const service = new SnapshotService();
    const result = await service.verificarIntegridad('snap-1');

    expect(result).toBe(true);
  });

  it('retorna false si el snapshot no existe', async () => {
    mockPrisma.saldoSnapshot.findUnique.mockResolvedValue(null);

    const service = new SnapshotService();
    const result = await service.verificarIntegridad('no-existe');

    expect(result).toBe(false);
  });

  it('retorna false si el saldo fue modificado', async () => {
    const periodo = makePeriodo();
    mockPrisma.saldoSnapshot.findUnique.mockResolvedValue({
      snapshotId: 'snap-1',
      periodoId: PERIODO_ID,
      cuentaBancariaId: 'cuenta-1',
      saldo: 38000, // Snapshot dice 38000
      moneda: 'ARS',
      metadata: { tipo: 'caja' },
      createdAt: new Date(),
      periodo,
    });

    // Pero el cálculo actual da un valor diferente
    mockPrisma.reconciliacionVenta.aggregate.mockResolvedValue({ _sum: { montoConvertido: 50000 } });
    mockPrisma.reconciliacionServicio.aggregate.mockResolvedValue({ _sum: { montoConvertido: 0 } });
    mockPrisma.reconciliacionGasto.aggregate.mockResolvedValue({ _sum: { montoConvertido: 0 } });
    mockPrisma.ajusteBancario.aggregate.mockResolvedValue({ _sum: { montoConvertido: 0 } });
    mockPrisma.transferenciaBancaria.aggregate
      .mockResolvedValueOnce({ _sum: { montoOrigen: null } })
      .mockResolvedValueOnce({ _sum: { montoDestino: null } });

    const service = new SnapshotService();
    const result = await service.verificarIntegridad('snap-1');

    expect(result).toBe(false);
  });
});

// ── Tests: obtenerUltimoSnapshot ──────────────────────────────────────────

describe('obtenerUltimoSnapshot', () => {
  beforeEach(resetMocks);

  it('retorna el último snapshot del tipo solicitado', async () => {
    const snapshots = [
      { snapshotId: 'snap-2', periodoId: PERIODO_ID, metadata: { tipo: 'devengo' }, createdAt: new Date('2026-03-31') },
      { snapshotId: 'snap-1', periodoId: PERIODO_ID, metadata: { tipo: 'caja' }, createdAt: new Date('2026-03-30') },
    ];
    mockPrisma.saldoSnapshot.findMany.mockResolvedValue(snapshots);

    const service = new SnapshotService();
    const result = await service.obtenerUltimoSnapshot(PERIODO_ID, 'devengo');

    expect(result?.snapshotId).toBe('snap-2');
  });

  it('retorna null si no hay snapshot del tipo solicitado', async () => {
    mockPrisma.saldoSnapshot.findMany.mockResolvedValue([
      { snapshotId: 'snap-1', periodoId: PERIODO_ID, metadata: { tipo: 'caja' }, createdAt: new Date() },
    ]);

    const service = new SnapshotService();
    const result = await service.obtenerUltimoSnapshot(PERIODO_ID, 'devengo');

    expect(result).toBeNull();
  });

  it('retorna null si no hay snapshots del período', async () => {
    mockPrisma.saldoSnapshot.findMany.mockResolvedValue([]);

    const service = new SnapshotService();
    const result = await service.obtenerUltimoSnapshot(PERIODO_ID, 'caja');

    expect(result).toBeNull();
  });
});
