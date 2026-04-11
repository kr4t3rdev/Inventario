import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RecipeOutputSelector } from '../recipe-output-selector';

vi.mock('../producto-salida-form', () => ({
  ProductoSalidaForm: ({
    onSuccess,
  }: {
    onSuccess: (product: { id: string; nombre: string }) => void;
  }) => (
    <button
      onClick={() => onSuccess({ id: 'prod-new', nombre: 'Jarabe nuevo' })}
      type='button'
    >
      Mock crear producto
    </button>
  ),
}));

describe('RecipeOutputSelector', () => {
  const products = [
    { id: 'prod-1', nombre: 'Producto existente' },
    { id: 'prod-2', nombre: 'Producto 2' },
  ];

  it('muestra los dos caminos para producto de salida', () => {
    render(
      <RecipeOutputSelector
        createdProductName={null}
        onCreatedProduct={vi.fn()}
        onProductChange={vi.fn()}
        onModeChange={vi.fn()}
        products={products}
        selectedMode='existing'
        selectedProductId=''
      />
    );

    expect(screen.getByRole('button', { name: /usar producto existente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear producto nuevo/i })).toBeInTheDocument();
    expect(screen.getByText(/producto final de salida/i)).toBeInTheDocument();
  });

  it('permite cambiar al modo crear y asigna automáticamente el producto creado', () => {
    const onModeChange = vi.fn();
    const onProductChange = vi.fn();
    const onCreatedProduct = vi.fn();

    render(
      <RecipeOutputSelector
        createdProductName={null}
        onCreatedProduct={onCreatedProduct}
        onProductChange={onProductChange}
        onModeChange={onModeChange}
        products={products}
        selectedMode='create'
        selectedProductId=''
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir formulario de producto/i }));
    fireEvent.click(screen.getByRole('button', { name: /mock crear producto/i }));

    expect(onProductChange).toHaveBeenCalledWith('prod-new');
    expect(onCreatedProduct).toHaveBeenCalledWith({ id: 'prod-new', nombre: 'Jarabe nuevo' });
  });
});
