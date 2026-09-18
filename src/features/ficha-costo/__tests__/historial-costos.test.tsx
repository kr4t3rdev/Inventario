import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HistorialCostos } from '../components/historial-costos'
import type { HistorialReconciliadoData } from '../types'

vi.mock('../actions-reconciliacion', () => ({
  getHistorialReconciliadoAction: vi.fn(),
}))

import { getHistorialReconciliadoAction } from '../actions-reconciliacion'

const MOCK_DATA_CALCULADO: HistorialReconciliadoData = {
  items: [
    {
      compraDocumentoItemId: 'i-1',
      fecha: new Date('2026-05-01').toISOString(),
      numeroFactura: 'F-001',
      proveedor: 'Proveedor A',
      proveedorId: 'prov-A',
      cantidad: 10,
      precioUnitario: 100,
      totalLinea: 1000,
      enVentanaCPP: true,
      gastoProporcional: 50,
    },
    {
      compraDocumentoItemId: 'i-2',
      fecha: new Date('2025-01-01').toISOString(),
      numeroFactura: 'F-002',
      proveedor: 'Proveedor B',
      proveedorId: 'prov-B',
      cantidad: 5,
      precioUnitario: 200,
      totalLinea: 1000,
      enVentanaCPP: false,
      gastoProporcional: 0,
    },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
  proveedores: [
    {
      proveedorId: 'prov-A',
      proveedorNombre: 'Proveedor A',
      cantidadTotal: 10,
      montoTotal: 1050,
      participacionPorcentaje: 100,
      cantidadItems: 1,
    },
  ],
  estadoCPP: 'CALCULADO',
  advertencias: [],
}

const MOCK_DATA_SIN_DATOS: HistorialReconciliadoData = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  proveedores: [],
  estadoCPP: 'SIN_DATOS',
  advertencias: [],
}

describe('HistorialCostos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza el banner de estado CPP cuando está CALCULADO', async () => {
    // Arrange
    vi.mocked(getHistorialReconciliadoAction).mockResolvedValue({
      success: true,
      data: MOCK_DATA_CALCULADO,
    } as any)

    // Act
    render(<HistorialCostos productoId="prod-1" />)

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/CPP calculado/i)).toBeInTheDocument()
    })
  })

  it('renderiza la tabla de resumen por proveedor', async () => {
    // Arrange
    vi.mocked(getHistorialReconciliadoAction).mockResolvedValue({
      success: true,
      data: MOCK_DATA_CALCULADO,
    } as any)

    // Act
    render(<HistorialCostos productoId="prod-1" />)

    // Assert: el resumen tiene su título y el proveedor aparece
    await waitFor(() => {
      expect(screen.getByText(/Resumen por proveedor/i)).toBeInTheDocument()
    })
    // El proveedor aparece en ambas tablas (items + resumen) — getAllByText
    expect(screen.getAllByText('Proveedor A').length).toBeGreaterThan(0)
  })

  it('renderiza badge "En CPP" en filas de la tabla principal', async () => {
    // Arrange
    vi.mocked(getHistorialReconciliadoAction).mockResolvedValue({
      success: true,
      data: MOCK_DATA_CALCULADO,
    } as any)

    // Act
    render(<HistorialCostos productoId="prod-1" />)

    // Assert
    await waitFor(() => {
      const badges = screen.getAllByText(/en cpp/i)
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('renderiza estado SIN_DATOS cuando no hay compras', async () => {
    // Arrange
    vi.mocked(getHistorialReconciliadoAction).mockResolvedValue({
      success: true,
      data: MOCK_DATA_SIN_DATOS,
    } as any)

    // Act
    render(<HistorialCostos productoId="prod-1" />)

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/sin datos/i)).toBeInTheDocument()
    })
  })
})
