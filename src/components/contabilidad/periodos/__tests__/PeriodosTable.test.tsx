import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { PeriodosTable } from '../PeriodosTable'

const mockUseGetPeriodosQuery = vi.fn()

vi.mock('@/lib/redux/services/contabilidadApi', () => ({
  useGetPeriodosQuery: (...args: unknown[]) => mockUseGetPeriodosQuery(...args),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children?: React.ReactNode }) => (
    <div data-value={value} data-testid="select" onClick={() => onValueChange?.('DIARIO')}>{children}</div>
  ),
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children?: React.ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}))

describe('PeriodosTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza períodos desde el contrato real items/meta del backend', () => {
    const onSelectPeriodo = vi.fn()
    mockUseGetPeriodosQuery.mockReturnValue({
      data: {
        items: [
          {
            periodoId: 'periodo-1',
            codigo: 'D-2026-04-25',
            tipo: 'DIARIO',
            estado: 'ABIERTO',
            fechaInicio: '2026-04-25T00:00:00.000Z',
            fechaFin: '2026-04-25T23:59:59.999Z',
            tieneApertura: true,
            tieneSnapshot: false,
            blockers: [],
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    })

    render(<PeriodosTable onSelectPeriodo={onSelectPeriodo} />)

    expect(screen.getByText('D-2026-04-25')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Ver Detalle'))
    expect(onSelectPeriodo).toHaveBeenCalledWith('periodo-1')
  })

  it('mantiene compatibilidad con el contrato legacy periodos/total', () => {
    mockUseGetPeriodosQuery.mockReturnValue({
      data: {
        periodos: [
          {
            periodoId: 'periodo-2',
            codigo: 'M-2026-04',
            tipo: 'MENSUAL',
            estado: 'CERRADO',
            fechaInicio: '2026-04-01T00:00:00.000Z',
            fechaFin: '2026-04-30T23:59:59.999Z',
          },
        ],
        total: 1,
      },
      isLoading: false,
      isError: false,
    })

    render(<PeriodosTable onSelectPeriodo={vi.fn()} />)

    expect(screen.getByText('M-2026-04')).toBeInTheDocument()
  })
})
