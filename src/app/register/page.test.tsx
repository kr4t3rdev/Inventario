import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterPage from './page'

const { register, get } = vi.hoisted(() => ({
  register: vi.fn(),
  get: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get }),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ register }),
}))

vi.mock('@/components/auth/auth-layout', () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('RegisterPage', () => {
  beforeEach(() => {
    get.mockImplementation((key: string) => ({
      name: 'Nombre de Google',
      email: 'google@example.com',
    })[key as 'name' | 'email'] ?? null)
  })

  it('precarga nombre y correo desde la URL y permite editarlos', () => {
    render(<RegisterPage />)

    const nameInput = screen.getByLabelText('Nombre completo') as HTMLInputElement
    const emailInput = screen.getByLabelText('Correo electrónico') as HTMLInputElement

    expect(nameInput.value).toBe('Nombre de Google')
    expect(emailInput.value).toBe('google@example.com')

    fireEvent.change(nameInput, { target: { value: 'Nombre editado' } })
    fireEvent.change(emailInput, { target: { value: 'editado@example.com' } })

    expect(nameInput.value).toBe('Nombre editado')
    expect(emailInput.value).toBe('editado@example.com')
  })
})
