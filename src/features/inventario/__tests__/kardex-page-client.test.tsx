import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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
            createdAt: new Date('2026-02-01T10:00:00.000Z'),
          },
          {
            id: 'm-2',
            tipoOrigen: 'VENTA',
            origenId: 'v-1',
            cantidad: -3,
            saldo: 47,
            costoUnitario: 100,
            createdAt: new Date('2026-02-02T10:00:00.000Z'),
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

  it('renderiza el kardex cuando createdAt llega serializado como texto ISO', async () => {
    const createdAt = '2026-10-23T14:30:00.000Z'
    vi.mocked(getKardexAction).mockResolvedValue({
      success: true,
      data: {
        saldoInicial: 12,
        total: 1,
        page: 1,
        limit: 50,
        items: [
          {
            id: 'm-iso',
            tipoOrigen: 'COMPRA',
            origenId: 'compra-iso',
            cantidad: 4,
            saldo: 16,
            costoUnitario: 90,
            createdAt,
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof getKardexAction>>)

    renderPage()
    fireEvent.change(screen.getByLabelText(/producto/i), {
      target: { value: 'prod-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /consultar/i }))

    await waitFor(() => {
      expect(screen.getByText('COMPRA')).toBeInTheDocument()
      expect(screen.getByText('compra-iso')).toBeInTheDocument()
      expect(screen.getByText('16')).toBeInTheDocument()
      expect(screen.getByText(new Date(createdAt).toLocaleString())).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('muestra el estado vacío cuando una consulta válida no devuelve movimientos', async () => {
    vi.mocked(getKardexAction).mockResolvedValue({
      success: true,
      data: {
        saldoInicial: 8,
        total: 0,
        page: 1,
        limit: 50,
        items: [],
      },
    } as unknown as Awaited<ReturnType<typeof getKardexAction>>)

    renderPage()
    fireEvent.change(screen.getByLabelText(/producto/i), {
      target: { value: 'prod-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /consultar/i }))

    expect(await screen.findByText(/sin movimientos para los filtros seleccionados/i))
      .toBeInTheDocument()
    expect(screen.getByText(/saldo inicial: 8/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /exportar csv/i })).toBeDisabled()
  })

  it('envía filtros de ubicación y fecha, y permite avanzar y regresar páginas', async () => {
    const pageOneData = {
      saldoInicial: 0,
      total: 51,
      page: 1,
      limit: 50,
      items: [{
        id: 'm-page-1', tipoOrigen: 'COMPRA', origenId: 'c-1', cantidad: 2,
        saldo: 2, costoUnitario: 30, createdAt: new Date('2026-10-01T10:00:00.000Z'),
      }],
    }
    const pageTwoData = {
      ...pageOneData,
      page: 2,
      items: [{
        id: 'm-page-2', tipoOrigen: 'VENTA', origenId: 'v-2', cantidad: -1,
        saldo: 1, costoUnitario: 30, createdAt: new Date('2026-10-02T10:00:00.000Z'),
      }],
    }
    vi.mocked(getKardexAction)
      .mockResolvedValueOnce({ success: true, data: pageOneData } as unknown as
        Awaited<ReturnType<typeof getKardexAction>>)
      .mockResolvedValueOnce({ success: true, data: pageTwoData } as unknown as
        Awaited<ReturnType<typeof getKardexAction>>)
      .mockResolvedValueOnce({ success: true, data: pageOneData } as unknown as
        Awaited<ReturnType<typeof getKardexAction>>)

    renderPage()
    fireEvent.change(screen.getByLabelText(/producto/i), {
      target: { value: 'prod-1' },
    })
    fireEvent.change(screen.getByLabelText(/tipo de ubicación/i), {
      target: { value: 'almacen' },
    })
    fireEvent.change(screen.getByLabelText('Ubicación'), {
      target: { value: 'alm-1' },
    })
    fireEvent.change(screen.getByLabelText(/desde/i), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText(/hasta/i), {
      target: { value: '2026-10-31' },
    })
    fireEvent.click(screen.getByRole('button', { name: /consultar/i }))

    await waitFor(() => {
      expect(getKardexAction).toHaveBeenNthCalledWith(1, expect.objectContaining({
        productoId: 'prod-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        fechaDesde: expect.any(Date),
        fechaHasta: expect.any(Date),
        page: 1,
      }))
    })
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    await waitFor(() => {
      expect(getKardexAction).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }))
    })
    expect(screen.getByText('v-2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /anterior/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /anterior/i }))
    await waitFor(() => {
      expect(getKardexAction).toHaveBeenNthCalledWith(3, expect.objectContaining({ page: 1 }))
    })
    expect(screen.getByText('c-1')).toBeInTheDocument()
  })

  it('exporta las filas visibles en un CSV descargable', async () => {
    vi.mocked(getKardexAction).mockResolvedValue({
      success: true,
      data: {
        saldoInicial: 5,
        total: 1,
        page: 1,
        limit: 50,
        items: [{
          id: 'm-csv', tipoOrigen: 'COMPRA', origenId: 'c-csv', cantidad: 3,
          saldo: 8, costoUnitario: 45, createdAt: new Date('2026-10-03T10:00:00.000Z'),
        }],
      },
    } as unknown as Awaited<ReturnType<typeof getKardexAction>>)

    renderPage()
    fireEvent.change(screen.getByLabelText(/producto/i), {
      target: { value: 'prod-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /consultar/i }))
    expect(await screen.findByText('c-csv')).toBeInTheDocument()

    const createObjectURL = vi.fn(() => 'blob:kardex-test')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const link = document.createElement('a')
    vi.spyOn(link, 'click').mockImplementation(() => undefined)
    vi.spyOn(document, 'createElement').mockReturnValue(link)

    fireEvent.click(screen.getByRole('button', { name: /exportar csv/i }))

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(link.download).toMatch(/^kardex-prod-1-/)
    expect(link.href).toBe('blob:kardex-test')
    expect(link.click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:kardex-test')
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

  it('muestra error si la acción responde éxito sin datos', async () => {
    vi.mocked(getKardexAction).mockResolvedValue({
      success: true,
    } as Awaited<ReturnType<typeof getKardexAction>>)

    renderPage()
    fireEvent.change(screen.getByLabelText(/producto/i), {
      target: { value: 'prod-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /consultar/i }))

    await waitFor(() => {
      expect(screen.getByText(/no se pudo cargar el kardex/i)).toBeInTheDocument()
    })
  })
})
