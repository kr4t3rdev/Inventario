import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FichaCostoView } from '../components/ficha-costo-view'
import type { FichaCostoData } from '../actions'

// Mockear la action de historial para no tocar Prisma
vi.mock('../actions', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../actions')>()
  return {
    ...mod,
    getHistorialCostosAction: vi.fn(),
    getComposicionCostoAction: vi.fn(),
    getListasPreciosProductoAction: vi.fn(),
  }
})

import {
  getHistorialCostosAction,
  getComposicionCostoAction,
  getListasPreciosProductoAction,
} from '../actions'

const baseData: FichaCostoData = {
  producto: {
    id: 'prod-1',
    nombre: 'Harina 50kg',
    codigoInterno: 'HAR-50',
    tipo: 'SIMPLE',
    precioCosto: 500,
    precioVenta: 800,
  },
  costoCalculado: {
    valor: 493.33,
    metodo: 'CPP',
    moneda: 'CUP',
  },
  margen: {
    absoluto: 306.67,
    porcentaje: 38.33,
    estado: 'SALUDABLE',
  },
  variacion: {
    absoluto: -6.67,
    porcentaje: -1.33,
    estado: 'OK',
  },
  merma: {
    cantidad30d: 0,
    porcentajeSobreStock: null,
    desperdicioEsperadoPromedio: null,
  },
  advertencias: ['Ejemplo de advertencia'],
  ultimaActualizacion: '2026-06-18T12:00:00.000Z',
}

describe('FichaCostoView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra encabezado con nombre, código y tipo del producto', () => {
    vi.mocked(getHistorialCostosAction).mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      },
    } as any)
    vi.mocked(getListasPreciosProductoAction).mockResolvedValue({
      success: true,
      data: [],
    } as any)
    render(<FichaCostoView data={baseData} />)
    expect(screen.getByRole('heading', { name: /Harina 50kg/i })).toBeInTheDocument()
    expect(screen.getByText(/HAR-50/)).toBeInTheDocument()
    expect(screen.getByText(/Producto simple/)).toBeInTheDocument()
  })

  it('muestra el margen saludable en el resumen', () => {
    vi.mocked(getHistorialCostosAction).mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      },
    } as any)
    vi.mocked(getListasPreciosProductoAction).mockResolvedValue({
      success: true,
      data: [],
    } as any)
    render(<FichaCostoView data={baseData} />)
    expect(screen.getByText(/Margen 38.3%/)).toBeInTheDocument()
  })

  it('muestra el indicador accesible de margen (texto + icono)', () => {
    vi.mocked(getHistorialCostosAction).mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      },
    } as any)
    vi.mocked(getListasPreciosProductoAction).mockResolvedValue({
      success: true,
      data: [],
    } as any)
    render(<FichaCostoView data={baseData} />)
    const status = screen.getByRole('status', { name: /Margen saludable/i })
    expect(status).toBeInTheDocument()
  })

  it('muestra advertencias cuando las hay', () => {
    vi.mocked(getHistorialCostosAction).mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      },
    } as any)
    vi.mocked(getListasPreciosProductoAction).mockResolvedValue({
      success: true,
      data: [],
    } as any)
    render(<FichaCostoView data={baseData} />)
    expect(screen.getByText('Ejemplo de advertencia')).toBeInTheDocument()
  })

  it('NO muestra la pestaña Composición para producto simple', () => {
    vi.mocked(getHistorialCostosAction).mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      },
    } as any)
    vi.mocked(getListasPreciosProductoAction).mockResolvedValue({
      success: true,
      data: [],
    } as any)
    render(<FichaCostoView data={baseData} />)
    expect(screen.queryByRole('tab', { name: /Composición/i })).not.toBeInTheDocument()
  })

  it('SÍ muestra la pestaña Composición para producto compuesto', async () => {
    vi.mocked(getHistorialCostosAction).mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      },
    } as any)
    vi.mocked(getComposicionCostoAction).mockResolvedValue({
      success: true,
      data: {
        materiales: 100,
        manoObra: 50,
        indirectos: 25,
        total: 175,
        ingredientesSinCosto: 0,
        detalle: [],
        porcentajes: { materiales: 57.14, manoObra: 28.57, indirectos: 14.29 },
      },
    } as any)
    vi.mocked(getListasPreciosProductoAction).mockResolvedValue({
      success: true,
      data: [],
    } as any)
    render(
      <FichaCostoView
        data={{
          ...baseData,
          producto: { ...baseData.producto, tipo: 'COMPUESTO' },
        }}
      />,
    )
    expect(screen.getByRole('tab', { name: /Composición/i })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: /Composición/i }))
    // Tras cambiar de tab se monta ComposicionCosto, que llama a la action mock
    expect(getComposicionCostoAction).toHaveBeenCalled()
  })

  it('cambia a la pestaña Historial y dispara la query', async () => {
    vi.mocked(getHistorialCostosAction).mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      },
    } as any)
    vi.mocked(getListasPreciosProductoAction).mockResolvedValue({
      success: true,
      data: [],
    } as any)
    render(<FichaCostoView data={baseData} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: /Historial/i }))
    expect(getHistorialCostosAction).toHaveBeenCalledWith(
      expect.objectContaining({ productoId: 'prod-1', page: 1, limit: 20 }),
    )
  })

  it('muestra error de la action de historial', async () => {
    vi.mocked(getHistorialCostosAction).mockResolvedValue({
      success: false,
      error: { message: 'Boom', code: 'INTERNAL' },
    } as any)
    vi.mocked(getListasPreciosProductoAction).mockResolvedValue({
      success: true,
      data: [],
    } as any)
    render(<FichaCostoView data={baseData} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: /Historial/i }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Boom')).toBeInTheDocument()
  })

  it('muestra el botón Exportar PDF', () => {
    vi.mocked(getHistorialCostosAction).mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      },
    } as any)
    vi.mocked(getListasPreciosProductoAction).mockResolvedValue({
      success: true,
      data: [],
    } as any)
    render(<FichaCostoView data={baseData} />)
    expect(screen.getByRole('button', { name: /Exportar PDF/i })).toBeInTheDocument()
  })
})
