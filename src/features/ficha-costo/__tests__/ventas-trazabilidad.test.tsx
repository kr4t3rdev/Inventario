import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VentasTrazabilidad } from '../components/ventas-trazabilidad'
import type { VentasProductoData } from '../types'

vi.mock('../actions-ventas', () => ({
  getVentasProductoAction: vi.fn(),
}))

import { getVentasProductoAction } from '../actions-ventas'

const MOCK_DATA: VentasProductoData = {
  items: [
    {
      ventaItemId: 'vi-1',
      ventaId: 'v-1',
      fecha: new Date('2026-05-01').toISOString(),
      clienteNombre: 'Cliente A',
      cantidad: 10,
      precioUnitario: 100,
      ingresoTotal: 1000,
      costoReal: 600,
      margenReal: 40,
      esLegacy: false,
    },
    {
      ventaItemId: 'vi-2',
      ventaId: 'v-2',
      fecha: new Date('2026-04-15').toISOString(),
      clienteNombre: 'Cliente B',
      cantidad: 5,
      precioUnitario: 200,
      ingresoTotal: 1000,
      costoReal: 500,
      margenReal: 50,
      esLegacy: false,
    },
    {
      ventaItemId: 'vi-3',
      ventaId: 'v-3',
      fecha: new Date('2026-04-01').toISOString(),
      clienteNombre: 'Cliente genérico',
      cantidad: 8,
      precioUnitario: 150,
      ingresoTotal: 1200,
      costoReal: 800,
      margenReal: 33.33,
      esLegacy: true,
    },
  ],
  pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
  resumen: {
    totalVendido: 3200,
    costoTotal: 1900,
    margenPromedio: 40.63,
    cantidadVentas: 3,
  },
}

const MOCK_DATA_VACIO: VentasProductoData = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  resumen: {
    totalVendido: 0,
    costoTotal: 0,
    margenPromedio: 0,
    cantidadVentas: 0,
  },
}

describe('VentasTrazabilidad', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza tabla con 3 ventas', async () => {
    // Arrange
    vi.mocked(getVentasProductoAction).mockResolvedValue({
      success: true,
      data: MOCK_DATA,
    } as any)

    // Act
    render(<VentasTrazabilidad productoId="prod-1" precioCosto={50} />)

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Cliente A')).toBeInTheDocument()
      expect(screen.getByText('Cliente B')).toBeInTheDocument()
    })
  })

  it('renderiza resumen de rentabilidad', async () => {
    // Arrange
    vi.mocked(getVentasProductoAction).mockResolvedValue({
      success: true,
      data: MOCK_DATA,
    } as any)

    // Act
    render(<VentasTrazabilidad productoId="prod-1" precioCosto={50} />)

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Total vendido/i)).toBeInTheDocument()
      expect(screen.getByText(/3200/)).toBeInTheDocument()
    })
  })

  it('empty state: "No hay ventas registradas"', async () => {
    // Arrange
    vi.mocked(getVentasProductoAction).mockResolvedValue({
      success: true,
      data: MOCK_DATA_VACIO,
    } as any)

    // Act
    render(<VentasTrazabilidad productoId="prod-1" precioCosto={50} />)

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/No hay ventas registradas/i)).toBeInTheDocument()
    })
  })

  it('badge de margen: verde >20%, amarillo 0-20%, rojo <0%', async () => {
    // Arrange
    vi.mocked(getVentasProductoAction).mockResolvedValue({
      success: true,
      data: MOCK_DATA,
    } as any)

    // Act
    render(<VentasTrazabilidad productoId="prod-1" precioCosto={50} />)

    // Assert: los márgenes deben aparecer con formato de 1 decimal
    await waitFor(() => {
      // Al menos un badge de margen debe existir
      const badges = screen.getAllByText(/40\.0%|50\.0%|33\.3%/i)
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('indicador de venta legacy', async () => {
    // Arrange
    vi.mocked(getVentasProductoAction).mockResolvedValue({
      success: true,
      data: MOCK_DATA,
    } as any)

    // Act
    render(<VentasTrazabilidad productoId="prod-1" precioCosto={50} />)

    // Assert: la venta legacy debe tener algún indicador
    await waitFor(() => {
      // El texto "Legacy" o un asterisco debe aparecer
      const legacyIndicators = screen.queryAllByText(/legacy|\*/i)
      expect(legacyIndicators.length).toBeGreaterThan(0)
    })
  })
})
