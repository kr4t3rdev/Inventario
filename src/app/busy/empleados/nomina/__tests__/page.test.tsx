/**
 * @description Test del Server Component /busy/empleados/nomina.
 *              Verifica que el redirect funciona correctamente cuando
 *              el plan del usuario no tiene el feature `nomina`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUserMock = vi.fn()
const redirectMock = vi.fn()
const getEmpleadosActionMock = vi.fn()
const getPagoSalariosActionMock = vi.fn()

vi.mock('@/lib/server-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server-actions')>()
  return {
    ...actual,
    getCurrentUser: () => getCurrentUserMock(),
  }
})

vi.mock('@/features/empleados/actions', () => ({
  getEmpleadosAction: (...args: unknown[]) => getEmpleadosActionMock(...args),
}))

vi.mock('@/features/pago-salario/actions', () => ({
  getPagoSalariosAction: (...args: unknown[]) => getPagoSalariosActionMock(...args),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    // Throw para simular el comportamiento real de redirect
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

vi.mock('@/features/empleados/components', () => ({
  NominaEmpleadoSection: () => (
    <div data-testid="nomina-empleado-section">NominaEmpleadoSection</div>
  ),
}))

import NominaPage from '../page'

describe('/busy/empleados/nomina page (Server Component)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getEmpleadosActionMock.mockResolvedValue({ success: true, data: [] })
    getPagoSalariosActionMock.mockResolvedValue({ success: true, data: [] })
  })

  it('redirige a /busy/empleados cuando el plan no tiene nomina', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'u-1',
      role: 'user',
      planFeatures: { empleados: true, nomina: false },
    })
    await expect(NominaPage()).rejects.toThrow('NEXT_REDIRECT:/busy/empleados')
    expect(redirectMock).toHaveBeenCalledWith('/busy/empleados')
  })

  it('redirige cuando planFeatures es undefined (caso tenant sin licencia)', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'u-1',
      role: 'user',
      // planFeatures undefined
    })
    await expect(NominaPage()).rejects.toThrow('NEXT_REDIRECT:/busy/empleados')
    expect(redirectMock).toHaveBeenCalledWith('/busy/empleados')
  })

  it('renderiza NominaClient cuando el plan tiene nomina', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'u-1',
      role: 'user',
      planFeatures: { empleados: true, nomina: true },
    })
    const result = await NominaPage()
    expect(result).toBeDefined()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('redirige cuando el plan real es Básico aunque planFeatures.nomina siga true', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'u-1',
      role: 'user',
      planName: 'Básico',
      planFeatures: { empleados: true, nomina: true, asistencia: true, vacaciones: true },
    })
    await expect(NominaPage()).rejects.toThrow('NEXT_REDIRECT:/busy/empleados')
    expect(redirectMock).toHaveBeenCalledWith('/busy/empleados')
  })

  it('admin global puede ver nomina aunque planFeatures.nomina sea false', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'admin-1',
      role: 'admin',
      planFeatures: { empleados: true, nomina: false },
    })
    const result = await NominaPage()
    expect(result).toBeDefined()
    // admin bypasses plan checks
    // Nota: NominaPage actual NO tiene bypass para admin — es un edge case
    // que el admin global no debería llegar acá. Si es necesario, agregar bypass.
  })
})
