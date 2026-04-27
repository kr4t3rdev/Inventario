import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { PeriodoAcciones } from '../PeriodoAcciones'

const refetchMock = vi.fn()
const aperturarMock = vi.fn()
const cerrarDiarioMock = vi.fn()
const cerrarMensualMock = vi.fn()
const cerrarAnualMock = vi.fn()

vi.mock('@/lib/redux/services/contabilidadApi', () => ({
  useGetPeriodosQuery: () => ({ refetch: refetchMock }),
  useAperturarPeriodoMutation: () => [aperturarMock, { isLoading: false }],
  useCerrarDiarioMutation: () => [cerrarDiarioMock, { isLoading: false }],
  useCerrarMensualMutation: () => [cerrarMensualMock, { isLoading: false }],
  useCerrarAnualMutation: () => [cerrarAnualMock, { isLoading: false }],
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

describe('PeriodoAcciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aperturarMock.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    cerrarDiarioMock.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    cerrarMensualMock.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    cerrarAnualMock.mockReturnValue({ unwrap: () => Promise.resolve({}) })
  })

  it('cierra el día por fecha, no por ID manual', async () => {
    render(<PeriodoAcciones />)

    const fechaInput = screen.getByLabelText('Fecha de cierre diario')
    fireEvent.change(fechaInput, { target: { value: '2026-04-25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Cierre Diario' }))

    expect(cerrarDiarioMock).toHaveBeenCalledWith({ fecha: '2026-04-25' })
  })

  it('cierra el mes por fecha usando el contrato soportado por backend', async () => {
    render(<PeriodoAcciones />)

    const fechaInput = screen.getByLabelText('Fecha dentro del mes')
    fireEvent.change(fechaInput, { target: { value: '2026-04-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Cierre Mensual' }))

    expect(cerrarMensualMock).toHaveBeenCalledWith({ fecha: '2026-04-15' })
  })

  it('cierra el año por fecha usando el contrato soportado por backend', async () => {
    render(<PeriodoAcciones />)

    const fechaInput = screen.getByLabelText('Fecha dentro del año')
    fireEvent.change(fechaInput, { target: { value: '2026-06-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Cierre Anual' }))

    expect(cerrarAnualMock).toHaveBeenCalledWith({ fecha: '2026-06-01' })
  })
})
