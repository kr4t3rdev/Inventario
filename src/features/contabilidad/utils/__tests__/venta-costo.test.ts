import { describe, expect, it } from "vitest";
import { calcularCostoVenta, type VentaParaCosto } from "@/features/contabilidad/utils/venta-costo";

describe("calcularCostoVenta", () => {
  it("usa el precioUnitario histórico de las PurchaseAllocations FIFO cuando existen", () => {
    const ventas: VentaParaCosto[] = [
      {
        ventaId: "v1",
        cantidad: 0, // legacy field, ignorado cuando hay items
        producto: { precioCosto: 9999 }, // costo actual (NO debe usarse)
        items: [
          {
            id: "vi1",
            cantidad: 10,
            producto: { precioCosto: 9999 },
            allocations: [
              {
                id: "a1",
                cantidad: 6,
                compraDocumentoItem: { precioUnitario: 20 },
              },
              {
                id: "a2",
                cantidad: 4,
                compraDocumentoItem: { precioUnitario: 25 },
              },
            ],
          },
        ],
      },
    ];

    // 6 * 20 + 4 * 25 = 120 + 100 = 220
    expect(calcularCostoVenta(ventas)).toBe(220);
  });

  it("cae al precioCosto actual del producto cuando un VentaItem no tiene allocations", () => {
    const ventas: VentaParaCosto[] = [
      {
        ventaId: "v1",
        cantidad: 0,
        producto: { precioCosto: 0 },
        items: [
          {
            id: "vi1",
            cantidad: 5,
            producto: { precioCosto: 30 },
            allocations: [],
          },
        ],
      },
    ];

    // 5 * 30 = 150
    expect(calcularCostoVenta(ventas)).toBe(150);
  });

  it("completa con precioCosto actual la cantidad NO cubierta por las allocations", () => {
    // Caso: VentaItem.cantidad = 10, pero las allocations suman 7
    // → 7 unidades al costo histórico, 3 al precioCosto actual
    const ventas: VentaParaCosto[] = [
      {
        ventaId: "v1",
        cantidad: 0,
        producto: { precioCosto: 0 },
        items: [
          {
            id: "vi1",
            cantidad: 10,
            producto: { precioCosto: 50 },
            allocations: [
              {
                id: "a1",
                cantidad: 7,
                compraDocumentoItem: { precioUnitario: 20 },
              },
            ],
          },
        ],
      },
    ];

    // 7 * 20 + 3 * 50 = 140 + 150 = 290
    expect(calcularCostoVenta(ventas)).toBe(290);
  });

  it("soporta ventas legacy (sin items) usando producto.precioCosto * venta.cantidad", () => {
    const ventas: VentaParaCosto[] = [
      {
        ventaId: "v1",
        cantidad: 4,
        producto: { precioCosto: 12 },
        items: [],
      },
    ];

    // 4 * 12 = 48
    expect(calcularCostoVenta(ventas)).toBe(48);
  });

  it("soporta ventas legacy sin producto (devuelve 0)", () => {
    const ventas: VentaParaCosto[] = [
      {
        ventaId: "v1",
        cantidad: 4,
        producto: null,
        items: [],
      },
    ];

    expect(calcularCostoVenta(ventas)).toBe(0);
  });

  it("suma el costo de múltiples ventas y múltiples items", () => {
    const ventas: VentaParaCosto[] = [
      {
        ventaId: "v1",
        cantidad: 0,
        producto: { precioCosto: 0 },
        items: [
          {
            id: "vi1",
            cantidad: 3,
            producto: { precioCosto: 0 },
            allocations: [{ id: "a1", cantidad: 3, compraDocumentoItem: { precioUnitario: 10 } }],
          },
          {
            id: "vi2",
            cantidad: 2,
            producto: { precioCosto: 50 },
            allocations: [],
          },
        ],
      },
      {
        ventaId: "v2",
        cantidad: 5,
        producto: { precioCosto: 8 },
        items: [],
      },
    ];

    // 3*10 + 2*50 + 5*8 = 30 + 100 + 40 = 170
    expect(calcularCostoVenta(ventas)).toBe(170);
  });

  it("devuelve 0 cuando el array de ventas está vacío", () => {
    expect(calcularCostoVenta([])).toBe(0);
  });
});
