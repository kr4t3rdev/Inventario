import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockGetDashboardRentabilidadAction = vi.fn()

vi.mock('@/features/ficha-costo/actions-alertas', () => ({
  getDashboardRentabilidadAction: (...args: unknown[]) => mockGetDashboardRentabilidadAction(...args),
}))

import { RentabilidadDashboard } from '../rentabilidad-dashboard'

describe('RentabilidadDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDashboardRentabilidadAction.mockResolvedValue({
      success: true,
      data: {
        porCategoria: [
          { categoriaId: 'cat-1', nombre: 'Lácteos', margenPromedio: 32.5, cantidadProductos: 2 },
        ],
        topProductos: [
          {
            id: 'prod-1',
            nombre: 'Leche',
            precioVenta: 100,
            precioCosto: 60,
            margenPorcentaje: 40,
            categoria: 'Lácteos',
            tipo: 'SIMPLE',
          },
        ],
        bottomProductos: [
          {
            id: 'prod-2',
            nombre: 'Queso',
            precioVenta: 100,
            precioCosto: 92,
            margenPorcentaje: 8,
            categoria: 'Lácteos',
            tipo: 'SIMPLE',
          },
        ],
      },
    })
  })

  it('renderiza la rentabilidad cuando la acción devuelve success/data', async () => {
    render(<RentabilidadDashboard />)

    await waitFor(() => {
      expect(screen.getAllByText('Lácteos').length).toBeGreaterThan(0)
    })

    expect(screen.getByText('Leche')).toBeInTheDocument()
    expect(screen.getByText('Queso')).toBeInTheDocument()
  })
})
