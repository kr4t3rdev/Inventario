/**
 * @description Tests de la función pura resumirCarritoPorMoneda.
 * Regla de negocio: nunca sumar importes de monedas distintas; el resumen
 * expone totales/márgenes agrupados por moneda.
 */
import { describe, it, expect } from 'vitest';
import { resumirCarritoPorMoneda } from '../lib/carrito-resumen';

interface ItemCarrito {
  nombre: string;
  precio: number;
  costo: number;
  cantidad: number;
  moneda?: string;
}

describe('resumirCarritoPorMoneda', () => {
  const base: ItemCarrito[] = [
    { nombre: 'Instalación AC', precio: 5000, costo: 2000, cantidad: 1, moneda: 'CUP' },
    { nombre: 'Mantenimiento', precio: 3000, costo: 1000, cantidad: 2, moneda: 'CUP' },
    { nombre: 'Diseño web', precio: 100, costo: 20, cantidad: 3, moneda: 'USD' },
  ];

  it('agrupa totales por moneda sin mezclar importes', () => {
    const resumen = resumirCarritoPorMoneda(base);

    expect(Object.keys(resumen.grupos).sort()).toEqual(['CUP', 'USD']);
    expect(resumen.grupos.CUP.total).toBe(11000); // 5000 + 6000
    expect(resumen.grupos.CUP.costoTotal).toBe(4000); // 2000 + 2000
    expect(resumen.grupos.USD.total).toBe(300); // 100 * 3
    expect(resumen.grupos.USD.costoTotal).toBe(60);
  });

  it('calcula margen por moneda (nunca cruzado)', () => {
    const resumen = resumirCarritoPorMoneda(base);

    expect(resumen.grupos.CUP.margen).toBe(7000);
    expect(resumen.grupos.USD.margen).toBe(240);
  });

  it('asume CUP cuando el ítem no tiene moneda', () => {
    const sinMoneda: ItemCarrito[] = [{ nombre: 'X', precio: 100, costo: 10, cantidad: 1 }];
    const resumen = resumirCarritoPorMoneda(sinMoneda);

    expect(resumen.grupos.CUP).toBeDefined();
    expect(resumen.grupos.CUP.total).toBe(100);
  });

  it('devuelve carrito vacío con resumen vacío', () => {
    const resumen = resumirCarritoPorMoneda([]);

    expect(Object.keys(resumen.grupos)).toHaveLength(0);
    expect(resumen.esMultiMoneda).toBe(false);
  });

  it('marca esMultiMoneda cuando hay más de una moneda', () => {
    const resumen = resumirCarritoPorMoneda(base);
    expect(resumen.esMultiMoneda).toBe(true);

    const unaSola = resumirCarritoPorMoneda(base.slice(0, 2));
    expect(unaSola.esMultiMoneda).toBe(false);
  });
});
