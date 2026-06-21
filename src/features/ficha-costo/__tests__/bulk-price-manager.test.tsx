import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BulkPriceManager } from '../components/bulk-price-manager'

// Mock de dependencias
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

const mockBulkApplyPercentage = vi.fn()
const mockBulkApplyTemplate = vi.fn()

vi.mock('@/features/ficha-costo/actions-bulk', () => ({
  bulkApplyPercentageAction: (...args: any[]) => mockBulkApplyPercentage(...args),
  bulkApplyTemplateAction: (...args: any[]) => mockBulkApplyTemplate(...args),
}))

describe('BulkPriceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe renderizar el título con la cantidad de productos', () => {
    render(<BulkPriceManager productoIds={['prod-1', 'prod-2', 'prod-3']} />)

    expect(screen.getByText('Actualizar 3 productos')).toBeInTheDocument()
  })

  it('debe mostrar mensaje cuando no hay productos', () => {
    render(<BulkPriceManager productoIds={[]} />)

    expect(screen.getByText('Actualizar 0 productos')).toBeInTheDocument()
  })

  it('debe abrir el dialog de porcentaje al hacer click', async () => {
    render(<BulkPriceManager productoIds={['prod-1']} />)

    const button = screen.getByRole('button', { name: /Ajuste porcentual/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText('Porcentaje (%)')).toBeInTheDocument()
    })
  })

  it('debe abrir el dialog de plantilla al hacer click', async () => {
    render(<BulkPriceManager productoIds={['prod-1']} />)

    const button = screen.getByText('Aplicar plantilla')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Aplicar plantilla de costos')).toBeInTheDocument()
      expect(screen.getByLabelText('ID de plantilla')).toBeInTheDocument()
    })
  })

  it('debe llamar a bulkApplyPercentageAction con los datos correctos', async () => {
    mockBulkApplyPercentage.mockResolvedValue({
      success: true,
      data: { updated: 2, skipped: 0, errors: [], results: [] },
    })

    render(<BulkPriceManager productoIds={['prod-1', 'prod-2']} />)

    // Abrir dialog de porcentaje
    fireEvent.click(screen.getByText('Ajuste porcentual'))

    await waitFor(() => {
      const input = screen.getByLabelText('Porcentaje (%)')
      fireEvent.change(input, { target: { value: '10' } })
    })

    // Hacer click en aplicar
    const applyButton = screen.getByText('Aplicar a 2 productos')
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(mockBulkApplyPercentage).toHaveBeenCalledWith({
        porcentaje: 10,
        productoIds: ['prod-1', 'prod-2'],
      })
    })
  })

  it('debe mostrar resultado exitoso después de aplicar', async () => {
    mockBulkApplyPercentage.mockResolvedValue({
      success: true,
      data: { updated: 5, skipped: 1, errors: [], results: [] },
    })

    render(<BulkPriceManager productoIds={['prod-1', 'prod-2']} />)

    fireEvent.click(screen.getByText('Ajuste porcentual'))

    await waitFor(() => {
      const input = screen.getByLabelText('Porcentaje (%)')
      fireEvent.change(input, { target: { value: '15' } })
    })

    fireEvent.click(screen.getByText('Aplicar a 2 productos'))

    await waitFor(() => {
      expect(screen.getByText('Operación completada')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument() // updated
      expect(screen.getByText('1')).toBeInTheDocument() // skipped
    })
  })

  it('debe mostrar errores cuando la acción falla', async () => {
    mockBulkApplyPercentage.mockResolvedValue({
      success: false,
      error: { message: 'Error de validación' },
    })

    render(<BulkPriceManager productoIds={['prod-1']} />)

    fireEvent.click(screen.getByText('Ajuste porcentual'))

    await waitFor(() => {
      const input = screen.getByLabelText('Porcentaje (%)')
      fireEvent.change(input, { target: { value: '10' } })
    })

    fireEvent.click(screen.getByText('Aplicar a 1 productos'))

    await waitFor(() => {
      expect(screen.getByText('Error de validación')).toBeInTheDocument()
    })
  })

  it('debe validar que el porcentaje sea un número', async () => {
    render(<BulkPriceManager productoIds={['prod-1']} />)

    fireEvent.click(screen.getByText('Ajuste porcentual'))

    await waitFor(() => {
      const input = screen.getByLabelText('Porcentaje (%)')
      fireEvent.change(input, { target: { value: 'abc' } })
    })

    fireEvent.click(screen.getByText('Aplicar a 1 productos'))

    await waitFor(() => {
      expect(screen.getByText('Porcentaje inválido')).toBeInTheDocument()
    })

    expect(mockBulkApplyPercentage).not.toHaveBeenCalled()
  })
})
