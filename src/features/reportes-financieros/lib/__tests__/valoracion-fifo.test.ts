import { calcularValuacionFifo } from '../valoracion-fifo';

describe('calcularValuacionFifo', () => {
  it('valora remanentes FIFO por producto con precios de lote distintos', () => {
    // Fixture de la verificación: aceite comprado 10@100 y 10@150, alocado neto 8 y 2
    // (tras devolución) → remanente 2@100 + 8@150 = 1400 para 10 unidades físicas.
    const result = calcularValuacionFifo(
      [
        { id: 'l1', productoId: 'aceite', cantidad: 10, precioUnitario: 100 },
        { id: 'l2', productoId: 'aceite', cantidad: 10, precioUnitario: 150 },
      ],
      new Map([['l1', 8], ['l2', 2]]),
      [{ productoId: 'aceite', precioCosto: 120, stockTotal: 10 }],
    );
    const aceite = result.porProducto[0];
    expect(aceite.valorFifo).toBe(1400);
    expect(aceite.unidadesFifo).toBe(10);
    expect(aceite.tieneEstimado).toBe(false);
    expect(result.valorTotalFifo).toBe(1400);
  });

  it('producto sin lotes → valor estimado a precioCosto completo y marcado', () => {
    const result = calcularValuacionFifo(
      [],
      new Map(),
      [{ productoId: 'legacy', precioCosto: 50, stockTotal: 8 }],
    );
    expect(result.porProducto[0].valorFifo).toBe(400);
    expect(result.porProducto[0].tieneEstimado).toBe(true);
    expect(result.valorTotalEstimado).toBe(400);
  });

  it('déficit de lotes cubre la parte faltante a precioCosto', () => {
    // lotes cubren 4@100; stock físico es 10 → 6 estimadas a 50
    const result = calcularValuacionFifo(
      [{ id: 'l1', productoId: 'p', cantidad: 4, precioUnitario: 100 }],
      new Map(),
      [{ productoId: 'p', precioCosto: 50, stockTotal: 10 }],
    );
    expect(result.porProducto[0].valorFifo).toBe(400 + 300);
    expect(result.porProducto[0].unidadesEstimadas).toBe(6);
  });

  it('lotes que exceden el stock físico se escalan proporcionalmente', () => {
    // lotes cubren 20 (valor 2000 = todos a 100) pero el stock físico es 5
    const result = calcularValuacionFifo(
      [{ id: 'l1', productoId: 'p', cantidad: 20, precioUnitario: 100 }],
      new Map(),
      [{ productoId: 'p', precioCosto: 999, stockTotal: 5 }],
    );
    expect(result.porProducto[0].valorFifo).toBe(500);
    expect(result.porProducto[0].escalado).toBe(true);
    expect(result.porProducto[0].tieneEstimado).toBe(false);
  });

  it('allocation que supera el lote se acota a 0 (datos rotos)', () => {
    const result = calcularValuacionFifo(
      [{ id: 'l1', productoId: 'p', cantidad: 4, precioUnitario: 100 }],
      new Map([['l1', 99]]),
      [{ productoId: 'p', precioCosto: 30, stockTotal: 1 }],
    );
    expect(result.porProducto[0].valorFifo).toBe(30);
    expect(result.porProducto[0].tieneEstimado).toBe(true);
  });

  it('producto sin stock físico no inventa valor aunque tenga lotes', () => {
    const result = calcularValuacionFifo(
      [{ id: 'l1', productoId: 'p', cantidad: 10, precioUnitario: 100 }],
      new Map(),
      [{ productoId: 'p', precioCosto: 50, stockTotal: 0 }],
    );
    expect(result.porProducto[0].valorFifo).toBe(0);
    expect(result.porProducto[0].escalado).toBe(true); // lotes > 0, stock 0 → factor 0
  });
});
