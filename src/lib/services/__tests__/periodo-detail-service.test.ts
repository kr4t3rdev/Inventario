import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ESTADO_PERIODO } from '@/lib/services/periodo-contable-service';
import {
  PeriodoByIdNotFoundError,
  PeriodoDetailUnavailableError,
  getPeriodoDetail,
  isPeriodoByIdNotFoundError,
  isPeriodoDetailUnavailableError,
} from '@/lib/services/periodo-detail-service';

const prismaMock = vi.hoisted(() => ({
  periodoContable: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

describe('periodo-detail-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PeriodoDetailUnavailableError tiene status 503', () => {
    const error = new PeriodoDetailUnavailableError();
    expect(error.status).toBe(503);
    expect(error.code).toBe('PERIODO_DETAIL_UNAVAILABLE');
  });

  it('PeriodoByIdNotFoundError tiene status 404', () => {
    const error = new PeriodoByIdNotFoundError('abc');
    expect(error.status).toBe(404);
    expect(error.code).toBe('PERIODO_NO_ENCONTRADO');
  });

  it('type guards funcionan correctamente', () => {
    expect(isPeriodoDetailUnavailableError(new PeriodoDetailUnavailableError())).toBe(true);
    expect(isPeriodoDetailUnavailableError(new Error('otro'))).toBe(false);
    expect(isPeriodoByIdNotFoundError(new PeriodoByIdNotFoundError('x'))).toBe(true);
    expect(isPeriodoByIdNotFoundError(new Error('otro'))).toBe(false);
  });

  it('lanza PeriodoDetailUnavailableError si no hay modelo', async () => {
    const original = prismaMock.periodoContable;
    (prismaMock as Record<string, unknown>).periodoContable = undefined;

    await expect(getPeriodoDetail('abc')).rejects.toThrow(PeriodoDetailUnavailableError);

    prismaMock.periodoContable = original;
  });

  it('lanza PeriodoByIdNotFoundError si no existe el período', async () => {
    prismaMock.periodoContable.findUnique.mockResolvedValueOnce(null);

    await expect(getPeriodoDetail('no-existe')).rejects.toThrow(PeriodoByIdNotFoundError);
  });

  it('devuelve detalle completo con acciones disponibles para periodo ABIERTO', async () => {
    const now = new Date();
    prismaMock.periodoContable.findUnique.mockResolvedValueOnce({
      periodoId: 'p-1',
      codigo: 'D-2026-04-23',
      tipo: 'DIARIO',
      estado: ESTADO_PERIODO.ABIERTO,
      fechaInicio: new Date('2026-04-23'),
      fechaFin: new Date('2026-04-23T23:59:59'),
      periodoPadreId: null,
      aperturaAutomatica: false,
      cierreAutomatico: false,
      abiertoPorId: 'user-1',
      cerradoPorId: null,
      aprobadoPorId: null,
      reabiertoPorId: null,
      fechaApertura: now,
      fechaCierre: null,
      fechaAprobacion: null,
      fechaReapertura: null,
      observaciones: null,
      createdAt: now,
      updatedAt: now,
      apertura: {
        aperturaId: 'a-1',
        periodoId: 'p-1',
        origenPeriodoId: null,
        saldoCajaInicial: 1000,
        saldoBancoInicial: 5000,
        saldoCuentasCobrarInicial: 200,
        saldoCuentasPagarInicial: 300,
        saldoInventarioInicial: 8000,
        saldoCapitalInicial: 10000,
        saldoResultadoAcumInicial: 500,
        detalleJson: null,
        createdAt: now,
      },
      snapshots: [],
      subperiodos: [],
      auditorias: [],
    });

    const result = await getPeriodoDetail('p-1');

    expect(result.periodoId).toBe('p-1');
    expect(result.codigo).toBe('D-2026-04-23');
    expect(result.estado).toBe(ESTADO_PERIODO.ABIERTO);
    expect(result.puedeOperar).toBe(true);
    expect(result.puedeCerrar).toBe(true);
    expect(result.puedeAprobar).toBe(false);
    expect(result.puedeReabrir).toBe(false);
    expect(result.blockers).toEqual([]);
    expect(result.apertura).not.toBeNull();
    expect(result.apertura?.saldoCajaInicial).toBe(1000);
  });

  it('devuelve detalle con blockers para periodo MENSUAL con subperíodos abiertos', async () => {
    const now = new Date();
    prismaMock.periodoContable.findUnique.mockResolvedValueOnce({
      periodoId: 'm-1',
      codigo: 'M-2026-04',
      tipo: 'MENSUAL',
      estado: ESTADO_PERIODO.ABIERTO,
      fechaInicio: new Date('2026-04-01'),
      fechaFin: new Date('2026-04-30T23:59:59'),
      periodoPadreId: null,
      aperturaAutomatica: false,
      cierreAutomatico: false,
      abiertoPorId: 'user-1',
      cerradoPorId: null,
      aprobadoPorId: null,
      reabiertoPorId: null,
      fechaApertura: null,
      fechaCierre: null,
      fechaAprobacion: null,
      fechaReapertura: null,
      observaciones: null,
      createdAt: now,
      updatedAt: now,
      apertura: null,
      snapshots: [],
      subperiodos: [
        { periodoId: 'd-1', codigo: 'D-2026-04-01', estado: ESTADO_PERIODO.CERRADO },
        { periodoId: 'd-2', codigo: 'D-2026-04-02', estado: ESTADO_PERIODO.ABIERTO },
      ],
      auditorias: [],
    });

    const result = await getPeriodoDetail('m-1');

    expect(result.puedeCerrar).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.blockers[0]).toContain('D-2026-04-02');
  });

  it('devuelve detalle para periodo CERRADO sin snapshot con blocker', async () => {
    const now = new Date();
    prismaMock.periodoContable.findUnique.mockResolvedValueOnce({
      periodoId: 'd-1',
      codigo: 'D-2026-04-01',
      tipo: 'DIARIO',
      estado: ESTADO_PERIODO.CERRADO,
      fechaInicio: new Date('2026-04-01'),
      fechaFin: new Date('2026-04-01T23:59:59'),
      periodoPadreId: null,
      aperturaAutomatica: false,
      cierreAutomatico: false,
      abiertoPorId: null,
      cerradoPorId: 'user-1',
      aprobadoPorId: null,
      reabiertoPorId: null,
      fechaApertura: null,
      fechaCierre: now,
      fechaAprobacion: null,
      fechaReapertura: null,
      observaciones: null,
      createdAt: now,
      updatedAt: now,
      apertura: {
        aperturaId: 'a-1',
        periodoId: 'd-1',
        origenPeriodoId: null,
        saldoCajaInicial: 0,
        saldoBancoInicial: 0,
        saldoCuentasCobrarInicial: 0,
        saldoCuentasPagarInicial: 0,
        saldoInventarioInicial: 0,
        saldoCapitalInicial: 0,
        saldoResultadoAcumInicial: 0,
        detalleJson: null,
        createdAt: now,
      },
      snapshots: [],
      subperiodos: [],
      auditorias: [],
    });

    const result = await getPeriodoDetail('d-1');

    expect(result.puedeOperar).toBe(false);
    expect(result.puedeAprobar).toBe(true);
    expect(result.puedeReabrir).toBe(true);
    expect(result.blockers.some((b) => b.includes('no tiene snapshot'))).toBe(true);
  });
});