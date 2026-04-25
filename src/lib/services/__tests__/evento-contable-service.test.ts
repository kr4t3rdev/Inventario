import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CRITERIO,
  ESTADO_EVENTO,
  NATURALEZA,
  ORIGEN_TIPO,
  generarEventoSeed,
  generarLineasDoblePartida,
  resolverCriterio,
  resolverNaturaleza,
  validarEventoSeed,
  type EventoContableSeed,
} from '@/lib/services/evento-contable-service';

const prismaMock = vi.hoisted(() => ({ $transaction: vi.fn() }));
const auditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: auditLogMock },
}));

import {
  EventoPersistenceUnavailableError,
  EventoValidationError,
  isEventoPersistenceUnavailableError,
  isEventoValidationError,
  persistEventoContable,
} from '@/lib/services/evento-contable-persistence-service';

describe('evento-contable-service', () => {
  describe('constantes y tipos', () => {
    it('ORIGEN_TIPO tiene los valores esperados', () => {
      expect(ORIGEN_TIPO.VENTA).toBe('VENTA');
      expect(ORIGEN_TIPO.GASTO_DE).toBe('GASTO_DE');
      expect(ORIGEN_TIPO.TRANSFERENCIA_BANCARIA).toBe('TRANSFERENCIA_BANCARIA');
    });

    it('CRITERIO tiene CAJA y DEVENGO', () => {
      expect(CRITERIO.CAJA).toBe('CAJA');
      expect(CRITERIO.DEVENGO).toBe('DEVENGO');
    });

    it('NATURALEZA tiene los 6 tipos', () => {
      expect(Object.keys(NATURALEZA)).toHaveLength(6);
      expect(NATURALEZA.INGRESO).toBe('INGRESO');
      expect(NATURALEZA.EGRESO).toBe('EGRESO');
      expect(NATURALEZA.RESULTADO).toBe('RESULTADO');
    });
  });

  describe('resolverNaturaleza', () => {
    it('resuelve INGRESO para VENTA', () => {
      expect(resolverNaturaleza('VENTA')).toBe('INGRESO');
    });

    it('resuelve EGRESO para GASTO_DE', () => {
      expect(resolverNaturaleza('GASTO_DE')).toBe('EGRESO');
    });

    it('resuelve ACTIVO para TRANSFERENCIA_BANCARIA', () => {
      expect(resolverNaturaleza('TRANSFERENCIA_BANCARIA')).toBe('ACTIVO');
    });

    it('resuelve RESULTADO como fallback', () => {
      expect(resolverNaturaleza('ORIGEN_DESCONOCIDO' as any)).toBe('RESULTADO');
    });
  });

  describe('resolverCriterio', () => {
    it('resuelve DEVENGO para VENTA', () => {
      expect(resolverCriterio('VENTA')).toBe('DEVENGO');
    });

    it('resuelve CAJA para COBRO_VENTA', () => {
      expect(resolverCriterio('COBRO_VENTA')).toBe('CAJA');
    });

    it('resuelve DEVENGO como fallback', () => {
      expect(resolverCriterio('ORIGEN_DESCONOCIDO' as any)).toBe('DEVENGO');
    });
  });

  describe('generarEventoSeed', () => {
    it('genera semilla con valores por defecto', () => {
      const seed = generarEventoSeed({
        fechaOperacion: new Date('2026-04-23'),
        origenTipo: 'VENTA',
        origenId: 'venta-1',
        criterio: 'DEVENGO',
        monto: 1000,
        naturaleza: 'INGRESO',
      });

      expect(seed.moneda).toBe('CUP');
      expect(seed.estado).toBeUndefined();
      expect(seed.descripcion).toBe('VENTA - venta-1');
    });

    it('resuelve criterio y naturaleza automáticamente', () => {
      const seed = generarEventoSeed({
        fechaOperacion: new Date('2026-04-23'),
        origenTipo: 'GASTO_DE',
        origenId: 'gasto-1',
        monto: 500,
      } as EventoContableSeed);

      expect(seed.criterio).toBe('DEVENGO');
      expect(seed.naturaleza).toBe('EGRESO');
    });

    it('respeta valores explícitos sobre los defaults', () => {
      const seed = generarEventoSeed({
        fechaOperacion: new Date('2026-04-23'),
        origenTipo: 'VENTA',
        origenId: 'venta-1',
        criterio: 'CAJA',
        monto: 1000,
        naturaleza: 'INGRESO',
        descripcion: 'Venta custom',
        moneda: 'USD',
      });

      expect(seed.criterio).toBe('CAJA');
      expect(seed.naturaleza).toBe('INGRESO');
      expect(seed.descripcion).toBe('Venta custom');
      expect(seed.moneda).toBe('USD');
    });
  });

  describe('generarLineasDoblePartida', () => {
    const eventoBase: EventoContableSeed = {
      fechaOperacion: new Date('2026-04-23'),
      origenTipo: 'VENTA',
      origenId: 'venta-1',
      criterio: 'DEVENGO',
      monto: 1000,
      naturaleza: 'INGRESO',
      descripcion: 'Venta.TEST',
    };

    it('genera 2 líneas para INGRESO', () => {
      const lineas = generarLineasDoblePartida(eventoBase, 'CAJA');
      expect(lineas).toHaveLength(2);
      expect(lineas[0].debito).toBe(1000);
      expect(lineas[0].credito).toBe(0);
      expect(lineas[1].debito).toBe(0);
      expect(lineas[1].credito).toBe(1000);
    });

    it('genera 2 líneas para EGRESO', () => {
      const lineas = generarLineasDoblePartida(
        { ...eventoBase, naturaleza: 'EGRESO' } as EventoContableSeed,
        'BANCO'
      );
      expect(lineas).toHaveLength(2);
      expect(lineas[0].debito).toBe(1000);
      expect(lineas[1].credito).toBe(1000);
    });

    it('balancea débito y crédito', () => {
      const lineas = generarLineasDoblePartida(eventoBase, 'CAJA');
      const totalDebito = lineas.reduce((s, l) => s + l.debito, 0);
      const totalCredito = lineas.reduce((s, l) => s + l.credito, 0);
      expect(totalDebito).toBe(totalCredito);
    });
  });

  describe('validarEventoSeed', () => {
    it('valida semilla correcta', () => {
      const result = validarEventoSeed({
        fechaOperacion: new Date('2026-04-23'),
        origenTipo: 'VENTA',
        origenId: 'venta-1',
        criterio: 'DEVENGO',
        monto: 1000,
        naturaleza: 'INGRESO',
      });

      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rechaza semilla sin origenTipo', () => {
      const result = validarEventoSeed({
        fechaOperacion: new Date(),
        origenTipo: '' as any,
        origenId: 'id',
        criterio: 'DEVENGO',
        monto: 100,
        naturaleza: 'INGRESO',
      });

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('origenTipo'))).toBe(true);
    });

    it('rechaza monto negativo', () => {
      const result = validarEventoSeed({
        fechaOperacion: new Date(),
        origenTipo: 'VENTA',
        origenId: 'id',
        criterio: 'DEVENGO',
        monto: -100,
        naturaleza: 'INGRESO',
      });

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('positivo'))).toBe(true);
    });

    it('rechaza naturaleza inválida', () => {
      const result = validarEventoSeed({
        fechaOperacion: new Date(),
        origenTipo: 'VENTA',
        origenId: 'id',
        criterio: 'DEVENGO',
        monto: 100,
        naturaleza: 'INVALIDA' as any,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('naturaleza'))).toBe(true);
    });
  });
});

