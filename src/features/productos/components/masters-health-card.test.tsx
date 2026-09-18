import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMastersHealthAction, toastError } = vi.hoisted(() => ({
  getMastersHealthAction: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('../actions-health', () => ({ getMastersHealthAction }))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

import { MastersHealthCard } from './masters-health-card'

/**
 * @description Verifica la presentación de salud de datos maestros para administradores.
 * @returns {void}
 */
describe('MastersHealthCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no renderiza ni consulta métricas para un rol no admin', () => {
    const { container } = render(<MastersHealthCard userRole="regularUser" />)

    expect(container).toBeEmptyDOMElement()
    expect(getMastersHealthAction).not.toHaveBeenCalled()
  })

  it('muestra estado crítico cuando faltan categorías', async () => {
    getMastersHealthAction.mockResolvedValue({
      success: true,
      data: {
        metrics: {
          productos: 20,
          categorias: 0,
          unidades: 1,
          proveedores: 3,
          puntosDeVenta: 2,
          listasPrecio: 1,
        },
      },
    })

    render(<MastersHealthCard userRole="admin" />)

    expect(await screen.findByText('Crítico')).toBeInTheDocument()
    expect(screen.getByText('Productos')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('muestra estado bajo cuando hay menos de diez productos con catálogos mínimos completos', async () => {
    getMastersHealthAction.mockResolvedValue({
      success: true,
      data: {
        metrics: {
          productos: 9,
          categorias: 1,
          unidades: 1,
          proveedores: 0,
          puntosDeVenta: 0,
          listasPrecio: 0,
        },
      },
    })

    render(<MastersHealthCard userRole="admin" />)

    expect(await screen.findByText('Bajo')).toBeInTheDocument()
  })

  it('muestra estado saludable con al menos diez productos, categorías y unidades', async () => {
    getMastersHealthAction.mockResolvedValue({
      success: true,
      data: {
        metrics: {
          productos: 10,
          categorias: 1,
          unidades: 1,
          proveedores: 2,
          puntosDeVenta: 1,
          listasPrecio: 1,
        },
      },
    })

    render(<MastersHealthCard userRole="admin" />)

    expect(await screen.findByText('Saludable')).toBeInTheDocument()
    expect(screen.getByText('Listas Precio')).toBeInTheDocument()
  })

  it('notifica un error y muestra estado recuperable si la action falla', async () => {
    getMastersHealthAction.mockResolvedValue({
      success: false,
      error: { message: 'No disponible' },
    })

    render(<MastersHealthCard userRole="admin" />)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Error cargando datos de salud')
    })
    expect(screen.getByText('No se pudieron cargar las métricas de datos maestros.')).toBeInTheDocument()
  })
})
