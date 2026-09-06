import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/features/inventario/actions-ajustes', () => ({
  createAjusteAction: vi.fn(),
  anularAjusteAction: vi.fn(),
  getAjustesAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

import {
  anularAjusteAction,
  createAjusteAction,
  getAjustesAction,
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

describe('AjustesPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAjustesAction).mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, limit: 20 },
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
