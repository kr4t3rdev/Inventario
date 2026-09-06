import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/features/inventario', () => ({
  getKardexAction: vi.fn(),
}))

import { getKardexAction } from '@/features/inventario'
import { KardexPageClient } from '@/features/inventario/components/kardex-page-client'

const productos = [
  { id: 'prod-1', nombre: 'Arroz' },
  { id: 'prod-2', nombre: 'Frijoles' },
] as any[]

const almacenes = [{ almacenId: 'alm-1', nombre: 'Principal' }] as any[]
const puntosVenta = [{ pvId: 'pv-1', nombre: 'Tienda' }] as any[]

function renderPage() {
  return render(
    <KardexPageClient
      productos={productos}
      almacenes={almacenes}
      puntosVenta={puntosVenta}
    />,
  )
}

describe('KardexPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no consulta sin producto seleccionado y muestra estado vacío', () => {
    renderPage()
    expect(
      screen.getByText(/selecciona un producto y consulta su historial/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /consultar/i }),
    ).toBeDisabled()
    expect(getKardexAction).not.toHaveBeenCalled()
  })

  it('consulta el kardex de un producto y muestra saldos acumulados', async () => {
    vi.mocked(getKardexAction).mockResolvedValue({
      success: true,
      data: {
        saldoInicial: 40,
        total: 2,
        page: 1,
        limit: 100,
        items: [
          {
            id: 'm-1',
            tipoOrigen: 'COMPRA',
            origenId: 'cd-1',
            cantidad: 10,
            saldo: 50,
            costoUnitario: 100,
            createdAt: '2026-02-01T10:00:00.000Z',
          },
          {
            id: 'm-2',
            tipoOrigen: 'VENTA',
            origenId: 'v-1',
            cantidad: -3,
            saldo: 47,
            costoUnitario: 100,
            createdAt: '2026-02-02T10:00:00.000Z',
          },
        ],
      },
    } as any)

    renderPage()

    fireEvent.change(screen.getByLabelText(/producto/i), {
      target: { value: 'prod-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /consultar/i }))

    await waitFor(() => {
      expect(getKardexAction).toHaveBeenCalledWith(
        expect.objectContaining({ productoId: 'prod-1', page: 1 }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/saldo inicial/i)).toBeInTheDocument()
      expect(screen.getByText('COMPRA')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
    })
  })

  it('muestra error si la consulta falla', async () => {
    vi.mocked(getKardexAction).mockResolvedValue({
      success: false,
      error: { message: 'Error de base de datos', code: 'P2028' },
    } as any)

    renderPage()
    fireEvent.change(screen.getByLabelText(/producto/i), {
      target: { value: 'prod-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /consultar/i }))

    await waitFor(() => {
      expect(screen.getByText(/error de base de datos/i)).toBeInTheDocument()
    })
  })
})
