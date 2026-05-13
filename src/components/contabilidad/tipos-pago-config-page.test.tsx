import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { TiposPagoConfigPage } from './tipos-pago-config-page'

const mockFetch = vi.fn()

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
})

describe('TiposPagoConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra los tipos de pago cargados desde la API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            tipoPagoId: 'tp-1',
            nombre: 'Efectivo',
            descripcion: 'Cobros en caja',
            isActive: true,
            requiereCuenta: false,
            cuentaDefecto: null,
            cuentaDefectoInfo: null,
            _count: { reconciliacionesVenta: 3, reconciliacionesServicio: 1, reconciliacionesGasto: 0 },
          },
          {
            tipoPagoId: 'tp-2',
            nombre: 'Transferencia',
            descripcion: 'Pagos bancarios',
            isActive: true,
            requiereCuenta: true,
            cuentaDefecto: 'c1',
            cuentaDefectoInfo: {
              cuentaId: 'c1',
              nombreBanco: 'Banco Nacional',
              numeroCuenta: '123456',
              tipoCuenta: 'Corriente',
              moneda: 'CUP',
              isActive: true,
            },
            _count: { reconciliacionesVenta: 2, reconciliacionesServicio: 0, reconciliacionesGasto: 4 },
          },
        ],
      }),
    })

    render(<TiposPagoConfigPage />)

    await waitFor(() => {
      expect(screen.getByText('Configuración de Tipos de Pago')).toBeInTheDocument()
      expect(screen.getByText('Efectivo')).toBeInTheDocument()
      expect(screen.getByText('Transferencia')).toBeInTheDocument()
    })

    // Summary cards: Total (2) and Activos (2)
    expect(screen.getAllByText('2')).toHaveLength(2)
    expect(screen.getByText('1')).toBeInTheDocument() // Con cuenta
  })
})
