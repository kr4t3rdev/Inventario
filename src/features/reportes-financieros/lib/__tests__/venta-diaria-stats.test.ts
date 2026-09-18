import {
  calcularCostoTotalDia,
  calcularDevolucionesNetas,
  calcularTicketPromedio,
  contarVentasDistintas,
} from '../venta-diaria-stats';
import type { LineaEstadistica } from '../venta-diaria-stats';

const linea = (over: Partial<LineaEstadistica>): LineaEstadistica => ({
  ventaId: 'v1',
  cantidad: 1,
  totalLinea: 100,
  descuento: 0,
  producto: { precioCosto: 50 },
  ...over,
});

describe('contarVentasDistintas', () => {
  it('cuenta documentos únicos, no líneas', () => {
    // Regresión D-1: 2 ventas (v1 con 2 líneas, v2 con 1) debían mostrar 3.
    const lineas = [linea({ ventaId: 'v1' }), linea({ ventaId: 'v1' }), linea({ ventaId: 'v2' })];
    expect(contarVentasDistintas(lineas)).toBe(2);
  });

  it('retorna 0 sin líneas', () => {
    expect(contarVentasDistintas([])).toBe(0);
  });
});

describe('calcularTicketPromedio', () => {
  it('divide entre documentos de venta + servicios, no entre líneas', () => {
    // 2440 netos entre 2 ventas = 1220 (antes daba 813.33 al dividir entre 3 líneas)
    expect(calcularTicketPromedio(2440, 2, 0)).toBeCloseTo(1220);
  });

  it('incluye servicios en el divisor', () => {
    expect(calcularTicketPromedio(3000, 2, 1)).toBeCloseTo(1000);
  });

  it('devuelve 0 sin transacciones', () => {
    expect(calcularTicketPromedio(0, 0, 0)).toBe(0);
  });
});

describe('calcularCostoTotalDia', () => {
  it('usa el costo FIFO real cuando la línea tiene allocations', () => {
    // V1: aceite 6×180 vendidos; 6 allocations a 100 (lote viejo) → costo 600
    const lineas = [linea({ cantidad: 6, costoFifo: 600 })];
    expect(calcularCostoTotalDia(lineas)).toEqual({ costoTotal: 600, usaFifoCompleto: true });
  });

  it('cae a cantidad × precioCosto cuando no hay allocations', () => {
    const lineas = [linea({ cantidad: 4, costoFifo: null })];
    expect(calcularCostoTotalDia(lineas)).toEqual({ costoTotal: 200, usaFifoCompleto: false });
  });

  it('suma lotes distintos en líneas FIFO mixtas', () => {
    // v2 aceite: 4×100 + 2×150 = 700 FIFO vs 6×120=720 estimado
    const lineas = [linea({ cantidad: 6, costoFifo: 700 })];
    expect(calcularCostoTotalDia(lineas)).toEqual({ costoTotal: 700, usaFifoCompleto: true });
  });

  it('marca usaFifoCompleto=false si alguna línea carece de FIFO', () => {
    const lineas = [linea({ costoFifo: 600 }), linea({ costoFifo: null, cantidad: 2 })];
    const result = calcularCostoTotalDia(lineas);
    expect(result.costoTotal).toBe(600 + 2 * 50);
    expect(result.usaFifoCompleto).toBe(false);
  });

  it('día sin movimientos: costo 0 y sin bandera FIFO', () => {
    expect(calcularCostoTotalDia([])).toEqual({ costoTotal: 0, usaFifoCompleto: false });
  });

  it('costoFifo 0 (devolución total) NO cae al fallback de precioCosto', () => {
    const lineas = [linea({ cantidad: 2, costoFifo: 0 })];
    expect(calcularCostoTotalDia(lineas)).toEqual({ costoTotal: 0, usaFifoCompleto: true });
  });
});

describe('calcularDevolucionesNetas', () => {
  it('suma solo devoluciones REGISTRADAS de los documentos del período', () => {
    const ventas = [
      { devoluciones: [{ estado: 'REGISTRADA', total: 360 }, { estado: 'ANULADA', total: 999 }] },
      { devoluciones: [{ estado: 'REGISTRADA', total: '40' }] },
      { devoluciones: [] },
    ];
    expect(calcularDevolucionesNetas(ventas)).toBe(400);
  });

  it('0 cuando no hay devoluciones', () => {
    expect(calcularDevolucionesNetas([{ devoluciones: [] }, {}])).toBe(0);
  });
});
