import { describe, expect, it } from 'vitest';

import {
  canAutoOpenDailyPeriod,
  createOpeningSeed,
  deriveOpeningBalances,
  normalizeOpeningAmount,
} from '@/lib/services/apertura-periodo-service';

describe('apertura-periodo-service', () => {
  /**
   * @description Convierte una fecha a clave local estable para evitar ruido de zona horaria en tests.
   * @param {Date} value - Fecha a serializar.
   * @returns {string} Clave local del timestamp.
   */
  function localDateTimeKey(value: Date): string {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    const hh = String(value.getHours()).padStart(2, '0');
    const min = String(value.getMinutes()).padStart(2, '0');
    const ss = String(value.getSeconds()).padStart(2, '0');
    const ms = String(value.getMilliseconds()).padStart(3, '0');

    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${ms}`;
  }

  it('normaliza saldos inválidos a cero', () => {
    expect(normalizeOpeningAmount(undefined)).toBe(0);
    expect(normalizeOpeningAmount(null)).toBe(0);
    expect(normalizeOpeningAmount('texto')).toBe(0);
    expect(normalizeOpeningAmount('25.5')).toBe(25.5);
  });

  it('arrastra saldos desde el snapshot previo cuando existe', () => {
    const result = deriveOpeningBalances(
      {
        periodoId: 'd-2026-04-22',
        codigo: 'D-2026-04-22',
        resumen: {
          saldoCajaFinal: 120,
          saldoBancoFinal: 500,
          saldoCuentasCobrarFinal: 80,
          saldoCuentasPagarFinal: 35,
          saldoInventarioFinal: 900,
          saldoCapitalFinal: 1000,
          saldoResultadoAcumFinal: 200,
        },
      },
      {
        caja: 10,
        bancos: 20,
      }
    );

    expect(result).toEqual({
      saldoCajaInicial: 120,
      saldoBancoInicial: 500,
      saldoCuentasCobrarInicial: 80,
      saldoCuentasPagarInicial: 35,
      saldoInventarioInicial: 900,
      saldoCapitalInicial: 1000,
      saldoResultadoAcumInicial: 200,
    });
  });

  it('usa saldos vivos como fallback si no hay snapshot previo', () => {
    const result = deriveOpeningBalances(undefined, {
      caja: 45,
      bancos: 300,
      cuentasPorCobrar: 20,
      cuentasPorPagar: 15,
      inventario: 700,
      capital: 900,
      resultadosAcumulados: 110,
    });

    expect(result).toEqual({
      saldoCajaInicial: 45,
      saldoBancoInicial: 300,
      saldoCuentasCobrarInicial: 20,
      saldoCuentasPagarInicial: 15,
      saldoInventarioInicial: 700,
      saldoCapitalInicial: 900,
      saldoResultadoAcumInicial: 110,
    });
  });

  it('genera una apertura diaria lista para persistir', () => {
    const result = createOpeningSeed(
      'DIARIO',
      new Date('2026-04-23T15:00:00.000Z'),
      {
        periodoId: 'd-2026-04-22',
        codigo: 'D-2026-04-22',
        resumen: {
          saldoCajaFinal: 150,
          saldoBancoFinal: 410,
        },
      }
    );

    expect(result.codigoPeriodo).toBe('D-2026-04-23');
    expect(result.tipoPeriodo).toBe('DIARIO');
    expect(result.estado).toBe('ABIERTO');
    expect(result.aperturaAutomatica).toBe(true);
    expect(result.origenPeriodoId).toBe('d-2026-04-22');
    expect(result.saldoCajaInicial).toBe(150);
    expect(result.saldoBancoInicial).toBe(410);
    expect(localDateTimeKey(result.fechaInicio)).toBe('2026-04-23 00:00:00.000');
    expect(localDateTimeKey(result.fechaFin)).toBe('2026-04-23 23:59:59.999');
    expect(result.detalleJson).toEqual({
      origen: {
        periodoId: 'd-2026-04-22',
        codigo: 'D-2026-04-22',
        estrategia: 'ARRASTRE_DESDE_SNAPSHOT',
      },
    });
  });

  it('detecta cuándo hay base para apertura diaria automática', () => {
    expect(canAutoOpenDailyPeriod()).toBe(false);
    expect(
      canAutoOpenDailyPeriod({
        periodoId: 'd-2026-04-22',
        codigo: 'D-2026-04-22',
      })
    ).toBe(false);
    expect(
      canAutoOpenDailyPeriod({
        periodoId: 'd-2026-04-22',
        codigo: 'D-2026-04-22',
        resumen: {
          saldoCajaFinal: 100,
        },
      })
    ).toBe(true);
  });
});
