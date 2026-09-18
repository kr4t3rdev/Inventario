import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockGetProductosMargenBajoAction = vi.fn()

vi.mock('@/features/ficha-costo/actions-alertas', () => ({
  getProductosMargenBajoAction: (...args: unknown[]) => mockGetProductosMargenBajoAction(...args),
}))

import { MargenBajoTable } from '../margen-bajo-table'

describe('MargenBajoTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProductosMargenBajoAction.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'prod-1',
          nombre: 'Harina',
          codigoInterno: 'H-01',
          precioVenta: 100,
          precioCosto: 80,
          margenPorcentaje: 20,
          estado: 'SALUDABLE',
        },
      ],
    })
  })

  it('renderiza los productos cuando la acción devuelve success/data', async () => {
    render(<MargenBajoTable />)

    await waitFor(() => {
      expect(screen.getByText('Harina')).toBeInTheDocument()
    })

    expect(screen.getByText('H-01')).toBeInTheDocument()
    expect(mockGetProductosMargenBajoAction).toHaveBeenCalledWith({ limit: 10 })
  })
})
