/**
 * @description Tests de la calculadora pura de totales de oferta (E-3):
 * totales por línea, subtotal, validación de impuestos y total final.
 */
import { describe, it, expect } from 'vitest';

import { calcularTotalesOferta } from '@/features/ofertas/lib/totales-oferta';

describe('E-3 calcularTotalesOferta (pura)', () => {
  it('recalcula el total de cada línea como cantidad × precioUnitario', () => {
    const r = calcularTotalesOferta(
      [
        { cantidad: 2, precioUnitario: 100 },
        { cantidad: 1, precioUnitario: 50 },
      ],
      0,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lineas[0].total).toBe(200);
    expect(r.lineas[1].total).toBe(50);
    expect(r.subtotal).toBe(250);
  });

  it('redondea a 2 decimales los montos de línea y el subtotal', () => {
    const r = calcularTotalesOferta(
      [{ cantidad: 3, precioUnitario: 9.999 }],
      0,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lineas[0].total).toBe(30);
    expect(r.subtotal).toBe(30);
  });

  it('total = subtotal + impuestos declarados', () => {
    const r = calcularTotalesOferta([{ cantidad: 2, precioUnitario: 100 }], 40);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.subtotal).toBe(200);
    expect(r.impuestos).toBe(40);
    expect(r.total).toBe(240);
  });

  it('acepta impuestos iguales al subtotal (tope) y rechaza por encima', () => {
    const alTope = calcularTotalesOferta([{ cantidad: 1, precioUnitario: 200 }], 200);
    expect(alTope.ok).toBe(true);

    const porEncima = calcularTotalesOferta([{ cantidad: 1, precioUnitario: 200 }], 201);
    expect(porEncima).toEqual({
      ok: false,
      code: 'TAX_INVALID',
      message: expect.stringContaining('subtotal'),
    });
  });

  it('rechaza impuestos negativos o no finitos', () => {
    expect(calcularTotalesOferta([{ cantidad: 1, precioUnitario: 10 }], -1)).toMatchObject({
      ok: false,
      code: 'TAX_INVALID',
    });
    expect(
      calcularTotalesOferta([{ cantidad: 1, precioUnitario: 10 }], Number.NaN),
    ).toMatchObject({ ok: false, code: 'TAX_INVALID' });
  });

  it('oferta sin ítems con impuestos 0 es válida; con impuestos > 0 no', () => {
    expect(calcularTotalesOferta([], 0)).toEqual({
      ok: true,
      lineas: [],
      subtotal: 0,
      impuestos: 0,
      total: 0,
    });
    expect(calcularTotalesOferta([], 10)).toMatchObject({ ok: false, code: 'TAX_INVALID' });
  });
});
