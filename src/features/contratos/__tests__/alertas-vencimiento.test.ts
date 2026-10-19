/**
 * @description Tests del calculador puro de alertas de vencimiento de contratos
 *              (CTF-6): ventana VENCIMIENTO_PROXIMO, CONTRATO_VENCIDO con
 *              antigüedad límite, truncado de fechaAlerta al día y dedupe.
 */
import { describe, it, expect } from 'vitest';
import {
  calcularAlertasVencimiento,
  dedupeAlertasExistentes,
} from '../lib/alertas-vencimiento';

const HOY = new Date('2026-09-27T12:00:00.000Z');

function contratoConFechaFin(diasDesdeHoy: number, diasAviso = 30) {
  return {
    contratoId: 'ct-1',
    tenantId: 'tenant-A',
    estado: 'ACTIVO' as const,
    fechaFin: new Date(HOY.getTime() + diasDesdeHoy * 86_400_000),
    diasAvisoVencimiento: diasAviso,
  };
}

describe('CTF-6 cálculo de alertas de vencimiento', () => {
  it('genera VENCIMIENTO_PROXIMO dentro de la ventana por contrato', () => {
    const alertas = calcularAlertasVencimiento(
      [contratoConFechaFin(10)],
      new Map(),
      HOY,
    );

    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      contratoId: 'ct-1',
      tenantId: 'tenant-A',
      tipo: 'VENCIMIENTO_PROXIMO',
      accionRequerida: false,
    });
  });

  it('usa el aviso por contrato por encima del tenant y del default 30', () => {
    const alertas = calcularAlertasVencimiento(
      [contratoConFechaFin(40, 45)],
      new Map([['tenant-A', 15]]),
      HOY,
    );

    expect(alertas).toHaveLength(1);
    expect(alertas[0].tipo).toBe('VENCIMIENTO_PROXIMO');
  });

  it('usa el aviso del tenant cuando el contrato no define uno', () => {
    // 40 días superan el default 30: si la alerta existe es porque usó el aviso del tenant (45).
    const contrato = { ...contratoConFechaFin(40), diasAvisoVencimiento: null };
    const alertas = calcularAlertasVencimiento([contrato], new Map([['tenant-A', 45]]), HOY);

    expect(alertas).toHaveLength(1);
    expect(alertas[0].tipo).toBe('VENCIMIENTO_PROXIMO');
  });

  it('no alerta cuando faltan más días que el aviso resuelto (default 30)', () => {
    const alertas = calcularAlertasVencimiento(
      [contratoConFechaFin(31)],
      new Map(),
      HOY,
    );

    expect(alertas).toHaveLength(0);
  });

  it('marca accionRequerida cuando faltan 7 días o menos', () => {
    const [sieteDias] = calcularAlertasVencimiento([contratoConFechaFin(7)], new Map(), HOY);
    const [ochoDias] = calcularAlertasVencimiento([contratoConFechaFin(8)], new Map(), HOY);

    expect(sieteDias.accionRequerida).toBe(true);
    expect(ochoDias.accionRequerida).toBe(false);
  });

  it('genera CONTRATO_VENCIDO con accionRequerida hasta 30 días de antigüedad', () => {
    const [reciente] = calcularAlertasVencimiento([contratoConFechaFin(-10)], new Map(), HOY);
    const [limite] = calcularAlertasVencimiento([contratoConFechaFin(-30)], new Map(), HOY);
    const [fuera] = calcularAlertasVencimiento([contratoConFechaFin(-31)], new Map(), HOY);

    expect(reciente.tipo).toBe('CONTRATO_VENCIDO');
    expect(reciente.accionRequerida).toBe(true);
    expect(limite.tipo).toBe('CONTRATO_VENCIDO');
    expect(fuera).toBeUndefined();
  });

  it('ignora contratos que no están ACTIVO o sin fechaFin', () => {
    const borrador = { ...contratoConFechaFin(5), estado: 'BORRADOR' as const };
    const sinFecha = { ...contratoConFechaFin(5), fechaFin: null };

    expect(calcularAlertasVencimiento([borrador, sinFecha], new Map(), HOY)).toHaveLength(0);
  });

  it('trunca fechaAlerta al día UTC para dedupe determinista', () => {
    const [alerta] = calcularAlertasVencimiento([contratoConFechaFin(10)], new Map(), HOY);

    expect(alerta.fechaAlerta.toISOString()).toBe('2026-09-27T00:00:00.000Z');
  });

  describe('dedupeAlertasExistentes', () => {
    it('omite alertas ya existentes para el mismo contrato, tipo y día', () => {
      const candidatas = calcularAlertasVencimiento([contratoConFechaFin(10)], new Map(), HOY);
      const existentes = [
        { contratoId: 'ct-1', tipo: 'VENCIMIENTO_PROXIMO', fechaAlerta: new Date('2026-09-27T00:00:00.000Z') },
      ];

      const restantes = dedupeAlertasExistentes(candidatas, existentes);

      expect(restantes).toHaveLength(0);
    });

    it('conserva alertas de otro día u otro tipo', () => {
      const candidatas = calcularAlertasVencimiento([contratoConFechaFin(10)], new Map(), HOY);
      const existentes = [
        { contratoId: 'ct-1', tipo: 'VENCIMIENTO_PROXIMO', fechaAlerta: new Date('2026-09-26T00:00:00.000Z') },
        { contratoId: 'ct-1', tipo: 'CONTRATO_VENCIDO', fechaAlerta: new Date('2026-09-27T00:00:00.000Z') },
        { contratoId: 'ct-2', tipo: 'VENCIMIENTO_PROXIMO', fechaAlerta: new Date('2026-09-27T00:00:00.000Z') },
      ];

      const restantes = dedupeAlertasExistentes(candidatas, existentes);

      expect(restantes).toHaveLength(1);
    });
  });
});
