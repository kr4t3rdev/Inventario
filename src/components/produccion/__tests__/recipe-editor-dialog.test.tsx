import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecipeEditorDialog } from '../recipe-editor-dialog';
import type { RecipeOutputMode } from '../recipe-output-selector';

const mockProductos = [
  { id: 'prod-1', nombre: 'Harina', precioCosto: 10, stock: 100 },
  { id: 'prod-2', nombre: 'Azúcar', precioCosto: 15, stock: 50 },
]

const defaultPreview = {
  hasBlockingIssues: false,
  blockingMessages: [],
  normalizationMessages: [],
  rows: [],
}

const baseProps = {
  open: true,
  nombreReceta: '',
  rendimiento: 1,
  selectedProducto: '',
  outputMode: 'existing' as RecipeOutputMode,
  createdOutputProductName: null,
  productosTyped: mockProductos,
  busquedaProductos: '',
  nuevoItems: [],
  newRecipePreview: defaultPreview,
  unitOptionNone: '__none__',
  noConversionUnits: ['cucharada', 'cucharadita', 'taza', 'unidad'],
  onClose: vi.fn(),
  onNombreChange: vi.fn(),
  onRendimientoChange: vi.fn(),
  onModeChange: vi.fn(),
  onProductChange: vi.fn(),
  onCreatedProduct: vi.fn(),
  onBusquedaChange: vi.fn(),
  onAddItem: vi.fn(),
  onUpdateItem: vi.fn(),
  onRemoveItem: vi.fn(),
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
}

describe('RecipeEditorDialog', () => {
  it('renderiza el título y descripción del diálogo', () => {
    render(<RecipeEditorDialog {...baseProps} />)
    expect(screen.getByText('Nueva Receta de Producción')).toBeInTheDocument()
    expect(screen.getByText(/Define una receta para producir productos del inventario/)).toBeInTheDocument()
  })

  it('llama onNombreChange al escribir en el input de nombre', () => {
    const onNombreChange = vi.fn()
    render(<RecipeEditorDialog {...baseProps} onNombreChange={onNombreChange} />)
    const input = screen.getByLabelText('Nombre de la Receta')
    fireEvent.change(input, { target: { value: 'Pan Dulce' } })
    expect(onNombreChange).toHaveBeenCalledWith('Pan Dulce')
  })

  it('llama onRendimientoChange al cambiar rendimiento', () => {
    const onRendimientoChange = vi.fn()
    render(<RecipeEditorDialog {...baseProps} onRendimientoChange={onRendimientoChange} />)
    const input = screen.getByLabelText('Rendimiento (unidades)')
    fireEvent.change(input, { target: { value: '20' } })
    expect(onRendimientoChange).toHaveBeenCalledWith(20)
  })

  it('llama onBusquedaChange al escribir en búsqueda', () => {
    const onBusquedaChange = vi.fn()
    render(<RecipeEditorDialog {...baseProps} onBusquedaChange={onBusquedaChange} />)
    const input = screen.getByPlaceholderText('Escribe el nombre del producto...')
    fireEvent.change(input, { target: { value: 'Harina' } })
    expect(onBusquedaChange).toHaveBeenCalledWith('Harina')
  })

  it('muestra productos disponibles filtrados', () => {
    render(<RecipeEditorDialog {...baseProps} />)
    expect(screen.getByText('Harina')).toBeInTheDocument()
    expect(screen.getByText('Azúcar')).toBeInTheDocument()
  })

  it('llama onAddItem al hacer click en un producto', () => {
    const onAddItem = vi.fn()
    render(<RecipeEditorDialog {...baseProps} onAddItem={onAddItem} />)
    const harinaButton = screen.getByText('Harina').closest('button')
    expect(harinaButton).toBeInTheDocument()
    if (harinaButton) {
      fireEvent.click(harinaButton)
      expect(onAddItem).toHaveBeenCalledWith('prod-1')
    }
  })

  it('muestra sección de productos agregados cuando hay items', () => {
    render(
      <RecipeEditorDialog
        {...baseProps}
        nuevoItems={[
          { productoId: 'prod-1', cantidad: 2, unidadSimbolo: null, desperdicio: 0 },
        ]}
      />
    )
    expect(screen.getByText(/Productos Agregados/)).toBeInTheDocument()
    expect(screen.getByText('Harina')).toBeInTheDocument()
  })

  it('no muestra sección de productos agregados cuando no hay items', () => {
    render(<RecipeEditorDialog {...baseProps} nuevoItems={[]} />)
    expect(screen.queryByText(/Productos Agregados/)).not.toBeInTheDocument()
  })

  it('llama onRemoveItem al hacer click en quitar', () => {
    const onRemoveItem = vi.fn()
    render(
      <RecipeEditorDialog
        {...baseProps}
        nuevoItems={[
          { productoId: 'prod-1', cantidad: 2, unidadSimbolo: null, desperdicio: 0 },
        ]}
        onRemoveItem={onRemoveItem}
      />
    )
    const removeButtons = screen.getAllByRole('button')
    const quitarBtn = removeButtons.find((btn) => btn.innerHTML.includes('×'))
    if (quitarBtn) {
      fireEvent.click(quitarBtn)
      expect(onRemoveItem).toHaveBeenCalledWith('prod-1')
    }
  })

  it('llama onSubmit al hacer click en Crear Receta', () => {
    const onSubmit = vi.fn()
    render(<RecipeEditorDialog {...baseProps} onSubmit={onSubmit} />)
    const crearBtn = screen.getByRole('button', { name: /Crear Receta/i })
    fireEvent.click(crearBtn)
    expect(onSubmit).toHaveBeenCalled()
  })

  it('llama onCancel al hacer click en Cancelar', () => {
    const onCancel = vi.fn()
    render(<RecipeEditorDialog {...baseProps} onCancel={onCancel} />)
    const cancelarBtn = screen.getByRole('button', { name: /Cancelar/i })
    fireEvent.click(cancelarBtn)
    expect(onCancel).toHaveBeenCalled()
  })
})
