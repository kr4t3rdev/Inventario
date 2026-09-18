import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/productos/hooks/use-productos', () => ({
  useProductos: () => ({ productos: [], isLoading: false, error: undefined }),
}))

import { VentasTable } from './ventas-table'
import type { Venta } from '@/app/models/model'

const venta: Venta = {
  ventaId: 'v-1',
  cantidad: 2,
  puntoDeVentaId: 'pv-1',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  total: 100,
  items: [{ id: 'i-1', ventaId: 'v-1', productoId: 'p-1', cantidad: 1, precioUnitario: 50, total: 50 }],
}

describe('VentasTable acciones accesibles', () => {
  it('los botones de acciones icon-only exponen aria-label', async () => {
    const onDelete = vi.fn()
    render(<VentasTable ventas={[venta]} isLoading={false} error={undefined} onDelete={onDelete} />)

    const editarBtn = await screen.findByRole('link', { name: 'Editar venta' })
    expect(editarBtn).toBeInTheDocument()
    expect(editarBtn.getAttribute('href')).toBe('/busy/sales/editar/v-1')

    const eliminarBtn = await screen.findByRole('button', { name: 'Eliminar venta' })
    expect(eliminarBtn).toBeInTheDocument()
    eliminarBtn.click()
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('v-1'))
  })
})
