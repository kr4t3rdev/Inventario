/**
 * @description Test del Server Component /busy/empleados.
 *              Verifica que la página:
 *              1) Llama getEmpleadosAction
 *              2) NO llama getPagoSalariosAction (Fix A del spec)
 *              3) Renderiza correctamente con lista de empleados
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de las server actions ANTES de importar el componente
const getEmpleadosActionMock = vi.fn()
const getPagoSalariosActionMock = vi.fn()
const getCurrentUserMock = vi.fn()

vi.mock('@/features/empleados/actions', () => ({
  getEmpleadosAction: (...args: unknown[]) => getEmpleadosActionMock(...args),
}))
vi.mock('@/features/pago-salario/actions', () => ({
  getPagoSalariosAction: (...args: unknown[]) => getPagoSalariosActionMock(...args),
}))
vi.mock('@/lib/server-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server-actions')>()
  return {
    ...actual,
    getCurrentUser: () => getCurrentUserMock(),
  }
})

// Mock del componente cliente para que el test no dependa de framer-motion
vi.mock('@/features/empleados/components/empleados-list-content', () => ({
  EmpleadosListContent: ({ initialEmpleados }: { initialEmpleados: unknown[] }) => (
    <div data-testid="empleados-list-content">
      {initialEmpleados.length} empleados
    </div>
  ),
}))

import EmpleadosPage from '../page'

describe('/busy/empleados page (Server Component)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUserMock.mockResolvedValue({
      userId: 'u-1',
      role: 'user',
      planFeatures: { empleados: true, nomina: false },
    })
    getEmpleadosActionMock.mockResolvedValue({
      success: true,
      data: [
        { empleadoId: 'e1', nombre: 'Juan', apellido: 'Pérez', cargo: 'Vendedor' },
        { empleadoId: 'e2', nombre: 'Ana', apellido: 'García', cargo: 'Cajera' },
      ],
    })
    getPagoSalariosActionMock.mockResolvedValue({ success: true, data: [] })
  })

  it('llama getEmpleadosAction una vez', async () => {
    await EmpleadosPage()
    expect(getEmpleadosActionMock).toHaveBeenCalledTimes(1)
  })

  it('NO llama getPagoSalariosAction (Fix A)', async () => {
    await EmpleadosPage()
    expect(getPagoSalariosActionMock).not.toHaveBeenCalled()
  })

  it('renderiza la lista de empleados correctamente', async () => {
    const element = await EmpleadosPage()
    expect(element).toBeDefined()
  })

  it('pasa los empleados al EmpleadosListContent', async () => {
    const result = await EmpleadosPage()
    // Buscamos el prop en el árbol renderizado
    const flat = JSON.stringify(result)
    expect(flat).toContain('Juan')
    expect(flat).toContain('Ana')
  })

  it('funciona aunque el plan no tenga nomina (caso Básico)', async () => {
    // getPagoSalariosAction NO debe ser llamada nunca,
    // independientemente de las features del plan
    getCurrentUserMock.mockResolvedValue({
      userId: 'u-1',
      role: 'user',
      planFeatures: { empleados: true, nomina: false, asistencia: false, vacaciones: false },
    })
    await expect(EmpleadosPage()).resolves.toBeDefined()
    expect(getPagoSalariosActionMock).not.toHaveBeenCalled()
  })

  it('funciona aunque getEmpleadosAction falle (degraded mode)', async () => {
    getEmpleadosActionMock.mockResolvedValue({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'fail' },
    })
    const result = await EmpleadosPage()
    expect(result).toBeDefined()
    // No debe crashear
  })
})
