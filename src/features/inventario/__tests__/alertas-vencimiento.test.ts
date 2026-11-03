/**
 * @description Pruebas del calculador puro de alertas de vencimiento de lotes.
 * Sin Prisma ni reloj propio: el calculador recibe la fecha actual y la ventana.
 */
import { describe, expect, it } from 'vitest';

import {
  DIAS_ALERTA_VENCIMIENTO_DEFAULT,
  DIAS_ALERTA_VENCIMIENTO_MAXIMO,
  DIAS_ALERTA_VENCIMIENTO_MINIMO,
  calcularAlertasVencimientoLotes,
  resolverDiasAlertaVencimiento,
  type LoteParaAlerta,
} from '@/features/inventario/lib/alertas-vencimiento';

const HOY = new Date('2026-11-03T00:00:00.000Z');

function crearLote(overrides: Partial<LoteParaAlerta> = {}): LoteParaAlerta {
  return {
    id: 'lote-1',
    codigo: 'LOTE-001',
    fechaVencimiento: new Date('2026-11-20T00:00:00.000Z'),
    cantidadDisponible: 10,
    producto: { id: 'prod-1', nombre: 'Arroz' },
    ...overrides,
  };
}

describe('resolverDiasAlertaVencimiento', () => {
  it('usa 30 días por defecto cuando el tenant no define ventana', () => {
    expect(resolverDiasAlertaVencimiento()).toBe(DIAS_ALERTA_VENCIMIENTO_DEFAULT);
    expect(resolverDiasAlertaVencimiento(null)).toBe(DIAS_ALERTA_VENCIMIENTO_DEFAULT);
    expect(DIAS_ALERTA_VENCIMIENTO_DEFAULT).toBe(30);
  });

  it('respeta la ventana configurada dentro del rango permitido', () => {
    expect(resolverDiasAlertaVencimiento(15)).toBe(15);
    expect(resolverDiasAlertaVencimiento(1)).toBe(DIAS_ALERTA_VENCIMIENTO_MINIMO);
    expect(resolverDiasAlertaVencimiento(30)).toBe(DIAS_ALERTA_VENCIMIENTO_MAXIMO);
  });

  it('acota la ventana al máximo de 30 días y al mínimo de 1 día', () => {
    expect(resolverDiasAlertaVencimiento(90)).toBe(DIAS_ALERTA_VENCIMIENTO_MAXIMO);
    expect(resolverDiasAlertaVencimiento(0)).toBe(DIAS_ALERTA_VENCIMIENTO_MINIMO);
    expect(resolverDiasAlertaVencimiento(-5)).toBe(DIAS_ALERTA_VENCIMIENTO_MINIMO);
  });

  it('descarta valores inválidos y vuelve al valor por defecto', () => {
    expect(resolverDiasAlertaVencimiento(Number.NaN)).toBe(DIAS_ALERTA_VENCIMIENTO_DEFAULT);
    expect(resolverDiasAlertaVencimiento(7.5)).toBe(DIAS_ALERTA_VENCIMIENTO_DEFAULT);
  });
});

describe('calcularAlertasVencimientoLotes', () => {
  it('marca como vencidos los lotes cuya fecha ya pasó', () => {
    const alertas = calcularAlertasVencimientoLotes(
      [crearLote({ id: 'lote-v', fechaVencimiento: new Date('2026-11-01T00:00:00.000Z') })],
      { hoy: HOY, diasAlerta: 30 },
    );

    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      loteId: 'lote-v',
      estado: 'VENCIDO',
      diasRestantes: -2,
      cantidadDisponible: 10,
      productoNombre: 'Arroz',
    });
  });

  it('incluye el lote que vence hoy como por vencer', () => {
    const alertas = calcularAlertasVencimientoLotes(
      [crearLote({ fechaVencimiento: new Date('2026-11-03T00:00:00.000Z') })],
      { hoy: HOY, diasAlerta: 30 },
    );

    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ estado: 'POR_VENCER', diasRestantes: 0 });
  });

  it('incluye los lotes que vencen dentro de la ventana configurada', () => {
    const alertas = calcularAlertasVencimientoLotes(
      [crearLote({ fechaVencimiento: new Date('2026-11-13T00:00:00.000Z') })],
      { hoy: HOY, diasAlerta: 30 },
    );

    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ estado: 'POR_VENCER', diasRestantes: 10 });
  });

  it('excluye los lotes que vencen fuera de la ventana configurada', () => {
    const alertas = calcularAlertasVencimientoLotes(
      [crearLote({ fechaVencimiento: new Date('2026-12-15T00:00:00.000Z') })],
      { hoy: HOY, diasAlerta: 30 },
    );

    expect(alertas).toHaveLength(0);
  });

  it('excluye lotes sin vencimiento y lotes agotados', () => {
    const alertas = calcularAlertasVencimientoLotes(
      [
        crearLote({ id: 'sin-fecha', fechaVencimiento: null }),
        crearLote({ id: 'agotado', cantidadDisponible: 0 }),
      ],
      { hoy: HOY, diasAlerta: 30 },
    );

    expect(alertas).toHaveLength(0);
  });

  it('ordena las alertas por urgencia y luego por código', () => {
    const alertas = calcularAlertasVencimientoLotes(
      [
        crearLote({ id: 'b', codigo: 'B-2', fechaVencimiento: new Date('2026-11-10T00:00:00.000Z') }),
        crearLote({ id: 'a', codigo: 'A-1', fechaVencimiento: new Date('2026-11-10T00:00:00.000Z') }),
        crearLote({ id: 'c', codigo: 'C-3', fechaVencimiento: new Date('2026-11-05T00:00:00.000Z') }),
      ],
      { hoy: HOY, diasAlerta: 30 },
    );

    expect(alertas.map((alerta) => alerta.loteId)).toEqual(['c', 'a', 'b']);
  });

  it('respeta la ventana menor configurada por el tenant', () => {
    const lotes = [
      crearLote({ id: 'diez', fechaVencimiento: new Date('2026-11-13T00:00:00.000Z') }),
      crearLote({ id: 'cinco', fechaVencimiento: new Date('2026-11-08T00:00:00.000Z') }),
    ];

    const alertas = calcularAlertasVencimientoLotes(lotes, { hoy: HOY, diasAlerta: 7 });

    expect(alertas.map((alerta) => alerta.loteId)).toEqual(['cinco']);
  });
});
