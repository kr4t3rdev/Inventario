/**
 * @description Tests del sub-componente EmpleadoCard.
 *              Reusado por EmpleadosListContent (sin botones de pago/delete)
 *              y por NominaEmpleadoSection (con todos los botones).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { EmpleadoCard } from '../empleado-card'
import type { Empleado } from '@/app/models/model'

const mockEmpleado: Empleado = {
  empleadoId: 'emp-1',
  nombre: 'Juan',
  apellido: 'Pérez',
  cargo: 'Vendedor',
  telefono: '555-1234',
  salarioBases: 50000,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('EmpleadoCard', () => {
  describe('renderizado básico', () => {
    it('muestra el nombre y apellido del empleado', () => {
      const { container } = render(<EmpleadoCard empleado={mockEmpleado} />)
      expect(container.textContent).toContain('Juan')
      expect(container.textContent).toContain('Pérez')
    })

    it('muestra el cargo del empleado', () => {
      const { container } = render(<EmpleadoCard empleado={mockEmpleado} />)
      expect(container.textContent).toContain('Vendedor')
    })

    it('muestra el teléfono del empleado', () => {
      const { container } = render(<EmpleadoCard empleado={mockEmpleado} />)
      expect(container.textContent).toContain('555-1234')
    })

    it('muestra "—" cuando el teléfono es null', () => {
      const { container } = render(
        <EmpleadoCard empleado={{ ...mockEmpleado, telefono: null }} />,
      )
      expect(container.textContent).toContain('—')
    })
  })

  describe('botón Editar', () => {
    it('muestra el botón Editar cuando puedeEditar es true', () => {
      const { container } = render(
        <EmpleadoCard empleado={mockEmpleado} puedeEditar={true} />,
      )
      const link = container.querySelector('a[href*="/busy/empleados/update/"]')
      expect(link).not.toBeNull()
      expect(link?.getAttribute('href')).toBe('/busy/empleados/update/emp-1')
    })

    it('NO muestra el botón Editar cuando puedeEditar es false', () => {
      const { container } = render(
        <EmpleadoCard empleado={mockEmpleado} puedeEditar={false} />,
      )
      const link = container.querySelector('a[href*="/busy/empleados/update/"]')
      expect(link).toBeNull()
    })
  })

  describe('botón Realizar Pago', () => {
    it('muestra el botón cuando showPagoButton es true y hay onPago', () => {
      const { container } = render(
        <EmpleadoCard
          empleado={mockEmpleado}
          puedeEditar={true}
          showPagoButton={true}
          onPago={() => {}}
        />,
      )
      expect(container.textContent).toContain('Realizar Pago')
    })

    it('NO muestra el botón cuando showPagoButton es false', () => {
      const { container } = render(
        <EmpleadoCard
          empleado={mockEmpleado}
          puedeEditar={true}
          showPagoButton={false}
          onPago={() => {}}
        />,
      )
      expect(container.textContent).not.toContain('Realizar Pago')
    })

    it('NO muestra el botón cuando puedeEditar es false aunque showPagoButton sea true', () => {
      const { container } = render(
        <EmpleadoCard
          empleado={mockEmpleado}
          puedeEditar={false}
          showPagoButton={true}
          onPago={() => {}}
        />,
      )
      expect(container.textContent).not.toContain('Realizar Pago')
    })

    it('llama onPago con el empleado cuando se hace click', () => {
      const onPago = vi.fn()
      const { container } = render(
        <EmpleadoCard
          empleado={mockEmpleado}
          puedeEditar={true}
          showPagoButton={true}
          onPago={onPago}
        />,
      )
      // Buscar el botón por texto
      const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
      const button = buttons.find(
        (btn) => btn.textContent?.includes('Realizar Pago'),
      )
      expect(button).not.toBeUndefined()
      // Simular el click directamente
      button?.click()
      expect(onPago).toHaveBeenCalledWith(mockEmpleado)
    })
  })

  describe('botón Eliminar', () => {
    it('muestra el botón cuando showDeleteButton es true y hay onDelete', () => {
      const { container } = render(
        <EmpleadoCard
          empleado={mockEmpleado}
          puedeEditar={true}
          showDeleteButton={true}
          onDelete={() => {}}
        />,
      )
      expect(container.textContent).toContain('Eliminar')
    })

    it('NO muestra el botón cuando showDeleteButton es false', () => {
      const { container } = render(
        <EmpleadoCard
          empleado={mockEmpleado}
          puedeEditar={true}
          showDeleteButton={false}
          onDelete={() => {}}
        />,
      )
      expect(container.textContent).not.toContain('Eliminar')
    })

    it('llama onDelete con el id cuando se hace click', () => {
      const onDelete = vi.fn()
      const { container } = render(
        <EmpleadoCard
          empleado={mockEmpleado}
          puedeEditar={true}
          showDeleteButton={true}
          onDelete={onDelete}
        />,
      )
      const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
      const button = buttons.find(
        (btn) => btn.textContent?.includes('Eliminar'),
      )
      expect(button).not.toBeUndefined()
      // Simular el click directamente
      button?.click()
      expect(onDelete).toHaveBeenCalledWith('emp-1')
    })
  })
})
