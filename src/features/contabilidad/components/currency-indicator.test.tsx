import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pathnameMock = vi.hoisted(() => vi.fn(() => '/busy/contabilidad/configuracion'))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}))

import { CurrencyIndicator } from './currency-indicator'

describe('CurrencyIndicator', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/busy/contabilidad/configuracion')
  })

  it('muestra la moneda de la política contable aunque el catálogo marque otra como principal', () => {
    render(
      <CurrencyIndicator
        monedas={[
          { codigo: 'CUP', esPrincipal: true, simbolo: '$' },
          { codigo: 'USD', simbolo: 'US$' },
        ]}
        tasas={[]}
        monedaPrincipal={{ estado: 'CONFIGURADA', moneda: 'USD' }}
      />,
    )

    expect(screen.getByText('USD')).toBeInTheDocument()
    expect(screen.queryByText('CUP')).not.toBeInTheDocument()
  })

  it('no presenta CUP como configurada cuando la política está ausente', () => {
    render(
      <CurrencyIndicator
        monedas={[{ codigo: 'CUP', esPrincipal: true, simbolo: '$' }]}
        tasas={[]}
        monedaPrincipal={{ estado: 'AUSENTE', moneda: null }}
      />,
    )

    expect(screen.queryByText('CUP')).not.toBeInTheDocument()
    expect(screen.getByText('Sin moneda configurada')).toBeInTheDocument()
  })

  it('no presenta una moneda cuando la consulta de la política falló', () => {
    render(
      <CurrencyIndicator
        monedas={[{ codigo: 'CUP', esPrincipal: true, simbolo: '$' }]}
        tasas={[]}
        monedaPrincipal={{ estado: 'ERROR', moneda: null }}
      />,
    )

    expect(screen.queryByText('CUP')).not.toBeInTheDocument()
    expect(screen.getByText('Moneda no disponible')).toBeInTheDocument()
  })

  it('excluye la moneda principal de la política de las tasas secundarias', () => {
    render(
      <CurrencyIndicator
        monedas={[
          { codigo: 'CUP', simbolo: '$' },
          { codigo: 'USD', simbolo: 'US$' },
        ]}
        tasas={[
          {
            monedaOrigenId: 'CUP',
            tasa: 24.5,
            fechaVigencia: '2026-01-01',
          },
          {
            monedaOrigenId: 'USD',
            tasa: 1,
            fechaVigencia: '2026-01-01',
          },
        ]}
        monedaPrincipal={{ estado: 'CONFIGURADA', moneda: 'USD' }}
      />,
    )

    expect(screen.getByText('USD')).toBeInTheDocument()
    expect(screen.getByText('24.50')).toBeInTheDocument()
    expect(screen.queryByText('1.00')).not.toBeInTheDocument()
  })
})
