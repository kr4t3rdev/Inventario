import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/features/inventario/actions-ajustes', () => ({
  createAjusteAction: vi.fn(),
  anularAjusteAction: vi.fn(),
  getAjustesAction: vi.fn(),
  getStockParaAjusteAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

import {
  anularAjusteAction,
  createAjusteAction,
  getAjustesAction,
  getStockParaAjusteAction,
} from '@/features/inventario/actions-ajustes'
import { AjustesPageClient } from '@/features/inventario/components/ajustes-page-client'

const productos = [{ id: 'prod-1', nombre: 'Arroz' }] as any[]
const almacenes = [{ almacenId: 'alm-1', nombre: 'Principal' }] as any[]

function renderPage() {
  return render(
    <AjustesPageClient
      productos={productos}
      almacenes={almacenes}
      puntosVenta={[]}
      ajustesIniciales={[]}
    />,
  )
}

/**
 * @description Abre el formulario y completa producto, motivo y ubicación.
 */
function abrirFormulario() {
  fireEvent.click(screen.getByRole('button', { name: /nuevo ajuste/i }))
  fireEvent.change(screen.getByLabelText(/producto/i), { target: { value: 'prod-1' } })
  fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'DANO' } })
  fireEvent.change(screen.getByLabelText(/^ubicación$/i), { target: { value: 'alm-1' } })
}

describe('AjustesPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAjustesAction).mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, limit: 20 },
    } as any)
    vi.mocked(getStockParaAjusteAction).mockResolvedValue({
      success: true,
      data: { cantidad: 8, cantidadDisponible: 8 },
    } as any)
  })

  it('crea un ajuste con motivo de catálogo y muestra la fila', async () => {
    vi.mocked(createAjusteAction).mockResolvedValue({
      success: true,
      data: {
        id: 'aj-1',
        motivo: 'DANO',
        diferencia: -3,
        costoTotal: -360,
        estado: 'APLICADO',
        cantidadTeorica: 10,
        cantidadContada: 7,
      },
    } as any)

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /nuevo ajuste/i }))
    fireEvent.change(screen.getByLabelText(/producto/i), { target: { value: 'prod-1' } })
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'DANO' } })
    fireEvent.change(screen.getByLabelText(/^ubicación$/i), { target: { value: 'alm-1' } })
    fireEvent.change(screen.getByLabelText(/cantidad contada/i), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: /aplicar ajuste/i }))

    await waitFor(() => {
      expect(createAjusteAction).toHaveBeenCalledWith(
        expect.objectContaining({
          productoId: 'prod-1',
          motivo: 'DANO',
          cantidadContada: 7,
          tipoUbicacion: 'almacen',
          ubicacionId: 'alm-1',
        }),
      )
    })
  })

  it('consulta el stock del producto en la ubicación seleccionada', async () => {
    renderPage()
    abrirFormulario()

    await waitFor(() => {
      expect(getStockParaAjusteAction).toHaveBeenCalledWith({
        productoId: 'prod-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
      })
    })
  })

  it('muestra el stock actual y cuántas unidades se descontarán', async () => {
    renderPage()
    abrirFormulario()

    await waitFor(() => {
      expect(screen.getByText(/stock actual en esta ubicación/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/cantidad contada/i), { target: { value: '2' } })

    await waitFor(() => {
      expect(screen.getByText(/se descontarán 6 unidades/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/el stock quedará en 2/i)).toBeInTheDocument()
  })

  it('aclara que se sumarán unidades cuando la cantidad contada es mayor', async () => {
    renderPage()
    abrirFormulario()

    await waitFor(() => {
      expect(screen.getByText(/stock actual en esta ubicación/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/cantidad contada/i), { target: { value: '10' } })

    await waitFor(() => {
      expect(screen.getByText(/se sumarán 2 unidades/i)).toBeInTheDocument()
    })
  })

  it('bloquea el envío y explica cuando no hay diferencia con el stock actual', async () => {
    renderPage()
    abrirFormulario()

    await waitFor(() => {
      expect(screen.getByText(/stock actual en esta ubicación/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/cantidad contada/i), { target: { value: '8' } })

    await waitFor(() => {
      expect(screen.getByText(/no hay diferencia que ajustar/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /aplicar ajuste/i })).toBeDisabled()
  })

  it('explica que la cantidad contada fija el stock de la ubicación', async () => {
    renderPage()
    abrirFormulario()

    // Se espera la consulta de stock para que su resolución no actualice el
    // estado fuera de act() al terminar el test.
    await waitFor(() => {
      expect(getStockParaAjusteAction).toHaveBeenCalled()
    })

    expect(
      screen.getByText(/unidades contadas en el conteo físico/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/la diferencia contra el stock actual/i)).toBeInTheDocument()
  })

  it('anula un ajuste aplicado previa confirmación', async () => {
    vi.mocked(anularAjusteAction).mockResolvedValue({ success: true } as any)

    render(
      <AjustesPageClient
        productos={productos}
        almacenes={almacenes}
        puntosVenta={[]}
        ajustesIniciales={[
          {
            id: 'aj-1',
            productoId: 'prod-1',
            motivo: 'DANO',
            tipoUbicacion: 'almacen',
            ubicacionId: 'alm-1',
            diferencia: -3,
            costoTotal: -360,
            estado: 'APLICADO',
            cantidadTeorica: 10,
            cantidadContada: 7,
            createdAt: new Date().toISOString(),
          },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /anular/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    await waitFor(() => {
      expect(anularAjusteAction).toHaveBeenCalledWith('aj-1')
    })
  })
})
