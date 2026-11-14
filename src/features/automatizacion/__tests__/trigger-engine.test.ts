/**
 * @description Tests unitarios para el trigger engine.
 *
 * @module features/automatizacion/__tests__/trigger-engine.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  cumpleTrigger,
  evaluarCondiciones,
  evaluarTriggers,
  crearEventoCompraCompletada,
  crearEventoCumpleanos,
  crearEventoTierAlcanzado,
  crearEventoChurnRisk,
} from '../services/trigger-engine';
import type { TriggerDefinicion, TriggerEventoData } from '../services/trigger-engine';

describe('cumpleTrigger', () => {
  const triggerActivo: TriggerDefinicion = {
    triggerId: 't1',
    tenantId: 'tenant1',
    nombre: 'Test',
    evento: 'COMPRA_COMPLETADA',
    condiciones: {},
    accion: 'EMAIL',
    payload: {},
    canal: 'EMAIL',
    delayMinutos: 0,
    activo: true,
    vecesMaximo: null,
  };

  it('retorna false si el trigger está inactivo', () => {
    const evento: TriggerEventoData = {
      clienteId: 'c1',
      tenantId: 'tenant1',
      evento: 'COMPRA_COMPLETADA',
      datos: {},
    };
    expect(cumpleTrigger({ ...triggerActivo, activo: false }, evento)).toBe(false);
  });

  it('retorna false si el evento no coincide', () => {
    const evento: TriggerEventoData = {
      clienteId: 'c1',
      tenantId: 'tenant1',
      evento: 'CUMPLEANOS',
      datos: {},
    };
    expect(cumpleTrigger(triggerActivo, evento)).toBe(false);
  });

  it('retorna false si el tenant no coincide', () => {
    const evento: TriggerEventoData = {
      clienteId: 'c1',
      tenantId: 'tenant2',
      evento: 'COMPRA_COMPLETADA',
      datos: {},
    };
    expect(cumpleTrigger(triggerActivo, evento)).toBe(false);
  });

  it('retorna true si todo coincide y no hay condiciones', () => {
    const evento: TriggerEventoData = {
      clienteId: 'c1',
      tenantId: 'tenant1',
      evento: 'COMPRA_COMPLETADA',
      datos: {},
    };
    expect(cumpleTrigger(triggerActivo, evento)).toBe(true);
  });
});

describe('evaluarCondiciones', () => {
  it('evalúa condición min correctamente', () => {
    const condiciones = { minimoGasto: { min: 1000 } };
    expect(evaluarCondiciones(condiciones, { minimoGasto: 1500 })).toBe(true);
    expect(evaluarCondiciones(condiciones, { minimoGasto: 500 })).toBe(false);
  });

  it('evalúa condición max correctamente', () => {
    const condiciones = { diasDesdeUltima: { max: 30 } };
    expect(evaluarCondiciones(condiciones, { diasDesdeUltima: 20 })).toBe(true);
    expect(evaluarCondiciones(condiciones, { diasDesdeUltima: 40 })).toBe(false);
  });

  it('evalúa condición eq correctamente', () => {
    const condiciones = { segmento: { eq: 'VIP' } };
    expect(evaluarCondiciones(condiciones, { segmento: 'VIP' })).toBe(true);
    expect(evaluarCondiciones(condiciones, { segmento: 'Regular' })).toBe(false);
  });

  it('evalúa condición simple correctamente', () => {
    const condiciones = { segmento: 'VIP' };
    expect(evaluarCondiciones(condiciones, { segmento: 'VIP' })).toBe(true);
    expect(evaluarCondiciones(condiciones, { segmento: 'Regular' })).toBe(false);
  });

  it('retorna true para condiciones vacías', () => {
    expect(evaluarCondiciones({}, { cualquier: 'dato' })).toBe(true);
  });
});

describe('evaluarTriggers', () => {
  it('evalúa múltiples triggers contra un evento', () => {
    const triggers: TriggerDefinicion[] = [
      {
        triggerId: 't1',
        tenantId: 'tenant1',
        nombre: 'Email post-compra',
        evento: 'COMPRA_COMPLETADA',
        condiciones: {},
        accion: 'EMAIL',
        payload: { templateId: 'post-compra' },
        canal: 'EMAIL',
        delayMinutos: 0,
        activo: true,
        vecesMaximo: null,
      },
      {
        triggerId: 't2',
        tenantId: 'tenant1',
        nombre: 'Puntos bonus',
        evento: 'COMPRA_COMPLETADA',
        condiciones: { totalCompra: { min: 5000 } },
        accion: 'PUNTOS_BONUS',
        payload: { puntos: 100 },
        canal: 'PUSH',
        delayMinutos: 0,
        activo: true,
        vecesMaximo: null,
      },
    ];

    const evento = crearEventoCompraCompletada({
      clienteId: 'c1',
      tenantId: 'tenant1',
      totalCompra: 10000,
      canal: 'POS',
    });

    const resultados = evaluarTriggers(triggers, evento);
    expect(resultados).toHaveLength(2);
    expect(resultados.every((r) => r.ejecutado)).toBe(true);
  });

  it('respeta el límite de ejecuciones', () => {
    const triggers: TriggerDefinicion[] = [
      {
        triggerId: 't1',
        tenantId: 'tenant1',
        nombre: 'Test',
        evento: 'CUMPLEANOS',
        condiciones: {},
        accion: 'EMAIL',
        payload: {},
        canal: 'EMAIL',
        delayMinutos: 0,
        activo: true,
        vecesMaximo: 1,
      },
    ];

    const evento = crearEventoCumpleanos({
      clienteId: 'c1',
      tenantId: 'tenant1',
    });

    const ejecuciones = new Map<string, number>();
    evaluarTriggers(triggers, evento, ejecuciones);
    const resultados2 = evaluarTriggers(triggers, evento, ejecuciones);

    expect(resultados2[0].ejecutado).toBe(false);
    expect(resultados2[0].motivo).toBe('Límite de ejecuciones alcanzado');
  });
});

describe('crearEventoCompraCompletada', () => {
  it('crea evento con datos correctos', () => {
    const evento = crearEventoCompraCompletada({
      clienteId: 'c1',
      tenantId: 't1',
      totalCompra: 5000,
      canal: 'POS',
      segmento: 'VIP',
    });

    expect(evento.evento).toBe('COMPRA_COMPLETADA');
    expect(evento.clienteId).toBe('c1');
    expect(evento.datos.totalCompra).toBe(5000);
    expect(evento.datos.canal).toBe('POS');
  });
});

describe('crearEventoChurnRisk', () => {
  it('crea evento de churn risk', () => {
    const evento = crearEventoChurnRisk({
      clienteId: 'c1',
      tenantId: 't1',
      probabilidad: 0.75,
      riesgo: 'alto',
    });

    expect(evento.evento).toBe('CHURN_RISK');
    expect(evento.datos.probabilidad).toBe(0.75);
  });
});
