/**
 * @description Tests unitarios del PeriodoAuditService para períodos contables.
 *
 * Cubre: registro de eventos, obtención de timeline, y filtrado de bloqueos.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock de Prisma ────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditoriaPeriodo: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// ── Imports bajo test ─────────────────────────────────────────────────────

import { PeriodoAuditService } from '@/lib/services/periodo-audit-service';
import { EventoAuditoria } from '@/lib/services/periodo-contable-types';

// ── Helpers ───────────────────────────────────────────────────────────────

const TENANT = 'tenant-1';
const PERIODO_ID = 'p-1';
const ACTOR = 'user-1';

function resetMocks() {
  vi.clearAllMocks();
}

// ── Tests: registrar ──────────────────────────────────────────────────────

describe('registrar', () => {
  beforeEach(resetMocks);

  it('registra un evento de auditoría con campos mínimos', async () => {
    const created = {
      auditoriaId: 'aud-1',
      periodoId: PERIODO_ID,
      tenantId: TENANT,
      evento: EventoAuditoria.APERTURA,
      actor: ACTOR,
      timestamp: new Date(),
      entidadAfectada: null,
      motivo: null,
      payload: null,
      createdAt: new Date(),
    };
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue(created);

    const service = new PeriodoAuditService();
    const result = await service.registrar({
      periodoId: PERIODO_ID,
      tenantId: TENANT,
      evento: EventoAuditoria.APERTURA,
      actor: ACTOR,
    });

    expect(result.evento).toBe(EventoAuditoria.APERTURA);
    expect(result.actor).toBe(ACTOR);
    expect(mockPrisma.auditoriaPeriodo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        periodoId: PERIODO_ID,
        tenantId: TENANT,
        evento: EventoAuditoria.APERTURA,
        actor: ACTOR,
      }),
    });
  });

  it('registra evento con payload completo', async () => {
    const created = {
      auditoriaId: 'aud-2',
      periodoId: PERIODO_ID,
      tenantId: TENANT,
      evento: EventoAuditoria.REAPERTURA,
      actor: ACTOR,
      timestamp: new Date(),
      entidadAfectada: 'PeriodoContable',
      motivo: 'Corrección de factura duplicada',
      payload: { estadoAnterior: 'APROBADO', estadoNuevo: 'REABIERTO' },
      createdAt: new Date(),
    };
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue(created);

    const service = new PeriodoAuditService();
    const result = await service.registrar({
      periodoId: PERIODO_ID,
      tenantId: TENANT,
      evento: EventoAuditoria.REAPERTURA,
      actor: ACTOR,
      entidadAfectada: 'PeriodoContable',
      motivo: 'Corrección de factura duplicada',
      payload: { estadoAnterior: 'APROBADO', estadoNuevo: 'REABIERTO' },
    });

    expect(result.motivo).toBe('Corrección de factura duplicada');
    expect(result.entidadAfectada).toBe('PeriodoContable');
    expect(result.payload).toEqual({ estadoAnterior: 'APROBADO', estadoNuevo: 'REABIERTO' });

    expect(mockPrisma.auditoriaPeriodo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        motivo: 'Corrección de factura duplicada',
        entidadAfectada: 'PeriodoContable',
        payload: { estadoAnterior: 'APROBADO', estadoNuevo: 'REABIERTO' },
      }),
    });
  });

  it('registra evento de cierre con metadata', async () => {
    const created = {
      auditoriaId: 'aud-3',
      periodoId: PERIODO_ID,
      tenantId: TENANT,
      evento: EventoAuditoria.CIERRE,
      actor: ACTOR,
      timestamp: new Date(),
      entidadAfectada: null,
      motivo: null,
      payload: { snapshotsCreados: 3, operacionesEnPeriodo: 150 },
      createdAt: new Date(),
    };
    mockPrisma.auditoriaPeriodo.create.mockResolvedValue(created);

    const service = new PeriodoAuditService();
    const result = await service.registrar({
      periodoId: PERIODO_ID,
      tenantId: TENANT,
      evento: EventoAuditoria.CIERRE,
      actor: ACTOR,
      payload: { snapshotsCreados: 3, operacionesEnPeriodo: 150 },
    });

    expect(result.evento).toBe(EventoAuditoria.CIERRE);
    expect(result.payload).toEqual({ snapshotsCreados: 3, operacionesEnPeriodo: 150 });
  });
});

// ── Tests: obtenerTimeline ────────────────────────────────────────────────

describe('obtenerTimeline', () => {
  beforeEach(resetMocks);

  it('retorna timeline ordenado cronológicamente', async () => {
    const entries = [
      {
        auditoriaId: 'a-1',
        periodoId: PERIODO_ID,
        evento: EventoAuditoria.APERTURA,
        actor: 'user-1',
        timestamp: new Date('2026-03-01T10:00:00Z'),
        motivo: null,
        payload: null,
        entidadAfectada: null,
        createdAt: new Date('2026-03-01T10:00:00Z'),
      },
      {
        auditoriaId: 'a-2',
        periodoId: PERIODO_ID,
        evento: EventoAuditoria.CIERRE,
        actor: 'user-2',
        timestamp: new Date('2026-03-31T18:00:00Z'),
        motivo: null,
        payload: { snapshotsCreados: 2 },
        entidadAfectada: null,
        createdAt: new Date('2026-03-31T18:00:00Z'),
      },
      {
        auditoriaId: 'a-3',
        periodoId: PERIODO_ID,
        evento: EventoAuditoria.APROBACION,
        actor: 'admin-1',
        timestamp: new Date('2026-04-01T09:00:00Z'),
        motivo: null,
        payload: null,
        entidadAfectada: null,
        createdAt: new Date('2026-04-01T09:00:00Z'),
      },
    ];
    mockPrisma.auditoriaPeriodo.findMany.mockResolvedValue(entries);

    const service = new PeriodoAuditService();
    const result = await service.obtenerTimeline(PERIODO_ID);

    expect(result).toHaveLength(3);
    expect(result[0].evento).toBe(EventoAuditoria.APERTURA);
    expect(result[1].evento).toBe(EventoAuditoria.CIERRE);
    expect(result[2].evento).toBe(EventoAuditoria.APROBACION);

    // Verificar orden ascendente por timestamp
    expect(mockPrisma.auditoriaPeriodo.findMany).toHaveBeenCalledWith({
      where: { periodoId: PERIODO_ID },
      orderBy: { timestamp: 'asc' },
    });
  });

  it('retorna array vacío para período sin eventos', async () => {
    mockPrisma.auditoriaPeriodo.findMany.mockResolvedValue([]);

    const service = new PeriodoAuditService();
    const result = await service.obtenerTimeline('p-vacio');

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });
});

// ── Tests: obtenerBloqueosAudit ───────────────────────────────────────────

describe('obtenerBloqueosAudit', () => {
  beforeEach(resetMocks);

  it('filtra bloqueos por tenant y rango de fechas', async () => {
    const desde = new Date('2026-03-01T00:00:00Z');
    const hasta = new Date('2026-03-31T23:59:59Z');

    const bloqueos = [
      {
        auditoriaId: 'b-1',
        periodoId: PERIODO_ID,
        tenantId: TENANT,
        evento: 'INTENTO_BYPASS',
        actor: 'user-3',
        timestamp: new Date('2026-03-15T14:00:00Z'),
        motivo: 'Intento de escritura en período cerrado',
        payload: { periodoId: PERIODO_ID },
        entidadAfectada: null,
        createdAt: new Date('2026-03-15T14:00:00Z'),
      },
      {
        auditoriaId: 'b-2',
        periodoId: 'p-2',
        tenantId: TENANT,
        evento: 'BLOQUEO',
        actor: 'system',
        timestamp: new Date('2026-03-20T08:00:00Z'),
        motivo: null,
        payload: null,
        entidadAfectada: 'Venta',
        createdAt: new Date('2026-03-20T08:00:00Z'),
      },
    ];
    mockPrisma.auditoriaPeriodo.findMany.mockResolvedValue(bloqueos);

    const service = new PeriodoAuditService();
    const result = await service.obtenerBloqueosAudit(TENANT, desde, hasta);

    expect(result).toHaveLength(2);
    expect(result[0].evento).toBe('INTENTO_BYPASS');
    expect(result[1].evento).toBe('BLOQUEO');

    expect(mockPrisma.auditoriaPeriodo.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT,
        timestamp: {
          gte: desde,
          lte: hasta,
        },
        evento: {
          in: ['BLOQUEO', 'INTENTO_BYPASS', 'ERROR'],
        },
      },
      orderBy: { timestamp: 'asc' },
    });
  });

  it('retorna array vacío si no hay bloqueos en el rango', async () => {
    const desde = new Date('2026-01-01T00:00:00Z');
    const hasta = new Date('2026-01-31T23:59:59Z');

    mockPrisma.auditoriaPeriodo.findMany.mockResolvedValue([]);

    const service = new PeriodoAuditService();
    const result = await service.obtenerBloqueosAudit(TENANT, desde, hasta);

    expect(result).toEqual([]);
  });

  it('solo incluye eventos de tipo bloqueo, bypass y error', async () => {
    const desde = new Date('2026-03-01T00:00:00Z');
    const hasta = new Date('2026-03-31T23:59:59Z');

    const eventos = [
      {
        auditoriaId: 'b-3',
        periodoId: PERIODO_ID,
        tenantId: TENANT,
        evento: 'ERROR',
        actor: 'system',
        timestamp: new Date('2026-03-10T12:00:00Z'),
        motivo: 'Error al generar snapshot',
        payload: { error: 'DB_TIMEOUT' },
        entidadAfectada: 'SaldoSnapshot',
        createdAt: new Date('2026-03-10T12:00:00Z'),
      },
    ];
    mockPrisma.auditoriaPeriodo.findMany.mockResolvedValue(eventos);

    const service = new PeriodoAuditService();
    const result = await service.obtenerBloqueosAudit(TENANT, desde, hasta);

    expect(result).toHaveLength(1);
    expect(result[0].evento).toBe('ERROR');
  });
});