describe('evento-contable-persistence-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditLogMock.mockResolvedValue(undefined);
  });

  describe('Errores tipados', () => {
    it('EventoPersistenceUnavailableError tiene status 503', () => {
      const error = new EventoPersistenceUnavailableError();
      expect(error.status).toBe(503);
      expect(error.code).toBe('EVENTO_PERSISTENCE_UNAVAILABLE');
    });

    it('EventoValidationError tiene status 400 y errores', () => {
      const errors = ['monto negativo', 'origenTipo faltante'];
      const error = new EventoValidationError(errors);
      expect(error.status).toBe(400);
      expect(error.code).toBe('EVENTO_VALIDATION_ERROR');
      expect(error.errors).toEqual(errors);
    });

    it('isEventoPersistenceUnavailableError funciona', () => {
      expect(isEventoPersistenceUnavailableError(new EventoPersistenceUnavailableError())).toBe(true);
      expect(isEventoPersistenceUnavailableError(new Error('otro'))).toBe(false);
    });

    it('isEventoValidationError funciona', () => {
      expect(isEventoValidationError(new EventoValidationError(['x']))).toBe(true);
      expect(isEventoValidationError(new Error('otro'))).toBe(false);
    });
  });

  describe('persistEventoContable', () => {
    it('rechaza sin $transaction en prisma', async () => {
      delete (prismaMock as Record<string, unknown>).$transaction;

      await expect(
        persistEventoContable({
          seed: {
            fechaOperacion: new Date(),
            origenTipo: 'VENTA',
            origenId: 'v1',
            criterio: 'DEVENGO',
            monto: 100,
            naturaleza: 'INGRESO',
          },
          lineas: [
            { cuenta: 'CAJA', debito: 100, credito: 0 },
            { cuenta: 'VENTA_v1', debito: 0, credito: 100 },
          ],
          usuarioId: 'user-1',
        })
      ).rejects.toThrow(EventoPersistenceUnavailableError);

      prismaMock.$transaction = vi.fn();
    });

    it('rechaza evento sin líneas', async () => {
      await expect(
        persistEventoContable({
          seed: {
            fechaOperacion: new Date(),
            origenTipo: 'VENTA',
            origenId: 'v1',
            criterio: 'DEVENGO',
            monto: 100,
            naturaleza: 'INGRESO',
          },
          lineas: [],
          usuarioId: 'user-1',
        })
      ).rejects.toThrow(EventoValidationError);
    });

    it('rechaza asiento desbalanceado', async () => {
      await expect(
        persistEventoContable({
          seed: {
            fechaOperacion: new Date(),
            origenTipo: 'VENTA',
            origenId: 'v1',
            criterio: 'DEVENGO',
            monto: 100,
            naturaleza: 'INGRESO',
          },
          lineas: [
            { cuenta: 'CAJA', debito: 100, credito: 0 },
            { cuenta: 'VENTA_v1', debito: 0, credito: 50 },
          ],
          usuarioId: 'user-1',
        })
      ).rejects.toThrow(EventoValidationError);
    });

    it('rechaza con validación fallida', async () => {
      await expect(
        persistEventoContable({
          seed: {
            fechaOperacion: new Date(),
            origenTipo: 'VENTA',
            origenId: '',
            criterio: 'DEVENGO',
            monto: 100,
            naturaleza: 'INGRESO',
          } as EventoContableSeed,
          lineas: [
            { cuenta: 'CAJA', debito: 100, credito: 0 },
            { cuenta: 'VENTA_v1', debito: 0, credito: 100 },
          ],
          usuarioId: 'user-1',
        })
      ).rejects.toThrow(EventoValidationError);
    });

    it('persiste evento con líneas balanceadas', async () => {
      const eventoResult = {
        eventoId: 'evt-1',
        fechaOperacion: new Date('2026-04-23'),
        fechaRegistro: new Date(),
        origenTipo: 'VENTA',
        origenId: 'venta-1',
        criterio: 'DEVENGO',
        naturaleza: 'INGRESO',
        monto: 5000,
        montoConvertido: null,
        moneda: 'CUP',
        estado: 'CONFIRMADO',
        descripcion: 'Venta.TEST',
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const tx = {
        eventoContable: {
          create: vi.fn().mockResolvedValue(eventoResult),
        },
      };

      prismaMock.$transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));

      const result = await persistEventoContable({
        seed: {
          fechaOperacion: new Date('2026-04-23'),
          origenTipo: 'VENTA',
          origenId: 'venta-1',
          criterio: 'DEVENGO',
          monto: 5000,
          naturaleza: 'INGRESO',
          descripcion: 'Venta.TEST',
        },
        lineas: [
          { cuenta: 'CAJA', debito: 5000, credito: 0, descripcion: 'Caja' },
          { cuenta: 'VENTA_venta-1', debito: 0, credito: 5000, descripcion: 'Ingreso venta' },
        ],
        usuarioId: 'user-1',
      });

      expect(result.wasCreated).toBe(true);
      expect(result.evento.origenTipo).toBe('VENTA');
      expect(result.lineas).toHaveLength(2);
      expect(auditLogMock).toHaveBeenCalled();
    });
  });
});