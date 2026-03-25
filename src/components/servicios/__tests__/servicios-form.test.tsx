import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ServicioForm } from '../servicios-form'

globalThis.React = React

const mockPush = vi.fn()
const mockBack = vi.fn()
const mockAddServicios = vi.fn()
const mockUpdateServicios = vi.fn()
const mockUseGetServiciosQuery = vi.fn()
const mockUseGetVendorsQuery = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}))

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag: string) => {
      const Component = ({ whileHover, whileTap, initial, animate, transition, ...props }: Record<string, unknown>, ref: React.Ref<HTMLElement>) =>
        React.createElement(tag, { ...props, ref })
      Component.displayName = `motion.${tag}`
      return Component
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/redux/services/serviciosApi', () => ({
  useGetServiciosQuery: (...args: unknown[]) => mockUseGetServiciosQuery(...args),
  useAddServiciosMutation: () => [mockAddServicios],
  useUpdateServiciosMutation: () => [mockUpdateServicios],
}))

vi.mock('@/lib/redux/services/vendorsApi', () => ({
  useGetVendorsQuery: (...args: unknown[]) => mockUseGetVendorsQuery(...args),
}))

describe('ServicioForm', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockBack.mockReset()
    mockAddServicios.mockReset()
    mockUpdateServicios.mockReset()
    mockUseGetServiciosQuery.mockReset()
    mockUseGetVendorsQuery.mockReset()

    mockUseGetServiciosQuery.mockReturnValue({
      data: [],
      isLoading: false,
    })

    mockUseGetVendorsQuery.mockReturnValue({
      data: [],
      isLoading: false,
    })
  })

  it('renderiza los campos de captura sin el anillo de foco azul por defecto', () => {
    render(<ServicioForm />)

    const nombreInput = screen.getByLabelText('Nombre del Servicio')
    const descripcionInput = screen.getByPlaceholderText('Describe los detalles del servicio...')
    const precioInput = screen.getByPlaceholderText('0.00')

    expect(nombreInput).toHaveClass('focus-visible:ring-0')
    expect(descripcionInput).toHaveClass('focus-visible:ring-0')
    expect(precioInput).toHaveClass('focus-visible:ring-0')
  })
})
