/**
 * @description Pruebas para el gestor de exchange
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { ExchangeManager } from './exchange-manager'

const mockFetch = vi.fn()

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
})

const mockTasasResponse = {
  success: true,
  data: {
    monedaPrincipal: {
      monedaId: 'm1',
      codigo: 'CUP',
      nombre: 'Peso Cubano',
      simbolo: '$',
      esPrincipal: true,
    },
    tasas: [
      {
        tasaId: 't1',
        monedaOrigenId: 'USD',
        monedaDestino: 'CUP',
        tasa: 120,
        fechaVigencia: '2025-06-01T00:00:00.000Z',
      },
      {
        tasaId: 't2',
        monedaOrigenId: 'EUR',
        monedaDestino: 'CUP',
        tasa: 135,
        fechaVigencia: '2025-06-01T00:00:00.000Z',
      },
    ],
  },
}

describe('ExchangeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe mostrar la moneda principal', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTasasResponse,
    })

    render(<ExchangeManager />)

    await waitFor(() => {
      expect(screen.getByText('Moneda Principal')).toBeInTheDocument()
      expect(screen.getAllByText('CUP').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Peso Cubano')).toBeInTheDocument()
    })
  })

  it('debe mostrar las tasas de cambio vigentes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTasasResponse,
    })

    render(<ExchangeManager />)

    await waitFor(() => {
      expect(screen.getByText('Tasas de Cambio Vigentes')).toBeInTheDocument()
    })

    expect(screen.getByText(/1 USD/)).toBeInTheDocument()
    expect(screen.getByText(/1 EUR/)).toBeInTheDocument()
    expect(screen.getByText('120.0000')).toBeInTheDocument()
    expect(screen.getByText('135.0000')).toBeInTheDocument()
  })

  it('debe mostrar loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}))
    render(<ExchangeManager />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('debe mostrar error state cuando falla la API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Error interno' }),
    })

    render(<ExchangeManager />)

    await waitFor(() => {
      expect(screen.getByText('Error al cargar exchange')).toBeInTheDocument()
    })
  })

  it('debe mostrar vacío cuando no hay tasas', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          monedaPrincipal: {
            monedaId: 'm1',
            codigo: 'CUP',
            nombre: 'Peso Cubano',
            simbolo: '$',
            esPrincipal: true,
          },
          tasas: [],
        },
      }),
    })

    render(<ExchangeManager />)

    await waitFor(() => {
      expect(screen.getByText(/No hay tasas de cambio registradas/)).toBeInTheDocument()
    })
  })
})
