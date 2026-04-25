import { beforeEach, describe, expect, it, vi } from 'vitest';

const { eventoContableCreateMock, auditLogMock, prismaMock } = vi.hoisted(() => ({
  eventoContableCreateMock: vi.fn(),
  auditLogMock: vi.fn(),
  prismaMock: {
    $transaction: vi.fn(),
    eventoContable: { create: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: auditLogMock },
}));

import {
  persistEventoContable,
  persistirEventosLote,
  isEventoPersistenceUnavailableError,
  isEventoValidationError,
  EventoPersistenceUnavailableError,
  EventoValidationError,
} from '@/lib/services/evento-contable-persistence-service';

describe('evento-contable-persistence-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditLogMock.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = { eventoContable: { create: eventoContableCreateMock } };
      return cb(tx);
    });
    eventoContableCreateMock.mockResolvedValue({
      eventoId: 'evento-1',
      fechaOperacion: new Date('2026-04-23'),
      fechaRegistro: new Date('2026-04-23'),
      origenTipo: 'VENTA',
      origenId: 'venta-1',
      criterio: 'CAJA',
      periodoDiarioId: null,
      periodoMensualId: null,
      periodoAnualId: null,
      moneda: 'CUP',
      monto: 1000,
      montoConvertido: null,
      naturaleza: 'INGRESO',
      estado: 'CONFIRMADO',
      descripcion: null,
      metadataJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  const baseSeed = {
    fechaOperacion: new Date('2026-04-23'),
    origenTipo: 'VENTA' as const,
    origenId: 'venta-1',
    criterio: 'CAJA' as const,
    monto: 1000,
    naturaleza: 'INGRESO' as const,
    moneda: 'CUP',
  };

  const baseLineas = [
    { cuenta: 'Banco', debito: 1000, credito: 0, descripcion: 'Cobro venta' },
    { cuenta: 'Ventas', debito: 0, credito: 1000, descripcion: 'Ingreso por venta' },
  ];

  describe('persistEventoContable', () => {
    it('persiste evento con líneas de doble partida', async () => {
      const result = await persistEventoContable({
        seed: baseSeed,
        lineas: baseLineas,
        usuarioId: 'user-1',
      });

      expect(result.wasCreated).toBe(true);
      expect(result.evento).toBeDefined();
      expect(result.lineas).toHaveLength(2);
      expect(eventoContableCreateMock).toHaveBeenCalledTimes(1);

      const createArg = eventoContableCreateMock.mock.calls[0][0];
      expect(createArg.data.lineas.create).toHaveLength(2);
      expect(createArg.data.lineas.create[0].cuenta).toBe('Banco');
      expect(createArg.data.lineas.create[1].cuenta).toBe('Ventas');
    });

    it('registra audit log con datos correctos', async () => {
      await persistEventoContable({
        seed: baseSeed,
        lineas: baseLineas,
        usuarioId: 'user-1',
      });

      expect(auditLogMock).toHaveBeenCalledWith(expect.objectContaining({
        accion: 'CREATE',
        entidad: 'PERIODO_CONTABLE',
        entidadId: 'evento-1',
        usuarioId: 'user-1',
      }));
    });

    it('lanza EventoValidationError si no hay líneas', async () => {
      await expect(
        persistEventoContable({
          seed: baseSeed,
          lineas: [],
          usuarioId: 'user-1',
        })
      ).rejects.toThrow(EventoValidationError);
    });

    it('lanza EventoValidationError si asiento desbalanceado', async () => {
      await expect(
        persistEventoContable({
          seed: baseSeed,
          lineas: [
            { cuenta: 'Banco', debito: 1000, credito: 0 },
            { cuenta: 'Ventas', debito: 0, credito: 500 },
          ],
          usuarioId: 'user-1',
        })
      ).rejects.toThrow(EventoValidationError);
    });

    it('lanza EventoPersistenceUnavailableError si falta modelo Prisma', async () => {
      prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb({});
      });

      await expect(
        persistEventoContable({
          seed: baseSeed,
          lineas: baseLineas,
          usuarioId: 'user-1',
        })
      ).rejects.toThrow(EventoPersistenceUnavailableError);
    });

    it('lanza EventoPersistenceUnavailableError si falta $transaction', async () => {
      const prismaWithoutTx = {} as Record<string, unknown>;
      const origTransaction = prismaMock.$transaction;
      delete (prismaMock as Record<string, unknown>).$transaction;

      await expect(
        persistEventoContable({
          seed: baseSeed,
          lineas: baseLineas,
          usuarioId: 'user-1',
        })
      ).rejects.toThrow();

      prismaMock.$transaction = origTransaction;
    });
  });

  describe('persistirEventosLote', () => {
    it('persiste múltiples eventos con líneas auto-generadas', async () => {
      const seeds = [
        { ...baseSeed, origenId: 'venta-1' },
        { ...baseSeed, origenId: 'venta-2', monto: 2000 },
      ];

      const results = await persistirEventosLote(seeds, 'user-1', 'Caja');

      expect(results).toHaveLength(2);
      expect(eventoContableCreateMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('isEventoPersistenceUnavailableError', () => {
    it('devuelve true para EventoPersistenceUnavailableError', () => {
      expect(isEventoPersistenceUnavailableError(new EventoPersistenceUnavailableError())).toBe(true);
    });

    it('devuelve false para errores genéricos', () => {
      expect(isEventoPersistenceUnavailableError(new Error('genérico'))).toBe(false);
    });
  });

  describe('isEventoValidationError', () => {
    it('devuelve true para EventoValidationError', () => {
      expect(isEventoValidationError(new EventoValidationError(['error']))).toBe(true);
    });

    it('devuelve false para errores genéricos', () => {
      expect(isEventoValidationError(new Error('genérico'))).toBe(false);
    });
  });
});