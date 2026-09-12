import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockReplace = vi.fn()
const mockGet = vi.fn()
const mockFetch = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: mockGet }),
}))

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
})

import VerifyEmailPage from './page'

describe('/verify-email page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockReturnValue('email-token')
  })

  it('redirige a onboarding cuando la verificación es exitosa', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ onboardingToken: 'onboarding-token' }),
    })

    render(<VerifyEmailPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding')
    })

    expect(sessionStorage.getItem('onboardingToken')).toBe('onboarding-token')
  })

  it('muestra mensaje temporal cuando backend responde 500', async () => {
    sessionStorage.removeItem('onboardingToken')

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: 'No se pudo verificar el correo por un problema temporal',
      }),
    })

    render(<VerifyEmailPage />)

    await waitFor(() => {
      expect(
        screen.getByText(
          'No pudimos verificar tu correo por un problema temporal. Inténtalo de nuevo.'
        )
      ).toBeInTheDocument()
    })

    expect(mockReplace).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('onboardingToken')).toBeNull()
  })
})
