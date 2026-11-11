import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { crear, generar, listar, actualizar } = vi.hoisted(() => ({
  crear: vi.fn(), generar: vi.fn(), listar: vi.fn(), actualizar: vi.fn(),
}))

vi.mock('@/features/gastosDE/recurrentes', () => ({
  crearGastoRecurrenteAction: crear,
  generarGastosRecurrentesAction: generar,
  listarGastoRecurrentesAction: listar,
  updateGastoRecurrenteAction: actualizar,
}))
vi.mock('@/features/empleados/actions', () => ({ getEmpleadosAction: vi.fn().mockResolvedValue({ success: true, data: [] }) }))
vi.mock('@/features/gastosDE/actions', () => ({
  getGastoConceptosAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getGastoElementosAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { GastosRecurrentesPanel } from '../gastos-recurrentes-panel'

describe('GastosRecurrentesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listar.mockResolvedValue({ success: true, data: { items: [] } })
    crear.mockResolvedValue({ success: true, data: {} })
    generar.mockResolvedValue({ success: true, data: { generados: 2, omitidos: 1 } })
    actualizar.mockResolvedValue({ success: true, data: {} })
  })

  it('crea una plantilla y convierte el monto a centavos', async () => {
    const user = userEvent.setup()
    render(<GastosRecurrentesPanel vendors={[]} />)
    await user.type(screen.getByRole('textbox', { name: 'Nombre de la plantilla' }), 'Alquiler')
    await user.type(screen.getByRole('spinbutton', { name: 'Monto recurrente' }), '125.50')
    await user.click(screen.getByRole('button', { name: 'Crear plantilla' }))

    await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Alquiler', monto: 12550 })))
  })

  it('ejecuta la generación pendiente desde el panel', async () => {
    const user = userEvent.setup()
    render(<GastosRecurrentesPanel vendors={[]} />)
    await user.click(screen.getByRole('button', { name: 'Generar pendientes' }))
    await waitFor(() => expect(generar).toHaveBeenCalledWith({}))
  })
})
