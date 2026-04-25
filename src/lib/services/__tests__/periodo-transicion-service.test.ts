import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ESTADO_PERIODO } from '@/lib/services/periodo-contable-service';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

const auditLogMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: auditLogMock,
  },
}));

import {
  AprobacionBlockerError,
  PeriodoNotFoundError,
  ReaperturaBlockerError,
  TransicionPersistenceUnavailableError,
  aprobarPeriodo,
  isAprobacionBlockerError,
  isPeriodoNotFoundError,
  isReaperturaBlockerError,
  isTransicionPersistenceUnavailableError,
  reabrirPeriodo,
} from '@/lib/services/periodo-transicion-service';

describe('periodo-transicion-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditLogMock.mockResolvedValue(undefined);
  });

  describe('errores tipados', () => {
    it('TransicionPersistenceUnavailableError tiene status 503', () => {
      const error = new TransicionPersistenceUnavailableError();
      expect(error.status).toBe(503);
      expect(error.code).toBe('TRANSICION_PERSISTENCE_UNAVAILABLE');
    });

    it('PeriodoNotFoundError tiene status 404', () => {
      const error = new PeriodoNotFoundError('abc-123');
      expect(error.status).toBe(404);
      expect(error.code).toBe('PERIODO_NO_ENCONTRADO');
      expect(error.message).toContain('abc-123');
    });

    it('AprobacionBlockerError tiene status 409 y blockers', () => {
      const blockers = ['Falta snapshot', 'Subperíodo abierto'];
      const error = new AprobacionBlockerError(blockers);
      expect(error.status).toBe(409);
      expect(error.code).toBe('APROBACION_BLOCKED');
      expect(error.blockers).toEqual(blockers);
    });

    it('ReaperturaBlockerError tiene status 409 y blockers', () => {
      const blockers = ['Padre cerrado', 'Motivo requerido'];
      const error = new ReaperturaBlockerError(blockers);
      expect(error.status).toBe(409);
      expect(error.code).toBe('REAPERTURA_BLOCKED');
      expect(error.blockers).toEqual(blockers);
    });
  });

  describe('type guards', () => {
    it('isTransicionPersistenceUnavailableError', () => {
      expect(isTransicionPersistenceUnavailableError(new TransicionPersistenceUnavailableError())).toBe(true);
      expect(isTransicionPersistenceUnavailableError(new Error('otro'))).toBe(false);
    });

    it('isPeriodoNotFoundError', () => {
      expect(isPeriodoNotFoundError(new PeriodoNotFoundError('x'))).toBe(true);
      expect(isPeriodoNotFoundError(new Error('otro'))).toBe(false);
    });

    it('isAprobacionBlockerError', () => {
      expect(isAprobacionBlockerError(new AprobacionBlockerError([]))).toBe(true);
      expect(isAprobacionBlockerError(new Error('otro'))).toBe(false);
    });

    it('isReaperturaBlockerError', () => {
      expect(isReaperturaBlockerError(new ReaperturaBlockerError([]))).toBe(true);
      expect(isReaperturaBlockerError(new Error('otro'))).toBe(false);
    });
  });

  describe('aprobarPeriodo', () => {
    it('rechaza si no hay $transaction en prisma', async () => {
      delete (prismaMock as Record<string, unknown>).$transaction;

      await expect(
        aprobarPeriodo({ periodoId: 'p1', usuarioId: 'u1' })
      ).rejects.toThrow(TransicionPersistenceUnavailableError);
    });

    it('rechaza si el periodo no existe', async () => {
      const tx = {
        periodoContable: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn(), update: vi.fn() },
        snapshotPeriodo: { findFirst: vi.fn() },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      await expect(
        aprobarPeriodo({ periodoId: 'no-existe', usuarioId: 'user-1' })
      ).rejects.toThrow(PeriodoNotFoundError);
    });

    it('rechaza si el periodo ya esta aprobado', async () => {
      const tx = {
        periodoContable: {
          findUnique: vi.fn().mockResolvedValue({
            periodoId: 'periodo-1',
            codigo: 'D-2026-04-23',
            tipo: 'DIARIO',
            estado: ESTADO_PERIODO.APROBADO,
            periodoPadreId: null,
          }),
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        snapshotPeriodo: { findFirst: vi.fn() },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      await expect(
        aprobarPeriodo({ periodoId: 'periodo-1', usuarioId: 'user-1' })
      ).rejects.toThrow(AprobacionBlockerError);
    });

    it('rechaza si el periodo esta ABIERTO (no se puede aprobar desde ABIERTO)', async () => {
      const tx = {
        periodoContable: {
          findUnique: vi.fn().mockResolvedValue({
            periodoId: 'periodo-1',
            codigo: 'D-2026-04-23',
            tipo: 'DIARIO',
            estado: ESTADO_PERIODO.ABIERTO,
            periodoPadreId: null,
          }),
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        snapshotPeriodo: { findFirst: vi.fn() },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      try {
        await aprobarPeriodo({ periodoId: 'periodo-1', usuarioId: 'user-1' });
        expect.fail('Debería haber lanzado AprobacionBlockerError');
      } catch (error) {
        expect(error).toBeInstanceOf(AprobacionBlockerError);
        expect((error as AprobacionBlockerError).blockers.some((b) => b.includes('Solo se puede aprobar desde CERRADO'))).toBe(true);
      }
    });

    it('rechaza si el periodo no tiene snapshot', async () => {
      const tx = {
        periodoContable: {
          findUnique: vi.fn().mockResolvedValue({
            periodoId: 'periodo-1',
            codigo: 'D-2026-04-23',
            tipo: 'DIARIO',
            estado: ESTADO_PERIODO.CERRADO,
            periodoPadreId: null,
          }),
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        snapshotPeriodo: { findFirst: vi.fn().mockResolvedValue(null) },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      try {
        await aprobarPeriodo({ periodoId: 'periodo-1', usuarioId: 'user-1' });
        expect.fail('Debería haber lanzado AprobacionBlockerError');
      } catch (error) {
        expect(error).toBeInstanceOf(AprobacionBlockerError);
        expect((error as AprobacionBlockerError).blockers.some((b) => b.includes('no tiene snapshot'))).toBe(true);
      }
    });

    it('rechaza si el padre esta cerrado o aprobado', async () => {
      const tx = {
        periodoContable: {
          findUnique: vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
            const where = args.where as Record<string, unknown>;
            if (where.periodoId === 'padre-1') {
              return {
                periodoId: 'padre-1',
                codigo: 'M-2026-04',
                tipo: 'MENSUAL',
                estado: ESTADO_PERIODO.CERRADO,
              };
            }
            return {
              periodoId: 'periodo-1',
              codigo: 'D-2026-04-23',
              tipo: 'DIARIO',
              estado: ESTADO_PERIODO.CERRADO,
              periodoPadreId: 'padre-1',
            };
          }),
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        snapshotPeriodo: { findFirst: vi.fn().mockResolvedValue({ snapshotId: 'snap-1', version: 1 }) },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      try {
        await aprobarPeriodo({ periodoId: 'periodo-1', usuarioId: 'user-1' });
        expect.fail('Debería haber lanzado AprobacionBlockerError');
      } catch (error) {
        expect(error).toBeInstanceOf(AprobacionBlockerError);
        expect((error as AprobacionBlockerError).blockers.some((b) => b.includes('padre'))).toBe(true);
      }
    });

    it('aprueba exitosamente un periodo CERRADO con snapshot y sin padre cerrado', async () => {
      const updatedPeriodo = {
        periodoId: 'periodo-1',
        codigo: 'D-2026-04-23',
        tipo: 'DIARIO',
        estado: ESTADO_PERIODO.APROBADO,
        fechaAprobacion: new Date(),
        aprobadoPorId: 'user-1',
      };

      const tx = {
        periodoContable: {
          findUnique: vi.fn().mockResolvedValue({
            periodoId: 'periodo-1',
            codigo: 'D-2026-04-23',
            tipo: 'DIARIO',
            estado: ESTADO_PERIODO.CERRADO,
            periodoPadreId: null,
          }),
          findFirst: vi.fn(),
          update: vi.fn().mockResolvedValue(updatedPeriodo),
        },
        snapshotPeriodo: { findFirst: vi.fn().mockResolvedValue({ snapshotId: 'snap-1', periodoId: 'periodo-1', version: 1 }) },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      const result = await aprobarPeriodo({
        periodoId: 'periodo-1',
        usuarioId: 'user-1',
        motivo: 'Cierre mensual aprobado',
      });

      expect(result.estadoAnterior).toBe(ESTADO_PERIODO.CERRADO);
      expect(result.estadoNuevo).toBe(ESTADO_PERIODO.APROBADO);
      expect(result.auditado).toBe(true);
      expect(auditLogMock).toHaveBeenCalled();
    });
  });

  describe('reabrirPeriodo', () => {
    it('rechaza si no hay $transaction', async () => {
      delete (prismaMock as Record<string, unknown>).$transaction;

      await expect(
        reabrirPeriodo({ periodoId: 'p1', usuarioId: 'u1', motivo: 'razón' })
      ).rejects.toThrow(TransicionPersistenceUnavailableError);
    });

    it('requiere motivo obligatorio', async () => {
      const tx = {
        periodoContable: {
          findUnique: vi.fn().mockResolvedValue({
            periodoId: 'periodo-1',
            codigo: 'D-2026-04-23',
            tipo: 'DIARIO',
            estado: ESTADO_PERIODO.CERRADO,
            periodoPadreId: null,
          }),
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        snapshotPeriodo: { findFirst: vi.fn() },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      try {
        await reabrirPeriodo({ periodoId: 'periodo-1', usuarioId: 'user-1', motivo: '' });
        expect.fail('Debería haber lanzado ReaperturaBlockerError');
      } catch (error) {
        expect(error).toBeInstanceOf(ReaperturaBlockerError);
        expect((error as ReaperturaBlockerError).blockers.some((b) => b.includes('motivo obligatorio'))).toBe(true);
      }
    });

    it('rechaza si el periodo ya esta ABIERTO', async () => {
      const tx = {
        periodoContable: {
          findUnique: vi.fn().mockResolvedValue({
            periodoId: 'periodo-1',
            codigo: 'D-2026-04-23',
            tipo: 'DIARIO',
            estado: ESTADO_PERIODO.ABIERTO,
            periodoPadreId: null,
          }),
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        snapshotPeriodo: { findFirst: vi.fn() },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      try {
        await reabrirPeriodo({ periodoId: 'periodo-1', usuarioId: 'user-1', motivo: 'Error en cierre' });
        expect.fail('Debería haber lanzado ReaperturaBlockerError');
      } catch (error) {
        expect(error).toBeInstanceOf(ReaperturaBlockerError);
        expect((error as ReaperturaBlockerError).blockers.some((b) => b.includes('ya está abierto'))).toBe(true);
      }
    });

    it('rechaza si el periodo esta en BORRADOR', async () => {
      const tx = {
        periodoContable: {
          findUnique: vi.fn().mockResolvedValue({
            periodoId: 'periodo-1',
            codigo: 'D-2026-04-23',
            tipo: 'DIARIO',
            estado: ESTADO_PERIODO.BORRADOR,
            periodoPadreId: null,
          }),
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        snapshotPeriodo: { findFirst: vi.fn() },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      try {
        await reabrirPeriodo({ periodoId: 'periodo-1', usuarioId: 'user-1', motivo: 'Reapertura' });
        expect.fail('Debería haber lanzado ReaperturaBlockerError');
      } catch (error) {
        expect(error).toBeInstanceOf(ReaperturaBlockerError);
        expect((error as ReaperturaBlockerError).blockers.some((b) => b.includes('Solo se puede reabrir desde CERRADO o APROBADO'))).toBe(true);
      }
    });

    it('rechaza si el padre esta cerrado/aprobado', async () => {
      const tx = {
        periodoContable: {
          findUnique: vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
            const where = args.where as Record<string, unknown>;
            if (where.periodoId === 'padre-1') {
              return {
                periodoId: 'padre-1',
                codigo: 'M-2026-04',
                tipo: 'MENSUAL',
                estado: ESTADO_PERIODO.APROBADO,
              };
            }
            return {
              periodoId: 'periodo-1',
              codigo: 'D-2026-04-23',
              tipo: 'DIARIO',
              estado: ESTADO_PERIODO.CERRADO,
              periodoPadreId: 'padre-1',
            };
          }),
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        snapshotPeriodo: { findFirst: vi.fn() },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      try {
        await reabrirPeriodo({ periodoId: 'periodo-1', usuarioId: 'user-1', motivo: 'Error en cierre' });
        expect.fail('Debería haber lanzado ReaperturaBlockerError');
      } catch (error) {
        expect(error).toBeInstanceOf(ReaperturaBlockerError);
        expect((error as ReaperturaBlockerError).blockers.some((b) => b.includes('padre'))).toBe(true);
      }
    });

    it('reabre exitosamente un periodo CERRADO con motivo', async () => {
      const updatedPeriodo = {
        periodoId: 'periodo-1',
        codigo: 'D-2026-04-23',
        tipo: 'DIARIO',
        estado: ESTADO_PERIODO.REABIERTO,
        fechaReapertura: new Date(),
        reabiertoPorId: 'user-1',
      };

      const tx = {
        periodoContable: {
          findUnique: vi.fn().mockResolvedValue({
            periodoId: 'periodo-1',
            codigo: 'D-2026-04-23',
            tipo: 'DIARIO',
            estado: ESTADO_PERIODO.CERRADO,
            periodoPadreId: null,
          }),
          findFirst: vi.fn(),
          update: vi.fn().mockResolvedValue(updatedPeriodo),
        },
        snapshotPeriodo: { findFirst: vi.fn() },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      const result = await reabrirPeriodo({
        periodoId: 'periodo-1',
        usuarioId: 'user-1',
        motivo: 'Se detectó error en el cierre del día',
      });

      expect(result.estadoAnterior).toBe(ESTADO_PERIODO.CERRADO);
      expect(result.estadoNuevo).toBe(ESTADO_PERIODO.REABIERTO);
      expect(result.auditado).toBe(true);
      expect(auditLogMock).toHaveBeenCalled();
    });

    it('reabre exitosamente un periodo APROBADO con motivo', async () => {
      const updatedPeriodo = {
        periodoId: 'periodo-1',
        codigo: 'D-2026-04-23',
        tipo: 'DIARIO',
        estado: ESTADO_PERIODO.REABIERTO,
        fechaReapertura: new Date(),
        reabiertoPorId: 'user-1',
      };

      const tx = {
        periodoContable: {
          findUnique: vi.fn().mockResolvedValue({
            periodoId: 'periodo-1',
            codigo: 'D-2026-04-23',
            tipo: 'DIARIO',
            estado: ESTADO_PERIODO.APROBADO,
            periodoPadreId: null,
          }),
          findFirst: vi.fn(),
          update: vi.fn().mockResolvedValue(updatedPeriodo),
        },
        snapshotPeriodo: { findFirst: vi.fn() },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      const result = await reabrirPeriodo({
        periodoId: 'periodo-1',
        usuarioId: 'user-1',
        motivo: 'Ajuste necesario post-aprobación',
      });

      expect(result.estadoAnterior).toBe(ESTADO_PERIODO.APROBADO);
      expect(result.estadoNuevo).toBe(ESTADO_PERIODO.REABIERTO);
      expect(result.auditado).toBe(true);
    });
  });
});