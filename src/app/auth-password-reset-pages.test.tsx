import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/auth/auth-layout', () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}))

vi.mock('@/features/auth/actions-password-reset', () => ({
  requestPasswordResetAction: vi.fn(async () => ({ success: true })),
  resetPasswordAction: vi.fn(async () => ({ success: true })),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=valid.jwt.token'),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string }>) =>
    React.createElement('a', { href, ...props }, children),
}))

import ForgotPasswordPage from './forgot-password/page'
import ResetPasswordPage from './reset-password/page'

describe('ForgotPasswordPage', () => {
  it('muestra título y copy en español neutro', () => {
    render(React.createElement(ForgotPasswordPage))
    expect(screen.getByText('¿Olvidaste tu contraseña?')).toBeDefined()
    expect(
      screen.getByText('Ingresa tu correo y te enviaremos un enlace para restablecerla'),
    ).toBeDefined()
  })

  it('incluye enlace para volver a iniciar sesión', () => {
    render(React.createElement(ForgotPasswordPage))
    const link = screen.getByRole('link', { name: 'Volver a iniciar sesión' })
    expect(link.getAttribute('href')).toBe('/login')
  })
})

describe('ResetPasswordPage', () => {
  it('muestra título y campos de contraseña', () => {
    render(React.createElement(ResetPasswordPage))
    expect(screen.getByText('Restablecer contraseña')).toBeDefined()
    expect(screen.getByLabelText('Nueva contraseña')).toBeDefined()
    expect(screen.getByLabelText('Confirmar contraseña')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Guardar nueva contraseña' })).toBeDefined()
  })

  it('incluye enlace para solicitar un nuevo enlace', () => {
    render(React.createElement(ResetPasswordPage))
    const link = screen.getByRole('link', { name: 'Solicitar un nuevo enlace' })
    expect(link.getAttribute('href')).toBe('/forgot-password')
  })
})
