/**
 * @description Tests unitarios del servicio de dominio de períodos contables.
 *
 * Cubre: transiciones de estado, solapamiento, resolución jerárquica,
 * apertura, cierre, reapertura, aprobación y validación de escritura.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock de Prisma (usando vi.hoisted para evitar problemas de hoisting) ──

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
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// ── Imports bajo test ─────────────────────────────────────────────────────

import {
  PeriodoContableService,
  PeriodoError,
} from '@/lib/services/periodo-contable-service';
import {
  EstadoPeriodo,
  TipoPeriodo,
  EventoAuditoria,
  WRITABLE_STATES,
  VALID_TRANSITIONS,
  generarLabelPeriodo,
  toResumen,
  getGuardConfig,
} from '@/lib/services/periodo-contable-types';
import { ActionError } from '@/lib/server-actions/types';

// ── Helpers ───────────────────────────────────────────────────────────────

const TENANT = 'tenant-1';
const ACTOR = 'user-1';

function makePeriodo(overrides: Record<string, unknown> = {}) {
  return {
    periodoId: 'p-1',
    tenantId: TENANT,
    tipo: TipoPeriodo.MENSUAL,
    codigo: null,
    fechaInicio: new Date('2026-03-01T00:00:00Z'),
    fechaFin: new Date('2026-03-31T23:59:59Z'),
    estado: EstadoPeriodo.BORRADOR,
    periodoPadreId: null,
    aperturaAutomatica: false,
    categoria: 'ORDINARIO',
    abiertoPorId: null,
    fechaApertura: null,
    motivoReapertura: null,
    cerradoPor: null,
    cerradoAt: null,
    aprobadoPor: null,
    aprobadoAt: null,
    reabiertoPorId: null,
    fechaReapertura: null,
    segundoAprobadorId: null,
    observaciones: null,
    resumenJson: null,
    hashIntegridad: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function resetMocks() {
  vi.clearAllMocks();
}

// ── Tests: validarTransicion (pura, sin DB) ──────────────────────────────

describe('validarTransicion', () => {
  it('acepta BORRADOR → ABIERTO', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.BORRADOR, EstadoPeriodo.ABIERTO)).toBe(true);
  });

  it('acepta ABIERTO → EN_CIERRE', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.ABIERTO, EstadoPeriodo.EN_CIERRE)).toBe(true);
  });

  it('acepta EN_CIERRE → CERRADO', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.EN_CIERRE, EstadoPeriodo.CERRADO)).toBe(true);
  });

  it('acepta CERRADO → APROBADO', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.CERRADO, EstadoPeriodo.APROBADO)).toBe(true);
  });

  it('acepta APROBADO → REABIERTO', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.APROBADO, EstadoPeriodo.REABIERTO)).toBe(true);
  });

  it('acepta REABIERTO → EN_CIERRE', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.REABIERTO, EstadoPeriodo.EN_CIERRE)).toBe(true);
  });

  it('acepta REABIERTO → ABIERTO', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.REABIERTO, EstadoPeriodo.ABIERTO)).toBe(true);
  });

  it('rechaza BORRADOR → CERRADO (salto de estado)', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.BORRADOR, EstadoPeriodo.CERRADO)).toBe(false);
  });

  it('acepta ABIERTO → CERRADO directo (simplificación V1)', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.ABIERTO, EstadoPeriodo.CERRADO)).toBe(true);
  });

  it('rechaza CERRADO → ABIERTO (debe pasar por REABIERTO)', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.CERRADO, EstadoPeriodo.ABIERTO)).toBe(false);
  });

  it('rechaza APROBADO → ABIERTO (debe pasar por REABIERTO)', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.APROBADO, EstadoPeriodo.ABIERTO)).toBe(false);
  });

  it('rechaza cualquier transición a BORRADOR', () => {
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.ABIERTO, EstadoPeriodo.BORRADOR)).toBe(false);
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.CERRADO, EstadoPeriodo.BORRADOR)).toBe(false);
    expect(PeriodoContableService.validarTransicion(EstadoPeriodo.REABIERTO, EstadoPeriodo.BORRADOR)).toBe(false);
  });
});

// ── Tests: verificarSolapamiento ─────────────────────────────────────────

describe('verificarSolapamiento', () => {
  beforeEach(resetMocks);

  it('detecta solapamiento mismo día', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(1);

    const result = await PeriodoContableService.verificarSolapamiento(
      TENANT,
      TipoPeriodo.MENSUAL,
      new Date('2026-03-15'),
      new Date('2026-04-15'),
    );

    expect(result).toBe(true);
    expect(mockPrisma.periodoContable.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: TENANT,
        tipo: TipoPeriodo.MENSUAL,
      }),
    });
  });

  it('detecta solapamiento adyacente', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(1);

    const result = await PeriodoContableService.verificarSolapamiento(
      TENANT,
      TipoPeriodo.MENSUAL,
      new Date('2026-03-01'),
      new Date('2026-03-31'),
    );

    expect(result).toBe(true);
  });

  it('detecta solapamiento parcial', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(1);

    const result = await PeriodoContableService.verificarSolapamiento(
      TENANT,
      TipoPeriodo.MENSUAL,
      new Date('2026-03-20'),
      new Date('2026-04-20'),
    );

    expect(result).toBe(true);
  });

  it('no detecta solapamiento para distinto tenant', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(0);

    const result = await PeriodoContableService.verificarSolapamiento(
      'tenant-2',
      TipoPeriodo.MENSUAL,
      new Date('2026-03-01'),
      new Date('2026-03-31'),
    );

    expect(result).toBe(false);
  });

  it('no detecta solapamiento para distinto tipo', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(0);

    const result = await PeriodoContableService.verificarSolapamiento(
      TENANT,
      TipoPeriodo.DIARIO,
      new Date('2026-03-15'),
      new Date('2026-03-15'),
    );

    expect(result).toBe(false);
  });

  it('excluye período específico cuando se pasa excludePeriodoId', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(0);

    await PeriodoContableService.verificarSolapamiento(
      TENANT,
      TipoPeriodo.MENSUAL,
      new Date('2026-03-01'),
      new Date('2026-03-31'),
      'p-1',
    );

    expect(mockPrisma.periodoContable.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        periodoId: { not: 'p-1' },
      }),
    });
  });
});

// ── Tests: abrirPeriodo ──────────────────────────────────────────────────

describe('abrirPeriodo', () => {
  beforeEach(resetMocks);

  it('crea período diario en estado ABIERTO', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(0);
    mockPrisma.periodoContable.create.mockResolvedValue(makePeriodo({
      tipo: TipoPeriodo.DIARIO,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-03-15'),
      fechaFin: new Date('2026-03-15'),
    }));
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    const result = await PeriodoContableService.abrirPeriodo({
      tenantId: TENANT,
      tipo: TipoPeriodo.DIARIO,
      fechaInicio: new Date('2026-03-15'),
      fechaFin: new Date('2026-03-15'),
    }, ACTOR);

    expect(result.estado).toBe(EstadoPeriodo.ABIERTO);
    expect(result.tipo).toBe(TipoPeriodo.DIARIO);
  });

  it('crea período mensual en estado ABIERTO', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(0);
    mockPrisma.periodoContable.create.mockResolvedValue(makePeriodo({
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
    }));
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    const result = await PeriodoContableService.abrirPeriodo({
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-03-31'),
    }, ACTOR);

    expect(result.estado).toBe(EstadoPeriodo.ABIERTO);
    expect(result.tipo).toBe(TipoPeriodo.MENSUAL);
  });

  it('crea período anual en estado ABIERTO', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(0);
    mockPrisma.periodoContable.create.mockResolvedValue(makePeriodo({
      tipo: TipoPeriodo.ANUAL,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2026-12-31'),
    }));
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    const result = await PeriodoContableService.abrirPeriodo({
      tenantId: TENANT,
      tipo: TipoPeriodo.ANUAL,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2026-12-31'),
    }, ACTOR);

    expect(result.estado).toBe(EstadoPeriodo.ABIERTO);
    expect(result.tipo).toBe(TipoPeriodo.ANUAL);
  });

  it('rechaza si hay solapamiento', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(1);

    await expect(PeriodoContableService.abrirPeriodo({
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-03-31'),
    }, ACTOR)).rejects.toThrow(PeriodoError);

    await expect(PeriodoContableService.abrirPeriodo({
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-03-31'),
    }, ACTOR)).rejects.toMatchObject({ code: 'PERIODO_SOLAPADO' });

    expect(mockPrisma.periodoContable.create).not.toHaveBeenCalled();
  });

  it('registra auditoría APERTURA', async () => {
    mockPrisma.periodoContable.count.mockResolvedValue(0);
    mockPrisma.periodoContable.create.mockResolvedValue(makePeriodo({
      estado: EstadoPeriodo.ABIERTO,
    }));
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    await PeriodoContableService.abrirPeriodo({
      tenantId: TENANT,
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: new Date('2026-03-01'),
      fechaFin: new Date('2026-03-31'),
    }, ACTOR);

    expect(mockPrisma.auditoriaPeriodo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evento: EventoAuditoria.APERTURA,
        actor: ACTOR,
      }),
    });
  });
});

// ── Tests: cerrarPeriodo ─────────────────────────────────────────────────

describe('cerrarPeriodo', () => {
  beforeEach(resetMocks);

  it('cierra período diario exitosamente', async () => {
    const periodo = makePeriodo({
      tipo: TipoPeriodo.DIARIO,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-03-15'),
      fechaFin: new Date('2026-03-15'),
    });
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.periodoContable.update.mockResolvedValue({
      ...periodo,
      estado: EstadoPeriodo.CERRADO,
      cerradoPor: ACTOR,
      cerradoAt: expect.any(Date),
    });
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    const result = await PeriodoContableService.cerrarPeriodo('p-1', ACTOR);

    expect(result.estado).toBe(EstadoPeriodo.CERRADO);
    expect(result.cerradoPor).toBe(ACTOR);
  });

  it('rechaza si el período no existe', async () => {
    mockPrisma.periodoContable.findUnique.mockResolvedValue(null);

    await expect(PeriodoContableService.cerrarPeriodo('p-no-existe', ACTOR))
      .rejects.toThrow(ActionError);
  });

  it('rechaza si la transición no es válida', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.CERRADO });
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);

    await expect(PeriodoContableService.cerrarPeriodo('p-1', ACTOR))
      .rejects.toThrow(PeriodoError);

    await expect(PeriodoContableService.cerrarPeriodo('p-1', ACTOR))
      .rejects.toMatchObject({ code: 'TRANSICION_INVALIDA' });
  });

  it('no cierra padre con hijos abiertos', async () => {
    const periodo = makePeriodo({
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
    });
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.periodoContable.count.mockResolvedValue(2); // 2 hijos abiertos

    await expect(PeriodoContableService.cerrarPeriodo('p-1', ACTOR))
      .rejects.toThrow(PeriodoError);

    await expect(PeriodoContableService.cerrarPeriodo('p-1', ACTOR))
      .rejects.toMatchObject({ code: 'HIJOS_ABIERTOS' });

    expect(mockPrisma.periodoContable.update).not.toHaveBeenCalled();
  });

  it('registra auditoría CIERRE', async () => {
    const periodo = makePeriodo({
      tipo: TipoPeriodo.DIARIO,
      estado: EstadoPeriodo.ABIERTO,
    });
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.periodoContable.count.mockResolvedValue(0); // sin hijos por relación
    mockPrisma.periodoContable.update.mockResolvedValue({
      ...periodo,
      estado: EstadoPeriodo.CERRADO,
    });
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    await PeriodoContableService.cerrarPeriodo('p-1', ACTOR);

    expect(mockPrisma.auditoriaPeriodo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evento: EventoAuditoria.CIERRE,
        actor: ACTOR,
      }),
    });
  });
});

// ── Tests: reabrirPeriodo ────────────────────────────────────────────────

describe('reabrirPeriodo', () => {
  beforeEach(resetMocks);

  it('rechaza reapertura sin motivo', async () => {
    await expect(PeriodoContableService.reabrirPeriodo('p-1', ACTOR, ''))
      .rejects.toThrow(PeriodoError);

    await expect(PeriodoContableService.reabrirPeriodo('p-1', ACTOR, ''))
      .rejects.toMatchObject({ code: 'MOTIVO_REAPERTURA_REQUERIDO' });
  });

  it('rechaza reapertura con motivo vacío (solo espacios)', async () => {
    await expect(PeriodoContableService.reabrirPeriodo('p-1', ACTOR, '   '))
      .rejects.toThrow(PeriodoError);

    await expect(PeriodoContableService.reabrirPeriodo('p-1', ACTOR, '   '))
      .rejects.toMatchObject({ code: 'MOTIVO_REAPERTURA_REQUERIDO' });
  });

  it('rechaza si el período no existe', async () => {
    mockPrisma.periodoContable.findUnique.mockResolvedValue(null);

    await expect(PeriodoContableService.reabrirPeriodo('p-no-existe', ACTOR, 'Error en cierre'))
      .rejects.toThrow(ActionError);
  });

  it('rechaza si la transición no es válida', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.ABIERTO });
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);

    await expect(PeriodoContableService.reabrirPeriodo('p-1', ACTOR, 'Motivo'))
      .rejects.toThrow(PeriodoError);

    await expect(PeriodoContableService.reabrirPeriodo('p-1', ACTOR, 'Motivo'))
      .rejects.toMatchObject({ code: 'TRANSICION_INVALIDA' });
  });

  it('reabre período APROBADO exitosamente', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.APROBADO });
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.periodoContable.update.mockResolvedValue({
      ...periodo,
      estado: EstadoPeriodo.REABIERTO,
      motivoReapertura: 'Error en conciliación',
    });
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    const result = await PeriodoContableService.reabrirPeriodo(
      'p-1',
      ACTOR,
      'Error en conciliación',
    );

    expect(result.estado).toBe(EstadoPeriodo.REABIERTO);
    expect(result.motivoReapertura).toBe('Error en conciliación');
  });

  it('registra auditoría REAPERTURA con motivo', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.APROBADO });
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.periodoContable.update.mockResolvedValue({
      ...periodo,
      estado: EstadoPeriodo.REABIERTO,
    });
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    await PeriodoContableService.reabrirPeriodo('p-1', ACTOR, 'Corrección de saldo');

    expect(mockPrisma.auditoriaPeriodo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evento: EventoAuditoria.REAPERTURA,
        actor: ACTOR,
        motivo: 'Corrección de saldo',
      }),
    });
  });
});

// ── Tests: aprobarPeriodo ────────────────────────────────────────────────

describe('aprobarPeriodo', () => {
  beforeEach(resetMocks);

  it('rechaza si el período no existe', async () => {
    mockPrisma.periodoContable.findUnique.mockResolvedValue(null);

    await expect(PeriodoContableService.aprobarPeriodo('p-no-existe', ACTOR))
      .rejects.toThrow(ActionError);
  });

  it('rechaza si la transición no es válida', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.ABIERTO });
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);

    await expect(PeriodoContableService.aprobarPeriodo('p-1', ACTOR))
      .rejects.toThrow(PeriodoError);

    await expect(PeriodoContableService.aprobarPeriodo('p-1', ACTOR))
      .rejects.toMatchObject({ code: 'TRANSICION_INVALIDA' });
  });

  it('aprueba período CERRADO exitosamente', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.CERRADO });
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.periodoContable.update.mockResolvedValue({
      ...periodo,
      estado: EstadoPeriodo.APROBADO,
      aprobadoPor: ACTOR,
      aprobadoAt: expect.any(Date),
    });
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    const result = await PeriodoContableService.aprobarPeriodo('p-1', ACTOR);

    expect(result.estado).toBe(EstadoPeriodo.APROBADO);
    expect(result.aprobadoPor).toBe(ACTOR);
  });

  it('registra auditoría APROBACION', async () => {
    const periodo = makePeriodo({ estado: EstadoPeriodo.CERRADO });
    mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
    mockPrisma.periodoContable.update.mockResolvedValue({
      ...periodo,
      estado: EstadoPeriodo.APROBADO,
    });
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

    await PeriodoContableService.aprobarPeriodo('p-1', ACTOR);

    expect(mockPrisma.auditoriaPeriodo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evento: EventoAuditoria.APROBACION,
        actor: ACTOR,
      }),
    });
  });
});

// ── Tests: validarEscritura ──────────────────────────────────────────────

describe('validarEscritura', () => {
  beforeEach(resetMocks);

  it('rechaza período cerrado', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(
      makePeriodo({ estado: EstadoPeriodo.CERRADO }),
    );

    const result = await PeriodoContableService.validarEscritura(
      new Date('2026-03-15'),
      TENANT,
    );

    expect(result.permitido).toBe(false);
    expect(result.error?.code).toBe('PERIODO_CERRADO');
  });

  it('rechaza período aprobado', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(
      makePeriodo({ estado: EstadoPeriodo.APROBADO }),
    );

    const result = await PeriodoContableService.validarEscritura(
      new Date('2026-03-15'),
      TENANT,
    );

    expect(result.permitido).toBe(false);
    expect(result.error?.code).toBe('PERIODO_APROBADO');
  });

  it('rechaza período en cierre', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(
      makePeriodo({ estado: EstadoPeriodo.EN_CIERRE }),
    );

    const result = await PeriodoContableService.validarEscritura(
      new Date('2026-03-15'),
      TENANT,
    );

    expect(result.permitido).toBe(false);
    expect(result.error?.code).toBe('PERIODO_EN_CIERRE');
  });

  it('rechaza si no existe período', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const result = await PeriodoContableService.validarEscritura(
      new Date('2026-03-15'),
      TENANT,
    );

    expect(result.permitido).toBe(false);
    expect(result.error?.code).toBe('PERIODO_NO_EXISTE');
  });

  it('acepta período abierto', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(
      makePeriodo({ estado: EstadoPeriodo.ABIERTO }),
    );

    const result = await PeriodoContableService.validarEscritura(
      new Date('2026-03-15'),
      TENANT,
    );

    expect(result.permitido).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('acepta período reabierto', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(
      makePeriodo({ estado: EstadoPeriodo.REABIERTO }),
    );

    const result = await PeriodoContableService.validarEscritura(
      new Date('2026-03-15'),
      TENANT,
    );

    expect(result.permitido).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

// ── Tests: resolverPeriodoActivo ─────────────────────────────────────────

describe('resolverPeriodoActivo', () => {
  beforeEach(resetMocks);

  it('resuelve período diario primero si existe', async () => {
    const diario = makePeriodo({
      tipo: TipoPeriodo.DIARIO,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date('2026-03-15'),
      fechaFin: new Date('2026-03-15'),
    });
    mockPrisma.periodoContable.findFirst.mockResolvedValue(diario);

    const result = await PeriodoContableService.resolverPeriodoActivo(
      new Date('2026-03-15'),
      TENANT,
    );

    expect(result.periodo?.tipo).toBe(TipoPeriodo.DIARIO);
    expect(result.esWritable).toBe(true);
  });

  it('fallback a mensual si no hay diario', async () => {
    // Primero retorna null (no hay diario), luego retorna mensual
    mockPrisma.periodoContable.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makePeriodo({
        tipo: TipoPeriodo.MENSUAL,
        estado: EstadoPeriodo.ABIERTO,
      }));

    const result = await PeriodoContableService.resolverPeriodoActivo(
      new Date('2026-03-15'),
      TENANT,
    );

    expect(result.periodo?.tipo).toBe(TipoPeriodo.MENSUAL);
  });

  it('fallback a anual si no hay diario ni mensual', async () => {
    mockPrisma.periodoContable.findFirst
      .mockResolvedValueOnce(null) // no diario
      .mockResolvedValueOnce(null) // no mensual
      .mockResolvedValueOnce(makePeriodo({
        tipo: TipoPeriodo.ANUAL,
        estado: EstadoPeriodo.ABIERTO,
        fechaInicio: new Date('2026-01-01'),
        fechaFin: new Date('2026-12-31'),
      }));

    const result = await PeriodoContableService.resolverPeriodoActivo(
      new Date('2026-03-15'),
      TENANT,
    );

    expect(result.periodo?.tipo).toBe(TipoPeriodo.ANUAL);
  });

  it('retorna NO_EXISTE si no hay ningún período', async () => {
    mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

    const result = await PeriodoContableService.resolverPeriodoActivo(
      new Date('2026-03-15'),
      TENANT,
    );

    expect(result.estado).toBe('NO_EXISTE');
    expect(result.periodo).toBeNull();
    expect(result.esWritable).toBe(false);
  });

  it('respeta tipo específico si se pasa', async () => {
    const mensual = makePeriodo({
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
    });
    mockPrisma.periodoContable.findFirst.mockResolvedValue(mensual);

    const result = await PeriodoContableService.resolverPeriodoActivo(
      new Date('2026-03-15'),
      TENANT,
      TipoPeriodo.MENSUAL,
    );

    expect(result.periodo?.tipo).toBe(TipoPeriodo.MENSUAL);
    expect(mockPrisma.periodoContable.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipo: TipoPeriodo.MENSUAL,
        }),
      }),
    );
  });
});

// ── Tests: obtenerTimeline ───────────────────────────────────────────────

describe('obtenerTimeline', () => {
  beforeEach(resetMocks);

  it('retorna timeline ordenado cronológicamente', async () => {
    const entries = [
      {
        auditoriaId: 'a-1',
        periodoId: 'p-1',
        evento: EventoAuditoria.APERTURA,
        actor: 'user-1',
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
        actor: 'user-2',
        timestamp: new Date('2026-03-31'),
        motivo: null,
        payload: null,
        entidadAfectada: null,
        createdAt: new Date('2026-03-31'),
      },
    ];
    mockPrisma.auditoriaPeriodo.findMany.mockResolvedValue(entries);

    const result = await PeriodoContableService.obtenerTimeline('p-1');

    expect(result).toHaveLength(2);
    expect(result[0].evento).toBe(EventoAuditoria.APERTURA);
    expect(result[1].evento).toBe(EventoAuditoria.CIERRE);
  });

  it('retorna array vacío si no hay entries', async () => {
    mockPrisma.auditoriaPeriodo.findMany.mockResolvedValue([]);

    const result = await PeriodoContableService.obtenerTimeline('p-1');

    expect(result).toEqual([]);
  });
});

// ── Tests: generarLabelPeriodo ───────────────────────────────────────────

describe('generarLabelPeriodo', () => {
  it('genera label correcto para período diario', () => {
    const label = generarLabelPeriodo(
      TipoPeriodo.DIARIO,
      new Date(Date.UTC(2026, 2, 15)), // Marzo 15, 2026 UTC
      new Date(Date.UTC(2026, 2, 15)),
    );
    expect(label).toBe('15 Marzo 2026');
  });

  it('genera label correcto para período mensual', () => {
    const label = generarLabelPeriodo(
      TipoPeriodo.MENSUAL,
      new Date(Date.UTC(2026, 2, 1)), // Marzo 1, 2026 UTC
      new Date(Date.UTC(2026, 2, 31)),
    );
    expect(label).toBe('Marzo 2026');
  });

  it('genera label correcto para período anual', () => {
    const label = generarLabelPeriodo(
      TipoPeriodo.ANUAL,
      new Date(Date.UTC(2026, 0, 1)), // Enero 1, 2026 UTC
      new Date(Date.UTC(2026, 11, 31)),
    );
    expect(label).toBe('Año 2026');
  });
});

// ── Tests: toResumen ─────────────────────────────────────────────────────

describe('toResumen', () => {
  it('convierte PeriodoContable a resumen', () => {
    const periodo = makePeriodo({
      tipo: TipoPeriodo.MENSUAL,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: new Date(Date.UTC(2026, 2, 15)), // Marzo 15 UTC
      fechaFin: new Date(Date.UTC(2026, 2, 31)),
    });

    const resumen = toResumen(periodo);

    expect(resumen.periodoId).toBe('p-1');
    expect(resumen.tipo).toBe(TipoPeriodo.MENSUAL);
    expect(resumen.estado).toBe(EstadoPeriodo.ABIERTO);
    expect(resumen.label).toBe('Marzo 2026');
  });
});

// ── Tests: WRITABLE_STATES y VALID_TRANSITIONS ───────────────────────────

describe('constantes de dominio', () => {
  it('WRITABLE_STATES incluye ABIERTO y REABIERTO', () => {
    expect(WRITABLE_STATES).toContain(EstadoPeriodo.ABIERTO);
    expect(WRITABLE_STATES).toContain(EstadoPeriodo.REABIERTO);
    expect(WRITABLE_STATES).not.toContain(EstadoPeriodo.CERRADO);
    expect(WRITABLE_STATES).not.toContain(EstadoPeriodo.APROBADO);
    expect(WRITABLE_STATES).not.toContain(EstadoPeriodo.EN_CIERRE);
    expect(WRITABLE_STATES).not.toContain(EstadoPeriodo.BORRADOR);
  });

  it('VALID_TRANSITIONS tiene entradas para todos los estados', () => {
    const estados = Object.values(EstadoPeriodo);
    for (const estado of estados) {
      expect(VALID_TRANSITIONS[estado]).toBeDefined();
      expect(Array.isArray(VALID_TRANSITIONS[estado])).toBe(true);
    }
  });
});

// ── Tests: getGuardConfig ────────────────────────────────────────────────

describe('getGuardConfig', () => {
  it('retorna defaults cuando no hay env vars', () => {
    const originalMode = process.env.PERIODO_CONTABLE_MODE;
    const originalEnabled = process.env.PERIODO_GUARD_ENABLED;
    delete process.env.PERIODO_CONTABLE_MODE;
    delete process.env.PERIODO_GUARD_ENABLED;

    const config = getGuardConfig();

    expect(config.enabled).toBe(true);
    expect(config.mode).toBe('enforce');

    process.env.PERIODO_CONTABLE_MODE = originalMode;
    process.env.PERIODO_GUARD_ENABLED = originalEnabled;
  });

  it('respeta PERIODO_GUARD_ENABLED=false', () => {
    const original = process.env.PERIODO_GUARD_ENABLED;
    process.env.PERIODO_GUARD_ENABLED = 'false';

    const config = getGuardConfig();

    expect(config.enabled).toBe(false);

    process.env.PERIODO_GUARD_ENABLED = original;
  });

  it('respeta PERIODO_CONTABLE_MODE=audit-only', () => {
    const original = process.env.PERIODO_CONTABLE_MODE;
    process.env.PERIODO_CONTABLE_MODE = 'audit-only';

    const config = getGuardConfig();

    expect(config.mode).toBe('audit-only');

    process.env.PERIODO_CONTABLE_MODE = original;
  });
});
