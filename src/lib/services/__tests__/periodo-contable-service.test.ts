import { describe, expect, it } from 'vitest';

import {
  buildPeriodCode,
  buildPeriodRange,
  canRegisterOperations,
  createPeriodSeed,
  ESTADO_PERIODO,
  resolveOpenStatus,
  TIPO_PERIODO,
  validateClosePeriod,
} from '@/lib/services/periodo-contable-service';

describe('periodo-contable-service', () => {
  /**
   * @description Convierte una fecha a clave local YYYY-MM-DD HH:mm:ss.mmm para evitar falsos negativos por zona horaria.
   * @param {Date} value - Fecha a serializar.
   * @returns {string} Representación local estable.
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

  it('genera rangos diarios completos', () => {
    const referencia = new Date('2026-04-23T15:40:21.000Z');

    const result = buildPeriodRange(TIPO_PERIODO.DIARIO, referencia);

    expect(localDateTimeKey(result.fechaInicio)).toBe('2026-04-23 00:00:00.000');
    expect(localDateTimeKey(result.fechaFin)).toBe('2026-04-23 23:59:59.999');
  });

  it('genera códigos consistentes por tipo de período', () => {
    const referencia = new Date('2026-04-23T15:40:21.000Z');

    expect(buildPeriodCode(TIPO_PERIODO.DIARIO, referencia)).toBe('D-2026-04-23');
    expect(buildPeriodCode(TIPO_PERIODO.MENSUAL, referencia)).toBe('M-2026-04');
    expect(buildPeriodCode(TIPO_PERIODO.ANUAL, referencia)).toBe('A-2026');
  });

  it('solo permite operaciones en períodos abiertos o reabiertos', () => {
    expect(canRegisterOperations(ESTADO_PERIODO.ABIERTO)).toBe(true);
    expect(canRegisterOperations(ESTADO_PERIODO.REABIERTO)).toBe(true);
    expect(canRegisterOperations(ESTADO_PERIODO.CERRADO)).toBe(false);
    expect(canRegisterOperations(ESTADO_PERIODO.APROBADO)).toBe(false);
  });

  it('reabre correctamente un período cerrado y abre uno en borrador', () => {
    expect(resolveOpenStatus(ESTADO_PERIODO.BORRADOR)).toBe(
      ESTADO_PERIODO.ABIERTO
    );
    expect(resolveOpenStatus(ESTADO_PERIODO.CERRADO)).toBe(
      ESTADO_PERIODO.REABIERTO
    );
    expect(resolveOpenStatus(ESTADO_PERIODO.ABIERTO)).toBe(
      ESTADO_PERIODO.ABIERTO
    );
  });

  it('bloquea el cierre mensual cuando hay diarios sin cerrar', () => {
    const periodo = createPeriodSeed(
      TIPO_PERIODO.MENSUAL,
      new Date('2026-04-01T12:00:00.000Z'),
      'anual-2026'
    );

    const result = validateClosePeriod(
      {
        ...periodo,
        estado: ESTADO_PERIODO.EN_CIERRE,
      },
      [
        { codigo: 'D-2026-04-01', estado: ESTADO_PERIODO.CERRADO },
        { codigo: 'D-2026-04-02', estado: ESTADO_PERIODO.ABIERTO },
      ]
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('El período todavía tiene dependencias abiertas.');
    expect(result.blockers).toContain(
      'El subperíodo D-2026-04-02 sigue en estado ABIERTO.'
    );
  });

  it('permite cierre cuando el período y sus hijos están listos', () => {
    const periodo = {
      ...createPeriodSeed(TIPO_PERIODO.ANUAL, new Date('2026-01-01T12:00:00.000Z')),
      estado: ESTADO_PERIODO.ABIERTO,
    };

    const result = validateClosePeriod(periodo, [
      { codigo: 'M-2026-01', estado: ESTADO_PERIODO.APROBADO },
      { codigo: 'M-2026-02', estado: ESTADO_PERIODO.CERRADO },
    ]);

    expect(result).toEqual({
      ok: true,
      blockers: [],
    });
  });

  it('crea semillas consistentes para persistir períodos nuevos', () => {
    const result = createPeriodSeed(
      TIPO_PERIODO.MENSUAL,
      new Date('2026-04-23T15:40:21.000Z'),
      'periodo-anual-2026'
    );

    expect(result).toMatchObject({
      tipo: TIPO_PERIODO.MENSUAL,
      codigo: 'M-2026-04',
      estado: ESTADO_PERIODO.BORRADOR,
      periodoPadreId: 'periodo-anual-2026',
    });
    expect(localDateTimeKey(result.fechaInicio)).toBe('2026-04-01 00:00:00.000');
    expect(localDateTimeKey(result.fechaFin)).toBe('2026-04-30 23:59:59.999');
  });
});
