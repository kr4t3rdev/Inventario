/**
 * @description Tests de integración para las Server Actions de períodos contables.
 *
 * Cubre: listar períodos, abrir, cerrar, reabrir, aprobar y obtener timeline.
 * Usa mocks de Prisma, getCurrentUser y revalidatePath.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks (antes de los imports) ──────────────────────────────────────────

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    periodoContable: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditoriaPeriodo: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    saldoSnapshot: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    cuentaBancaria: {
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

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  listarPeriodosAction,
  obtenerPeriodoAction,
  obtenerTimelineAction,
  abrirPeriodoAction,
  cerrarPeriodoAction,
  reabrirPeriodoAction,
  aprobarPeriodoAction,
} from '@/features/contabilidad/actions-periodos';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { EstadoPeriodo, TipoPeriodo, EventoAuditoria } from '@/lib/services/periodo-contable-types';

// ── Helpers ───────────────────────────────────────────────────────────────

const TENANT = 'tenant-1';
const ACTOR = 'user-1';

const mockUser: AuthenticatedUser = {
  userId: ACTOR,
  name: 'Test User',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: TENANT,
  tenantRole: 'admin',
};

function makePeriodo(overrides: Record<string, unknown> = {}) {
  return {
    periodoId: 'p-1',
    tenantId: TENANT,
    tipo: TipoPeriodo.MENSUAL,
    fechaInicio: new Date('2026-03-01T00:00:00Z'),
    fechaFin: new Date('2026-03-31T23:59:59Z'),
    estado: EstadoPeriodo.BORRADOR,
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

function resetMocks() {
  vi.clearAllMocks();
}

// ── Setup común ───────────────────────────────────────────────────────────

beforeEach(() => {
  resetMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
});

// ── Tests: listarPeriodosAction ───────────────────────────────────────────

describe('listarPeriodosAction', () => {
  it('retorna lista vacía cuando no hay períodos', async () => {
    mockPrisma.periodoContable.findMany.mockResolvedValue([]);
    mockPrisma.periodoContable.count.mockResolvedValue(0);

    const result = await listarPeriodosAction();

    expect(result.success).toBe(true);
    expect(result.data?.periodos).toEqual([]);
    expect(result.data?.pagination.total).toBe(0);
  });

  it('retorna períodos del tenant con paginación', async () => {
    const periodos = [
      makePeriodo({ periodoId: 'p-1', tipo: TipoPeriodo.MENSUAL, estado: EstadoPeriodo.ABIERTO }),
      makePeriodo({ periodoId: 'p-2', tipo: TipoPeriodo.DIARIO, estado: EstadoPeriodo.CERRADO }),
    ];
    mockPrisma.periodoContable.findMany.mockResolvedValue(periodos);
    mockPrisma.periodoContable.count.mockResolvedValue(2);

    const result = await listarPeriodosAction({ page: 1, limit: 10 });

    expect(result.success).toBe(true);
    expect(result.data?.periodos).toHaveLength(2);
    expect(result.data?.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
  });

  it('filtra por tipo de período', async () => {
    mockPrisma.periodoContable.findMany.mockResolvedValue([]);
    mockPrisma.periodoContable.count.mockResolvedValue(0);

    await listarPeriodosAction({ tipo: TipoPeriodo.DIARIO });

    expect(mockPrisma.periodoContable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT,
          tipo: TipoPeriodo.DIARIO,
        }),
      }),
    );
  });

  it('filtra por estado de período', async () => {
    mockPrisma.periodoContable.findMany.mockResolvedValue([]);
    mockPrisma.periodoContable.count.mockResolvedValue(0);

    await listarPeriodosAction({ estado: EstadoPeriodo.ABIERTO });

    expect(mockPrisma.periodoContable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT,
          estado: EstadoPeriodo.ABIERTO,
        }),
      }),
    );
  });

  it('falla si el usuario no está autenticado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await listarPeriodosAction();

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('AUTH_REQUIRED');
  });
});

// ── Tests: obtenerPeriodoAction ───────────────────────────────────────────

describe('obtenerPeriodoAction', () => {
  it('retorna detalle del período con timeline', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.ABIERTO });
    mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
    mockPrisma.auditoriaPeriodo.findMany.mockResolvedValue([]);

    const result = await obtenerPeriodoAction('p-1');

    expect(result.success).toBe(true);
    expect(result.data?.periodo.periodoId).toBe('p-1');
    expect(result.data?.timeline).toBeDefined();
  });

  it('falla si el período no existe', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const result = await obtenerPeriodoAction('p-no-existe');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('falla si el período no pertenece al tenant', async () => {
    // findFirst con where { periodoId, tenantId } no encuentra períodos de otro tenant
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const result = await obtenerPeriodoAction('p-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});

// ── Tests: obtenerTimelineAction ──────────────────────────────────────────

describe('obtenerTimelineAction', () => {
  it('retorna timeline de eventos de auditoría', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue({ periodoId: 'p-1' });
    mockPrisma.auditoriaPeriodo.findMany.mockResolvedValue([
      {
        auditoriaId: 'a-1',
        periodoId: 'p-1',
        evento: EventoAuditoria.APERTURA,
        actor: ACTOR,
        timestamp: new Date('2026-03-01'),
        motivo: null,
        payload: null,
        entidadAfectada: null,
        createdAt: new Date('2026-03-01'),
      },
      {
        auditoriaId: 'a-2',
        periodoId: 'p-1',
        evento: EventoAuditoria.CIERRE,
        actor: ACTOR,
        timestamp: new Date('2026-03-31'),
        motivo: null,
        payload: null,
        entidadAfectada: null,
        createdAt: new Date('2026-03-31'),
      },
    ]);

    const result = await obtenerTimelineAction('p-1');

    expect(result.success).toBe(true);
    expect(result.data?.timeline).toHaveLength(2);
    expect(result.data?.timeline[0].evento).toBe(EventoAuditoria.APERTURA);
    expect(result.data?.timeline[1].evento).toBe(EventoAuditoria.CIERRE);
  });

  it('falla si el período no existe', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const result = await obtenerTimelineAction('p-no-existe');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});

// ── Tests: abrirPeriodoAction ─────────────────────────────────────────────

describe('abrirPeriodoAction', () => {
  it('abre un período mensual exitosamente', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(0); // sin solapamiento
    mockPrisma.periodoContable.create.mockResolvedValue(
      makePeriodo({
        tipo: TipoPeriodo.MENSUAL,
        estado: EstadoPeriodo.ABIERTO,
        fechaInicio: new Date('2026-03-01'),
        fechaFin: new Date('2026-03-31'),
      }),
    );
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    const result = await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: '2026-03-01T00:00:00Z',
      fechaFin: '2026-03-31T23:59:59Z',
    });

    expect(result.success).toBe(true);
    expect(result.data?.periodo.estado).toBe(EstadoPeriodo.ABIERTO);
    expect(result.data?.periodo.tipo).toBe(TipoPeriodo.MENSUAL);
    expect(revalidatePath).toHaveBeenCalledWith('/busy/contabilidad/periodos');
  });

  it('abre un período diario exitosamente', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(0);
    mockPrisma.periodoContable.create.mockResolvedValue(
      makePeriodo({
        tipo: TipoPeriodo.DIARIO,
        estado: EstadoPeriodo.ABIERTO,
        fechaInicio: new Date('2026-03-15'),
        fechaFin: new Date('2026-03-15'),
      }),
    );
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    const result = await abrirPeriodoAction({
      tipo: TipoPeriodo.DIARIO,
      fechaInicio: '2026-03-15T00:00:00Z',
      fechaFin: '2026-03-15T23:59:59Z',
    });

    expect(result.success).toBe(true);
    expect(result.data?.periodo.tipo).toBe(TipoPeriodo.DIARIO);
  });

  it('abre un período anual exitosamente', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(0);
    mockPrisma.periodoContable.create.mockResolvedValue(
      makePeriodo({
        tipo: TipoPeriodo.ANUAL,
        estado: EstadoPeriodo.ABIERTO,
        fechaInicio: new Date('2026-01-01'),
        fechaFin: new Date('2026-12-31'),
      }),
    );
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    const result = await abrirPeriodoAction({
      tipo: TipoPeriodo.ANUAL,
      fechaInicio: '2026-01-01T00:00:00Z',
      fechaFin: '2026-12-31T23:59:59Z',
    });

    expect(result.success).toBe(true);
    expect(result.data?.periodo.tipo).toBe(TipoPeriodo.ANUAL);
  });

  it('falla con fechas inválidas (inicio posterior a fin)', async () => {
    const result = await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: '2026-04-01T00:00:00Z',
      fechaFin: '2026-03-01T00:00:00Z',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FECHAS_INVALIDAS');
    expect(mockPrisma.periodoContable.create).not.toHaveBeenCalled();
  });

  it('falla con fecha de inicio inválida (Zod)', async () => {
    const result = await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: 'no-es-fecha',
      fechaFin: '2026-03-31T23:59:59Z',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('falla con fecha de fin inválida (Zod)', async () => {
    const result = await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: '2026-03-01T00:00:00Z',
      fechaFin: 'tampoco-es-fecha',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('falla si hay solapamiento de fechas', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(1); // ya existe solapado

    const result = await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: '2026-03-01T00:00:00Z',
      fechaFin: '2026-03-31T23:59:59Z',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PERIODO_SOLAPADO');
    expect(mockPrisma.periodoContable.create).not.toHaveBeenCalled();
  });

  it('invalida el caché del guard después de abrir', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(0);
    mockPrisma.periodoContable.create.mockResolvedValue(
      makePeriodo({ estado: EstadoPeriodo.ABIERTO }),
    );
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: '2026-03-01T00:00:00Z',
      fechaFin: '2026-03-31T23:59:59Z',
    });

    // invalidateCache se llama internamente; verificamos revalidatePath
    expect(revalidatePath).toHaveBeenCalledWith('/busy/contabilidad/periodos');
  });
});

// ── Tests: cerrarPeriodoAction ────────────────────────────────────────────

describe('cerrarPeriodoAction', () => {
  it('cierra un período exitosamente con snapshot', async () => {
    const periodo = makePeriodo({
      tipo: TipoPeriodo.DIARIO,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-03-15'),
      fechaFin: new Date('2026-03-15'),
    });
    mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.periodoContable.update.mockResolvedValue({
      ...periodo,
      estado: EstadoPeriodo.CERRADO,
      cerradoPor: ACTOR,
      cerradoAt: new Date(),
    });
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
    mockPrisma.cuentaBancaria.findMany.mockResolvedValue([]); // sin cuentas → 0 snapshots

    const result = await cerrarPeriodoAction({ periodoId: 'p-1' });

    expect(result.success).toBe(true);
    expect(result.data?.periodo.estado).toBe(EstadoPeriodo.CERRADO);
    expect(result.data?.snapshots).toBe(0);
    expect(revalidatePath).toHaveBeenCalledWith('/busy/contabilidad/periodos');
  });

  it('falla si el período no existe', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const result = await cerrarPeriodoAction({ periodoId: 'p-no-existe' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('falla si el período no pertenece al tenant', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const result = await cerrarPeriodoAction({ periodoId: 'p-1' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('falla si la transición no es válida', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.CERRADO });
    mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);

    const result = await cerrarPeriodoAction({ periodoId: 'p-1' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TRANSICION_INVALIDA');
  });

  it('falla si tiene hijos abiertos', async () => {
    const periodo = makePeriodo({
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
    });
    mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.periodoContable.count.mockResolvedValue(2); // 2 hijos abiertos

    const result = await cerrarPeriodoAction({ periodoId: 'p-1' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HIJOS_ABIERTOS');
    expect(mockPrisma.periodoContable.update).not.toHaveBeenCalled();
  });
});

// ── Tests: reabrirPeriodoAction ───────────────────────────────────────────

describe('reabrirPeriodoAction', () => {
  it('falla sin motivo (Zod min 10 chars)', async () => {
    const result = await reabrirPeriodoAction({
      periodoId: 'p-1',
      motivo: 'corto',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('falla con motivo vacío', async () => {
    const result = await reabrirPeriodoAction({
      periodoId: 'p-1',
      motivo: '',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('reabre un período APROBADO exitosamente', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.APROBADO });
    mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.periodoContable.update.mockResolvedValue({
      ...periodo,
      estado: EstadoPeriodo.REABIERTO,
      motivoReapertura: 'Error en conciliación de saldos del mes de marzo',
    });
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    const result = await reabrirPeriodoAction({
      periodoId: 'p-1',
      motivo: 'Error en conciliación de saldos del mes de marzo',
    });

    expect(result.success).toBe(true);
    expect(result.data?.periodo.estado).toBe(EstadoPeriodo.REABIERTO);
    expect(result.data?.periodo.motivoReapertura).toBe('Error en conciliación de saldos del mes de marzo');
    expect(revalidatePath).toHaveBeenCalledWith('/busy/contabilidad/periodos');
  });

  it('falla si el período no existe', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const result = await reabrirPeriodoAction({
      periodoId: 'p-no-existe',
      motivo: 'Error en conciliación de saldos del mes de marzo',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('falla si la transición no es válida (período no APROBADO)', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.ABIERTO });
    mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);

    const result = await reabrirPeriodoAction({
      periodoId: 'p-1',
      motivo: 'Error en conciliación de saldos del mes de marzo',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TRANSICION_INVALIDA');
  });
});

// ── Tests: aprobarPeriodoAction ───────────────────────────────────────────

describe('aprobarPeriodoAction', () => {
  it('aprueba un período CERRADO exitosamente', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.CERRADO });
    mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.periodoContable.update.mockResolvedValue({
      ...periodo,
      estado: EstadoPeriodo.APROBADO,
      aprobadoPor: ACTOR,
      aprobadoAt: new Date(),
    });
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    const result = await aprobarPeriodoAction({ periodoId: 'p-1' });

    expect(result.success).toBe(true);
    expect(result.data?.periodo.estado).toBe(EstadoPeriodo.APROBADO);
    expect(result.data?.periodo.aprobadoPor).toBe(ACTOR);
    expect(revalidatePath).toHaveBeenCalledWith('/busy/contabilidad/periodos');
  });

  it('falla si el período no existe', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const result = await aprobarPeriodoAction({ periodoId: 'p-no-existe' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('falla si la transición no es válida (período no CERRADO)', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.ABIERTO });
    mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);

    const result = await aprobarPeriodoAction({ periodoId: 'p-1' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TRANSICION_INVALIDA');
  });
});
