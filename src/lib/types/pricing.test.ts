import { describe, expect, it } from 'vitest';
import { getPrecioEfectivo } from './pricing';

describe('pricing helpers', () => {
  it('debe usar precio resuelto cuando existe', () => {
    expect(getPrecioEfectivo({ precioVenta: 100, precioVentaResuelto: 130 })).toBe(130);
  });

  it('debe usar precio base como fallback', () => {
    expect(getPrecioEfectivo({ precioVenta: 100 })).toBe(100);
  });

  it('debe priorizar precio de lista cliente sobre resuelto y base', () => {
    const producto = {
      precioVenta: 100,
      precioVentaResuelto: 110,
      precios: [
        { listaPrecioId: 'lista-vip', precio: 90 },
        { listaPrecioId: 'lista-otra', precio: 120 }
      ]
    };
    expect(getPrecioEfectivo(producto, 'lista-vip')).toBe(90);
  });

  it('debe usar precio resuelto si el cliente no tiene lista', () => {
    const producto = {
      precioVenta: 100,
      precioVentaResuelto: 110,
      precios: [
        { listaPrecioId: 'lista-vip', precio: 90 }
      ]
    };
    expect(getPrecioEfectivo(producto, null)).toBe(110);
  });

  it('debe usar precio resuelto si el producto no tiene precio en la lista del cliente', () => {
    const producto = {
      precioVenta: 100,
      precioVentaResuelto: 110,
      precios: [
        { listaPrecioId: 'lista-otra', precio: 120 }
      ]
    };
    expect(getPrecioEfectivo(producto, 'lista-vip')).toBe(110);
  });
});
