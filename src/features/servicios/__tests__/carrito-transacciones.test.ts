import { describe, expect, it } from 'vitest';
import {
  buildVentaPayload,
  buildCompraPayload,
  resolveCartMode,
  esCarritoCompraUniforme,
} from '../lib/carrito-transacciones';

describe('buildVentaPayload', () => {
  it('construye lineas venta desde el carrito', () => {
    const items = [
      { servicioId: 's-1', precio: 5000, costo: 1000, cantidad: 2 },
    ];
    const payload = buildVentaPayload(items, { clienteId: 'c-1', observaciones: 'nota' });

    expect(payload.lineas).toHaveLength(1);
    expect(payload.lineas[0]).toMatchObject({
      tipoLinea: 'SERVICIO',
      servicioId: 's-1',
      cantidad: 2,
      precioUnitario: 5000,
      costo: 1000,
    });
    expect(payload.clienteId).toBe('c-1');
  });

  it('sin cliente queda null (no se fuerza)', () => {
    const payload = buildVentaPayload(
      [{ servicioId: 's-1', precio: 1000, costo: 0, cantidad: 1 }],
      {},
    );
    expect(payload.clienteId).toBeNull();
  });
});

describe('buildCompraPayload', () => {
  it('una línea del carrito -> una compra de servicio de la cantidad del ítem', () => {
    const payload = buildCompraPayload(
      { servicioId: 's-2', precio: 100, costo: 80, cantidad: 2 },
      { proveedorId: 'v-1', numeroFactura: 'F-1' },
    );
    // La compra respeta la cantidad del ítem y el costo actual del servicio
    expect(payload.cantidad).toBe(2);
    expect(payload.servicioId).toBe('s-2');
    expect(payload.proveedorId).toBe('v-1');
    expect(payload.formaPago).toBe('PAGO_COMPLETO');
  });

  it('defaults: sin proveedor/factura/formaPago -> PAGO_COMPLETO/PAGADA', () => {
    const payload = buildCompraPayload(
      { servicioId: 's-9', precio: 1000, costo: 500, cantidad: 3 },
      {},
    );
    expect(payload.formaPago).toBe('PAGO_COMPLETO');
    expect(payload.estado).toBe('PAGADA');
  });
});

describe('resolveCartMode', () => {
  it('modo COMPRA si hay proveedorId', () => {
    expect(resolveCartMode([], { proveedorId: 'v-1' })).toBe('COMPRA');
  });
  it('modo VENTA por defecto', () => {
    expect(resolveCartMode([], {})).toBe('VENTA');
  });
});

describe('esCarritoCompraUniforme', () => {
  it('true si todas las monedas coinciden', () => {
    expect(
      esCarritoCompraUniforme([
        { servicioId: 'a', precio: 100, costo: 0, cantidad: 1 },
        { servicioId: 'b', precio: 100, costo: 0, cantidad: 1, moneda: 'CUP' },
      ]),
    ).toBe(true);
  });

  it('false si hay mezcla', () => {
    expect(
      esCarritoCompraUniforme([
        { servicioId: 'a', precio: 100, costo: 0, cantidad: 1, moneda: 'CUP' },
        { servicioId: 'b', precio: 100, costo: 0, cantidad: 1, moneda: 'USD' },
      ]),
    ).toBe(false);
  });
});
