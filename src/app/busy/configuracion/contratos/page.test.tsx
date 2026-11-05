import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/features/contratos', () => ({
  ConfiguracionContratos: () => <div data-testid="contract-settings" />,
  TiposContratosList: () => <div data-testid="contract-types" />,
}))

import ConfiguracionContratosPage from './page'

describe('ConfiguracionContratosPage', () => {
  it('usa el encabezado común y conserva navegación y contenido', () => {
    render(<ConfiguracionContratosPage />)

    expect(
      screen.getByRole('heading', { name: 'Configuración de contratos' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Configura los parámetros generales para gestionar contratos.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a contratos' })).toHaveAttribute(
      'href',
      '/busy/contratos',
    )
    expect(screen.getByTestId('contract-settings')).toBeInTheDocument()
    expect(screen.getByTestId('contract-types')).toBeInTheDocument()
  })
})
