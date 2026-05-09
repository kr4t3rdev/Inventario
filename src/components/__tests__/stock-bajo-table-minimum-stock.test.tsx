import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { StockBajoTable } from '../stock-bajo-table'

// Mock the dashboard Server Action
const mockGetDashboardStatsAction = vi.fn()

vi.mock('@/features/dashboard/actions', () => ({
  getDashboardStatsAction: (...args: any[]) => mockGetDashboardStatsAction(...args),
}))

describe('StockBajoTable - Minimum Stock Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display loading state correctly', () => {
    // Return promise that never resolves to test loading state
    mockGetDashboardStatsAction.mockReturnValue(new Promise(() => {}))

    render(<StockBajoTable />)

    expect(screen.getByText('Productos con Stock Bajo')).toBeInTheDocument()
    expect(screen.getByText('Productos que requieren reposición según sus umbrales configurados')).toBeInTheDocument()
  })

  it('should display error state correctly', async () => {
    mockGetDashboardStatsAction.mockResolvedValue({
      success: false,
      error: { message: 'Network error' },
    })

    render(<StockBajoTable />)

    await waitFor(() => {
      expect(screen.getByText('Error al cargar productos. Intente nuevamente más tarde.')).toBeInTheDocument()
    })
  })

  it('should display empty state when no low stock products', async () => {
    mockGetDashboardStatsAction.mockResolvedValue({
      success: true,
      data: { productosStockBajo: [] },
    })

    render(<StockBajoTable />)

    await waitFor(() => {
      expect(screen.getByText('¡Excelente!')).toBeInTheDocument()
      expect(screen.getByText('Todos los productos tienen stock suficiente según sus umbrales configurados')).toBeInTheDocument()
    })
  })

  it('should display products with custom minimum stock correctly', async () => {
    const mockData = {
      productosStockBajo: [
        {
          id: 'prod1', nombre: 'Producto A', stockTotal: 5, stockMinimo: 10,
          diferencia: 5, umbralUsado: 10, categoria: { nombre: 'Categoria 1' }, unidad: { simbolo: 'pcs' }
        },
        {
          id: 'prod2', nombre: 'Producto B', stockTotal: 15, stockMinimo: 20,
          diferencia: 5, umbralUsado: 20, categoria: { nombre: 'Categoria 2' }, unidad: { simbolo: 'kg' }
        }
      ]
    }

    mockGetDashboardStatsAction.mockResolvedValue({ success: true, data: mockData })

    render(<StockBajoTable />)

    await waitFor(() => {
      expect(screen.getByText('Producto A')).toBeInTheDocument()
      expect(screen.getByText('Producto B')).toBeInTheDocument()
      expect(screen.getByText('5 pcs')).toBeInTheDocument()
      expect(screen.getByText('15 kg')).toBeInTheDocument()
      expect(screen.getByText('10 pcs')).toBeInTheDocument()
      expect(screen.getByText('20 kg')).toBeInTheDocument()
      expect(screen.getByText('-5 pcs')).toBeInTheDocument()
      expect(screen.getByText('-5 kg')).toBeInTheDocument()
    })
  })

  it('should display correct status badges based on stock levels', async () => {
    const mockData = {
      productosStockBajo: [
        { id: 'prod1', nombre: 'Producto Sin Stock', stockTotal: 0, stockMinimo: 10, diferencia: 10, umbralUsado: 10, categoria: { nombre: 'Categoria 1' }, unidad: { simbolo: 'pcs' } },
        { id: 'prod2', nombre: 'Producto Crítico', stockTotal: 2, stockMinimo: 10, diferencia: 8, umbralUsado: 10, categoria: { nombre: 'Categoria 2' }, unidad: { simbolo: 'pcs' } },
        { id: 'prod3', nombre: 'Producto Bajo', stockTotal: 8, stockMinimo: 10, diferencia: 2, umbralUsado: 10, categoria: { nombre: 'Categoria 3' }, unidad: { simbolo: 'pcs' } }
      ]
    }

    mockGetDashboardStatsAction.mockResolvedValue({ success: true, data: mockData })

    render(<StockBajoTable />)

    await waitFor(() => {
      expect(screen.getByText('Sin Stock')).toBeInTheDocument()
      expect(screen.getByText('Crítico')).toBeInTheDocument()
      expect(screen.getByText('Bajo')).toBeInTheDocument()
    })
  })

  it('should display alert message with correct count', async () => {
    const mockData = {
      productosStockBajo: [
        { id: 'prod1', nombre: 'Producto A', stockTotal: 5, stockMinimo: 10, diferencia: 5, umbralUsado: 10, categoria: { nombre: 'Categoria 1' }, unidad: { simbolo: 'pcs' } },
        { id: 'prod2', nombre: 'Producto B', stockTotal: 3, stockMinimo: 8, diferencia: 5, umbralUsado: 8, categoria: { nombre: 'Categoria 2' }, unidad: { simbolo: 'kg' } }
      ]
    }

    mockGetDashboardStatsAction.mockResolvedValue({ success: true, data: mockData })

    render(<StockBajoTable />)

    await waitFor(() => {
      expect(screen.getByText('2 producto(s) requieren reposición inmediata')).toBeInTheDocument()
    })
  })

  it('should display products with default minimum stock correctly', async () => {
    const mockData = {
      productosStockBajo: [
        { id: 'prod1', nombre: 'Producto A', stockTotal: 8, stockMinimo: 0, diferencia: 2, umbralUsado: 10, categoria: { nombre: 'Categoria 1' }, unidad: { simbolo: 'pcs' } }
      ]
    }

    mockGetDashboardStatsAction.mockResolvedValue({ success: true, data: mockData })

    render(<StockBajoTable />)

    await waitFor(() => {
      expect(screen.getByText('Por defecto (10)')).toBeInTheDocument()
      expect(screen.getByText('8 pcs')).toBeInTheDocument()
      expect(screen.getByText('-2 pcs')).toBeInTheDocument()
    })
  })

  it('should display correct difference colors', async () => {
    const mockData = {
      productosStockBajo: [
        { id: 'prod1', nombre: 'Producto A', stockTotal: 5, stockMinimo: 10, diferencia: 5, umbralUsado: 10, categoria: { nombre: 'Categoria 1' }, unidad: { simbolo: 'pcs' } }
      ]
    }

    mockGetDashboardStatsAction.mockResolvedValue({ success: true, data: mockData })

    render(<StockBajoTable />)

    await waitFor(() => {
      const diffCell = screen.getByText('-5 pcs')
      expect(diffCell).toHaveClass('text-red-600')
    })
  })
})
