import React from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VentasPendientesTable } from "@/components/contabilidad/ventas-pendientes-table";

const mockUseGetVentasPendientesQuery = vi.fn();
const mockUseGetCuentasPorCobrarQuery = vi.fn();

vi.mock("@/lib/redux/services/contabilidadApi", () => ({
  useGetVentasPendientesQuery: (...args: unknown[]) => mockUseGetVentasPendientesQuery(...args),
}));

vi.mock("@/lib/redux/services/cuentasPorCobrarApi", () => ({
  useGetCuentasPorCobrarQuery: (...args: unknown[]) => mockUseGetCuentasPorCobrarQuery(...args),
}));

/**
 * @description Crea un objeto de respuesta base para la query de ventas pendientes.
 * @param {unknown[]} ventas - Colección de ventas simuladas.
 * @returns {object} Respuesta compatible con el hook RTK Query.
 */
function buildVentasResponse(ventas: unknown[]) {
  return {
    data: {
      ventas,
      pagination: {
        page: 1,
        limit: 50,
        total: ventas.length,
        totalPages: 1,
      },
    },
    isLoading: false,
    error: undefined,
  };
}

describe("VentasPendientesTable", () => {
  beforeEach(() => {
    mockUseGetVentasPendientesQuery.mockReset();
    mockUseGetCuentasPorCobrarQuery.mockReset();
    mockUseGetCuentasPorCobrarQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it("muestra el saldo pendiente parcial en la columna sin reconciliar", () => {
    mockUseGetVentasPendientesQuery.mockReturnValue(
      buildVentasResponse([
        {
          ventaId: "venta-1",
          createdAt: "2026-02-14T10:00:00.000Z",
          puntoDeVenta: { nombre: "PV Central" },
          cantidad: 1,
          total: 1000,
          saldoPendiente: 400,
          reconciliada: false,
          moneda: "CUP",
        },
      ]),
    );

    render(<VentasPendientesTable />);

    const dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows.length).toBeGreaterThan(0);

    const firstRowCells = within(dataRows[0]).getAllByRole("cell");

    expect(firstRowCells[4]).toHaveTextContent("1000");
    expect(firstRowCells[5]).toHaveTextContent("400");
  });

  it("prioriza saldoPendiente también para cuentas por cobrar fusionadas", () => {
    mockUseGetVentasPendientesQuery.mockReturnValue(
      buildVentasResponse([
        {
          ventaId: "venta-cxc-1",
          createdAt: "2026-02-14T10:00:00.000Z",
          puntoDeVenta: null,
          cantidad: 1,
          total: 900,
          saldoPendiente: 250,
          reconciliada: false,
          moneda: "CUP",
          esCuentaPorCobrar: true,
        },
      ]),
    );

    render(<VentasPendientesTable />);

    const dataRows = screen.getAllByRole("row").slice(1);
    const firstRowCells = within(dataRows[0]).getAllByRole("cell");

    expect(firstRowCells[4]).toHaveTextContent("900");
    expect(firstRowCells[5]).toHaveTextContent("250");
  });
});
