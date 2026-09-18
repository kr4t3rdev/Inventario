/**
 * @description Test del Server Component /busy/empleados.
 *              Verifica que la página:
 *              1) Llama getEmpleadosAction
 *              2) Llama getPagoSalariosAction para integrar pagos en la vista principal
 *              3) Renderiza correctamente con empleados + pagos
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
vi.mock('@/features/empleados/components', () => ({
  NominaEmpleadoSection: ({
    initialEmpleados,
    initialPagos,
  }: {
    initialEmpleados: unknown[]
    initialPagos: unknown[]
  }) => (
    <div data-testid="nomina-empleado-section">
      {initialEmpleados.length} empleados / {initialPagos.length} pagos
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
    getPagoSalariosActionMock.mockResolvedValue({
      success: true,
      data: [{ pgId: 'p1', empleadoId: 'e1', salario: 100, periodo: '2026-06' }],
    })
  })

  it('llama getEmpleadosAction una vez', async () => {
    await EmpleadosPage()
    expect(getEmpleadosActionMock).toHaveBeenCalledTimes(1)
  })

  it('llama getPagoSalariosAction para integrar pagos en Gestión de Empleados', async () => {
    await EmpleadosPage()
    expect(getPagoSalariosActionMock).toHaveBeenCalledTimes(1)
  })

  it('renderiza la lista de empleados correctamente', async () => {
    const element = await EmpleadosPage()
    expect(element).toBeDefined()
  })

  it('pasa empleados y pagos al componente integrado', async () => {
    const result = await EmpleadosPage()
    const flat = JSON.stringify(result)
    expect(flat).toContain('Juan')
    expect(flat).toContain('Ana')
    expect(flat).toContain('p1')
  })

  it('funciona aunque el plan no tenga nomina (caso Básico)', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'u-1',
      role: 'user',
      planFeatures: { empleados: true, nomina: false, asistencia: false, vacaciones: false },
    })
    await expect(EmpleadosPage()).resolves.toBeDefined()
    expect(getPagoSalariosActionMock).toHaveBeenCalledTimes(1)
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
