import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductionDialogs, type ProductionDialogsProps } from '../production-dialogs';
import type { RecetaProduccion } from '@/app/models/model';

vi.mock('@/lib/utils/unit-converter', () => ({
  formatIngrediente: vi.fn(() => '2 kg'),
}))

const mockRecipe: RecetaProduccion = {
  recetaId: 'rec-1',
  nombre: 'Pan Dulce',
  rendimiento: 10,
  costoUnitario: 25.50,
  instrucciones: 'Mezclar y hornear',
  tiempoPrep: 45,
  productoId: 'prod-1',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  producto: { id: 'prod-1', nombre: 'Pan' } as any,
  ingredientes: [
    {
      recetaIngredienteId: 'ing-1',
      recetaId: 'rec-1',
      productoId: 'prod-2',
      cantidad: 2,
      unidadSimbolo: 'kg',
      desperdicio: 0.1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      producto: { id: 'prod-2', nombre: 'Harina', precioCosto: 10, stock: 100 } as any,
    },
  ],
}

const defaultProps: ProductionDialogsProps = {
  recetaVer: null,
  recetaEliminar: null,
  confirmacion: null,
  onCloseView: vi.fn(),
  onCloseDelete: vi.fn(),
  onCloseConfirmation: vi.fn(),
  onDeleteRecipe: vi.fn(),
  onConfirmApprove: vi.fn(),
  onConfirmComplete: vi.fn(),
  onConfirmCancel: vi.fn(),
}

describe('ProductionDialogs', () => {
  it('no renderiza ningún diálogo cuando no hay datos', () => {
    const { container } = render(<ProductionDialogs {...defaultProps} />)
    expect(container.textContent).toBe('')
  })

  describe('Ver Receta', () => {
    it('renderiza detalle de receta cuando recetaVer está presente', () => {
      render(<ProductionDialogs {...defaultProps} recetaVer={mockRecipe} />)
      expect(screen.getByText('Pan Dulce')).toBeInTheDocument()
      expect(screen.getByText(/Rendimiento:/)).toBeInTheDocument()
      expect(screen.getByText(/10 unidad/)).toBeInTheDocument()
      expect(screen.getByText(/Producto asociado:/)).toBeInTheDocument()
      expect(screen.getByText(/Mezclar y hornear/)).toBeInTheDocument()
    })

    it('muestra ingredientes en tabla', () => {
      render(<ProductionDialogs {...defaultProps} recetaVer={mockRecipe} />)
      expect(screen.getByText('Harina')).toBeInTheDocument()
      expect(screen.getByText('10%')).toBeInTheDocument()
    })

    it('llama onCloseView al cerrar diálogo', () => {
      const onCloseView = vi.fn()
      render(<ProductionDialogs {...defaultProps} recetaVer={mockRecipe} onCloseView={onCloseView} />)
      fireEvent.click(screen.getByRole('button', { name: /Cerrar/i }))
      expect(onCloseView).toHaveBeenCalled()
    })

    it('muestra "Sin ingredientes definidos" cuando la receta no tiene ingredientes', () => {
      const recetaSinIng = { ...mockRecipe, ingredientes: [] }
      render(<ProductionDialogs {...defaultProps} recetaVer={recetaSinIng} />)
      expect(screen.getByText('Sin ingredientes definidos')).toBeInTheDocument()
    })
  })

  describe('Eliminar Receta', () => {
    it('muestra diálogo de confirmación de eliminación', () => {
      render(
        <ProductionDialogs
          {...defaultProps}
          recetaEliminar={{ recetaId: 'rec-1', nombre: 'Pan Dulce' }}
        />
      )
      expect(screen.getByText('Eliminar receta')).toBeInTheDocument()
      expect(screen.getByText(/Pan Dulce/)).toBeInTheDocument()
    })

    it('llama onDeleteRecipe con el recetaId al confirmar', () => {
      const onDeleteRecipe = vi.fn()
      render(
        <ProductionDialogs
          {...defaultProps}
          recetaEliminar={{ recetaId: 'rec-1', nombre: 'Pan Dulce' }}
          onDeleteRecipe={onDeleteRecipe}
        />
      )
      const deleteButton = screen.getByRole('button', { name: /Eliminar/i })
      fireEvent.click(deleteButton)
      expect(onDeleteRecipe).toHaveBeenCalledWith('rec-1')
    })
  })

  describe('Confirmación de órdenes', () => {
    it('muestra diálogo de aprobar con descripción correcta', () => {
      render(
        <ProductionDialogs
          {...defaultProps}
          confirmacion={{ tipo: 'aprobar', ordenId: 'ord-1', recetaNombre: 'Pan Dulce', cantidad: 10 }}
        />
      )
      expect(screen.getByText('Aprobar orden de producción')).toBeInTheDocument()
    })

    it('muestra diálogo de completar con descripción correcta', () => {
      render(
        <ProductionDialogs
          {...defaultProps}
          confirmacion={{ tipo: 'completar', ordenId: 'ord-2', recetaNombre: 'Pastel', cantidad: 5 }}
        />
      )
      expect(screen.getByText('Completar orden de producción')).toBeInTheDocument()
    })

    it('muestra diálogo de cancelar con descripción correcta', () => {
      render(
        <ProductionDialogs
          {...defaultProps}
          confirmacion={{ tipo: 'cancelar', ordenId: 'ord-3', recetaNombre: 'Galletas', cantidad: 20 }}
        />
      )
      expect(screen.getByText('Cancelar orden de producción')).toBeInTheDocument()
    })

    it('llama onConfirmApprove cuando se confirma aprobar', () => {
      const onConfirmApprove = vi.fn()
      render(
        <ProductionDialogs
          {...defaultProps}
          confirmacion={{ tipo: 'aprobar', ordenId: 'ord-1', recetaNombre: 'Pan', cantidad: 10 }}
          onConfirmApprove={onConfirmApprove}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))
      expect(onConfirmApprove).toHaveBeenCalledWith('ord-1')
    })

    it('llama onConfirmComplete cuando se confirma completar', () => {
      const onConfirmComplete = vi.fn()
      render(
        <ProductionDialogs
          {...defaultProps}
          confirmacion={{ tipo: 'completar', ordenId: 'ord-2', recetaNombre: 'Pastel', cantidad: 5 }}
          onConfirmComplete={onConfirmComplete}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))
      expect(onConfirmComplete).toHaveBeenCalledWith('ord-2')
    })

    it('llama onConfirmCancel cuando se confirma cancelar', () => {
      const onConfirmCancel = vi.fn()
      render(
        <ProductionDialogs
          {...defaultProps}
          confirmacion={{ tipo: 'cancelar', ordenId: 'ord-3', recetaNombre: 'Galletas', cantidad: 20 }}
          onConfirmCancel={onConfirmCancel}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))
      expect(onConfirmCancel).toHaveBeenCalledWith('ord-3')
    })
  })
})
