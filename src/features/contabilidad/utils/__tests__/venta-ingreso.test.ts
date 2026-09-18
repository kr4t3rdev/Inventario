import { describe, expect, it } from "vitest";
import { calcularIngresoVenta, type VentaParaIngreso } from "@/features/contabilidad/utils/venta-ingreso";

describe("calcularIngresoVenta", () => {
  it("usa la suma de items.total cuando la venta tiene items (histórico confiable)", () => {
    const ventas: VentaParaIngreso[] = [
      {
        ventaId: "v1",
        total: 9999, // debe ignorarse cuando hay items
        items: [
          { id: "i1", total: 500 },
          { id: "i2", total: 300 },
        ],
      },
    ];

    // 500 + 300 = 800 (NO 9999)
    expect(calcularIngresoVenta(ventas)).toBe(800);
  });

  it("usa v.total cuando la venta no tiene items (legacy)", () => {
    const ventas: VentaParaIngreso[] = [
      { ventaId: "v1", total: 1000, items: [] },
    ];

    expect(calcularIngresoVenta(ventas)).toBe(1000);
  });

  it("devuelve 0 cuando la venta no tiene items y v.total es null (sin distorsión por precio actual)", () => {
    // El bug anterior hacía: v.total ?? producto.precioVenta * v.cantidad
    // que distorsionaba ingresos históricos con precios actuales.
    // La nueva lógica devuelve 0 en este caso (mejor sub-registrar que inventar).
    const ventas: VentaParaIngreso[] = [
      { ventaId: "v1", total: null, items: [] },
    ];

    expect(calcularIngresoVenta(ventas)).toBe(0);
  });

  it("usa items aunque v.total sea null (no devuelve 0 ni usa v.total)", () => {
    const ventas: VentaParaIngreso[] = [
      {
        ventaId: "v1",
        total: null,
        items: [{ id: "i1", total: 750 }],
      },
    ];

    expect(calcularIngresoVenta(ventas)).toBe(750);
  });

  it("suma el ingreso de múltiples ventas", () => {
    const ventas: VentaParaIngreso[] = [
      { ventaId: "v1", total: 100, items: [] },
      { ventaId: "v2", total: null, items: [{ id: "i1", total: 200 }, { id: "i2", total: 50 }] },
      { ventaId: "v3", total: 300, items: [{ id: "i1", total: 999 }] }, // usa items, ignora v.total
      { ventaId: "v4", total: null, items: [] }, // 0
    ];

    // 100 + 250 + 999 + 0 = 1349
    expect(calcularIngresoVenta(ventas)).toBe(1349);
  });

  it("devuelve 0 cuando el array está vacío", () => {
    expect(calcularIngresoVenta([])).toBe(0);
  });
});
