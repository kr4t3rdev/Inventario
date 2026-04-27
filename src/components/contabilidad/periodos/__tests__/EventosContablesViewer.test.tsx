import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { EventosContablesViewer } from '../EventosContablesViewer'

const mockUseGetEventosContablesQuery = vi.fn()

vi.mock('@/lib/redux/services/contabilidadApi', () => ({
  useGetEventosContablesQuery: (...args: unknown[]) => mockUseGetEventosContablesQuery(...args),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children?: React.ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}))

vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

describe('EventosContablesViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza líneas Prisma reales con debito/credito', () => {
    mockUseGetEventosContablesQuery.mockReturnValue({
      data: {
        eventos: [
          {
            eventoId: 'evt-1',
            origenTipo: 'VENTA',
            origenId: 'venta-1',
            naturaleza: 'INGRESO',
            estado: 'CONFIRMADO',
            criterio: 'DEVENGO',
            fechaOperacion: '2026-04-25T10:00:00.000Z',
            monto: 150,
            moneda: 'CUP',
            descripcion: 'Venta de prueba',
            lineas: [
              { lineaId: 'lin-1', cuenta: 'CAJA', debito: 150, credito: 0, descripcion: 'Debe caja' },
              { lineaId: 'lin-2', cuenta: 'VENTA_venta-1', debito: 0, credito: 150, descripcion: 'Haber venta' },
            ],
          },
        ],
        total: 1,
      },
      isLoading: false,
      isError: false,
    })

    render(<EventosContablesViewer />)

    expect(screen.getByText('CAJA')).toBeInTheDocument()
    expect(screen.getByText('VENTA_venta-1')).toBeInTheDocument()
    expect(screen.getAllByText('Débito').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Crédito').length).toBeGreaterThanOrEqual(1)
  })
})
