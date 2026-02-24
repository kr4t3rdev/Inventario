import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { StockBajoTable } from '../stock-bajo-table'

// Mock the dashboard API hook
const mockUseGetDashboardStatsQuery = vi.fn()

vi.mock('@/lib/redux/services/dashboardApi', () => ({
  useGetDashboardStatsQuery: () => mockUseGetDashboardStatsQuery(),
}))

// Create a mock store
const createMockStore = () => configureStore({
  reducer: {
    // Add minimal reducer for testing
    test: (state = {}) => state,
  },
})

const renderWithProvider = (component: React.ReactElement) => {
  const store = createMockStore()
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  )
}

describe('StockBajoTable - Minimum Stock Integration', () => {
  it('should display loading state correctly', () => {
    mockUseGetDashboardStatsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    renderWithProvider(<StockBajoTable />)

    // Should show skeleton loading elements
    expect(screen.getByText('Productos con Stock Bajo')).toBeInTheDocument()
    expect(screen.getByText('Productos que requieren reposición según sus umbrales configurados')).toBeInTheDocument()
  })

  it('should display error state correctly', () => {
    mockUseGetDashboardStatsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Network error' },
    })

    renderWithProvider(<StockBajoTable />)

    expect(screen.getByText('Productos con Stock Bajo')).toBeInTheDocument()
    expect(screen.getByText('Error al cargar productos. Intente nuevamente más tarde.')).toBeInTheDocument()
  })

  it('should display empty state when no low stock products', () => {
    mockUseGetDashboardStatsQuery.mockReturnValue({
      data: {
        productosStockBajo: [],
      },
      isLoading: false,
      error: null,
    })

    renderWithProvider(<StockBajoTable />)

    expect(screen.getByText('¡Excelente!')).toBeInTheDocument()
    expect(screen.getByText('Todos los productos tienen stock suficiente según sus umbrales configurados')).toBeInTheDocument()
  })

  it('should display products with custom minimum stock correctly', () => {
    const mockData = {
      productosStockBajo: [
        {
          id: 'prod1',
          nombre: 'Producto A',
          stockTotal: 5,
          stockMinimo: 10,
          diferencia: 5,
          umbralUsado: 10,
          categoria: { nombre: 'Categoria 1' },
          unidad: { simbolo: 'pcs' }
        },
        {
          id: 'prod2',
          nombre: 'Producto B',
          stockTotal: 15,
          stockMinimo: 20,
          diferencia: 5,
          umbralUsado: 20,
          categoria: { nombre: 'Categoria 2' },
          unidad: { simbolo: 'kg' }
        }
      ]
    }

    mockUseGetDashboardStatsQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<StockBajoTable />)

    // Check table headers
    expect(screen.getByText('Producto')).toBeInTheDocument()
    expect(screen.getByText('Categoría')).toBeInTheDocument()
    expect(screen.getByText('Stock Actual')).toBeInTheDocument()
    expect(screen.getByText('Stock Mínimo')).toBeInTheDocument()
    expect(screen.getByText('Diferencia')).toBeInTheDocument()
    expect(screen.getByText('Estado')).toBeInTheDocument()

    // Check product data
    expect(screen.getByText('Producto A')).toBeInTheDocument()
    expect(screen.getByText('Producto B')).toBeInTheDocument()
    expect(screen.getByText('Categoria 1')).toBeInTheDocument()
    expect(screen.getByText('Categoria 2')).toBeInTheDocument()

    // Check stock values
    expect(screen.getByText('5 pcs')).toBeInTheDocument()
    expect(screen.getByText('15 kg')).toBeInTheDocument()

    // Check minimum stock display (custom values)
    expect(screen.getByText('10 pcs')).toBeInTheDocument()
    expect(screen.getByText('20 kg')).toBeInTheDocument()

    // Check difference values
    expect(screen.getByText('-5 pcs')).toBeInTheDocument()
    expect(screen.getByText('-5 kg')).toBeInTheDocument()
  })

  it('should display products with default minimum stock correctly', () => {
    const mockData = {
      productosStockBajo: [
        {
          id: 'prod1',
          nombre: 'Producto A',
          stockTotal: 8,
          stockMinimo: 0, // No custom minimum set
          diferencia: 2,
          umbralUsado: 10, // Default threshold used
          categoria: { nombre: 'Categoria 1' },
          unidad: { simbolo: 'pcs' }
        }
      ]
    }

    mockUseGetDashboardStatsQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<StockBajoTable />)

    // Should show "Por defecto (10)" for products without custom minimum
    expect(screen.getByText('Por defecto (10)')).toBeInTheDocument()
    expect(screen.getByText('8 pcs')).toBeInTheDocument()
    expect(screen.getByText('-2 pcs')).toBeInTheDocument()
  })

  it('should display correct status badges based on stock levels', () => {
    const mockData = {
      productosStockBajo: [
        {
          id: 'prod1',
          nombre: 'Producto Sin Stock',
          stockTotal: 0,
          stockMinimo: 10,
          diferencia: 10,
          umbralUsado: 10,
          categoria: { nombre: 'Categoria 1' },
          unidad: { simbolo: 'pcs' }
        },
        {
          id: 'prod2',
          nombre: 'Producto Crítico',
          stockTotal: 2,
          stockMinimo: 10,
          diferencia: 8,
          umbralUsado: 10,
          categoria: { nombre: 'Categoria 2' },
          unidad: { simbolo: 'pcs' }
        },
        {
          id: 'prod3',
          nombre: 'Producto Bajo',
          stockTotal: 8,
          stockMinimo: 10,
          diferencia: 2,
          umbralUsado: 10,
          categoria: { nombre: 'Categoria 3' },
          unidad: { simbolo: 'pcs' }
        }
      ]
    }

    mockUseGetDashboardStatsQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<StockBajoTable />)

    // Check status badges
    expect(screen.getByText('Sin Stock')).toBeInTheDocument()
    expect(screen.getByText('Crítico')).toBeInTheDocument()
    expect(screen.getByText('Bajo')).toBeInTheDocument()
  })

  it('should display alert message with correct count', () => {
    const mockData = {
      productosStockBajo: [
        {
          id: 'prod1',
          nombre: 'Producto A',
          stockTotal: 5,
          stockMinimo: 10,
          diferencia: 5,
          umbralUsado: 10,
          categoria: { nombre: 'Categoria 1' },
          unidad: { simbolo: 'pcs' }
        },
        {
          id: 'prod2',
          nombre: 'Producto B',
          stockTotal: 3,
          stockMinimo: 8,
          diferencia: 5,
          umbralUsado: 8,
          categoria: { nombre: 'Categoria 2' },
          unidad: { simbolo: 'kg' }
        }
      ]
    }

    mockUseGetDashboardStatsQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<StockBajoTable />)

    expect(screen.getByText('2 producto(s) requieren reposición inmediata')).toBeInTheDocument()
  })

  it('should handle mixed scenarios with custom and default minimums', () => {
    const mockData = {
      productosStockBajo: [
        {
          id: 'prod1',
          nombre: 'Producto Custom',
          stockTotal: 5,
          stockMinimo: 15,
          diferencia: 10,
          umbralUsado: 15,
          categoria: { nombre: 'Categoria 1' },
          unidad: { simbolo: 'pcs' }
        },
        {
          id: 'prod2',
          nombre: 'Producto Default',
          stockTotal: 7,
          stockMinimo: 0,
          diferencia: 3,
          umbralUsado: 10,
          categoria: { nombre: 'Categoria 2' },
          unidad: { simbolo: 'kg' }
        }
      ]
    }

    mockUseGetDashboardStatsQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<StockBajoTable />)

    // Custom minimum product
    expect(screen.getByText('Producto Custom')).toBeInTheDocument()
    expect(screen.getByText('15 pcs')).toBeInTheDocument()
    expect(screen.getByText('-10 pcs')).toBeInTheDocument()

    // Default minimum product
    expect(screen.getByText('Producto Default')).toBeInTheDocument()
    expect(screen.getByText('Por defecto (10)')).toBeInTheDocument()
    expect(screen.getByText('-3 kg')).toBeInTheDocument()
  })

  it('should display correct difference colors (red for negative, green for positive)', () => {
    const mockData = {
      productosStockBajo: [
        {
          id: 'prod1',
          nombre: 'Producto A',
          stockTotal: 5,
          stockMinimo: 10,
          diferencia: 5, // Positive difference (shortage)
          umbralUsado: 10,
          categoria: { nombre: 'Categoria 1' },
          unidad: { simbolo: 'pcs' }
        }
      ]
    }

    mockUseGetDashboardStatsQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<StockBajoTable />)

    // Find the difference cell and check its color class
    const differenceCell = screen.getByText('-5 pcs')
    expect(differenceCell).toHaveClass('text-red-600')
  })
})