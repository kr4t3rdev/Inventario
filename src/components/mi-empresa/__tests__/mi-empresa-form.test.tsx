// @vitest-environment jsdom

import React from 'react'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MiEmpresaForm } from '../mi-empresa-form'

const mockFetch = vi.fn()
const mockUseGetCuentasBancariasQuery = vi.fn()

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) => {
        const Component = ({
          children,
          whileHover,
          whileTap,
          initial,
          animate,
          transition,
          variants,
          ...props
        }: React.HTMLAttributes<HTMLElement> & Record<string, unknown>) =>
          React.createElement(tag, props, children)
        Component.displayName = `motion.${tag}`
        return Component
      },
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
  },
}))

vi.mock('@/lib/token', () => ({
  getAuthToken: () => null,
}))

vi.mock('@/lib/redux/services/contabilidadApi', () => ({
  useGetCuentasBancariasQuery: (...args: unknown[]) => mockUseGetCuentasBancariasQuery(...args),
}))

describe('MiEmpresaForm', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    mockUseGetCuentasBancariasQuery.mockReset()
    mockFetch.mockReset()

    mockUseGetCuentasBancariasQuery.mockReturnValue({
      data: { cuentas: [] },
      isLoading: false,
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          nombre: 'Mi Empresa',
          propietario: null,
          direccion: null,
          telefono: null,
          email: null,
          carnetIdentidad: null,
          nit: null,
          licenciaOperacion: null,
          logoUrl: null,
          cuentaBancariaId: null,
          usaCodigoEan13: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'EAN-13 activado correctamente',
          data: {
            id: 1,
            nombre: 'Mi Empresa',
            propietario: null,
            direccion: null,
            telefono: null,
            email: null,
            carnetIdentidad: null,
            nit: null,
            licenciaOperacion: null,
            logoUrl: null,
            cuentaBancariaId: null,
            usaCodigoEan13: true,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          nombre: 'Mi Empresa',
          propietario: null,
          direccion: null,
          telefono: null,
          email: null,
          carnetIdentidad: null,
          nit: null,
          licenciaOperacion: null,
          logoUrl: null,
          cuentaBancariaId: null,
          usaCodigoEan13: true,
        }),
      })

    vi.stubGlobal('fetch', mockFetch)
  })

  it('usa PUT al confirmar la activacion de EAN-13', async () => {
    render(<MiEmpresaForm />)

    await waitFor(() => {
      expect(screen.getByText('Configuración de Mi Empresa')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(screen.getByText('Sí, activar EAN-13')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Sí, activar EAN-13'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/mi-empresa',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ usaCodigoEan13: true, confirmReset: true }),
        }),
      )
    })
  })
})