import { flattenVentas } from '@/lib/ventas-utils';
import type { Venta } from '@/app/models/model';

const baseVenta = {
  ventaId: 'v1',
  tenantId: 't1',
  total: 100,
  descuento: 0,
  createdAt: '2026-09-16T12:00:00.000Z',
  puntoDeVentaId: 'pv1',
} as unknown as Venta;

describe('flattenVentas — costoFifo por línea', () => {
  it('suma cantidad × costo de lote de cada allocation', () => {
    const ventas = [
      {
        ...baseVenta,
        items: [
          {
            id: 'vi1',
            productoId: 'p1',
            cantidad: 6,
            precioUnitario: 180,
            total: 1080,
            producto: { id: 'p1', nombre: 'Aceite', precioCosto: 120 },
            allocations: [
              { cantidad: 4, compraDocumentoItem: { precioUnitario: 100 } },
              { cantidad: 2, compraDocumentoItem: { precioUnitario: 150 } },
            ],
          },
        ],
      },
    ] as unknown as Venta[];

    const [linea] = flattenVentas(ventas);
    expect(linea.ventaId).toBe('v1');
    expect(linea.costoFifo).toBe(4 * 100 + 2 * 150); // 700
  });

  it('devuelve null cuando la línea no tiene allocations', () => {
    const ventas = [
      {
        ...baseVenta,
        items: [
          {
            id: 'vi1',
            productoId: 'p1',
            cantidad: 2,
            precioUnitario: 140,
            total: 280,
            producto: { id: 'p1', nombre: 'Arroz', precioCosto: 90 },
            allocations: [],
          },
        ],
      },
    ] as unknown as Venta[];

    const [linea] = flattenVentas(ventas);
    expect(linea.costoFifo).toBeNull();
  });

  it('tolera allocations ausentes sin romper (ventas legacy)', () => {
    const ventas = [
      {
        ...baseVenta,
        items: [
          {
            id: 'vi1',
            productoId: 'p1',
            cantidad: 1,
            precioUnitario: 100,
            total: 100,
          },
        ],
      },
    ] as unknown as Venta[];

    const [linea] = flattenVentas(ventas);
    expect(linea.costoFifo).toBeNull();
  });

  it('devolución total: sin allocations pero con devolución que cubre el total → costo 0 (no fallback)', () => {
    // Sin esta regla, una venta devuelta por completo vuelve a estimarse con
    // precioCosto mientras su ingreso ya fue neteado a 0 → ganancia negativa falsa.
    const ventas = [
      {
        ...baseVenta,
        total: 280,
        devoluciones: [{ estado: 'REGISTRADA', total: 280 }],
        items: [
          {
            id: 'vi1',
            productoId: 'p1',
            cantidad: 2,
            precioUnitario: 140,
            total: 280,
            producto: { id: 'p1', nombre: 'Arroz', precioCosto: 90 },
            allocations: [],
          },
        ],
      },
    ] as unknown as Venta[];

    const [linea] = flattenVentas(ventas);
    expect(linea.costoFifo).toBe(0);
  });

  it('devolución parcial mantiene el costo FIFO de las unidades restantes', () => {
    const ventas = [
      {
        ...baseVenta,
        total: 1080,
        devoluciones: [{ estado: 'REGISTRADA', total: 360 }],
        items: [
          {
            id: 'vi1',
            productoId: 'p1',
            cantidad: 6,
            precioUnitario: 180,
            total: 1080,
            producto: { id: 'p1', nombre: 'Aceite', precioCosto: 120 },
            allocations: [{ cantidad: 4, compraDocumentoItem: { precioUnitario: 100 } }], // quedan 4 de 6
          },
        ],
      },
    ] as unknown as Venta[];

    const [linea] = flattenVentas(ventas);
    expect(linea.costoFifo).toBe(400);
  });
});
