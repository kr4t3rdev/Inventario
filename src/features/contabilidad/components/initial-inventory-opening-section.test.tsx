import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { InitialInventoryDraft } from '../services/initialization-additional-drafts';
import { InitialInventoryOpeningSection } from './initial-inventory-opening-section';

const draft: InitialInventoryDraft = {
  referenciaFila: 'line-1', productoId: 'product-1', almacenId: 'warehouse-1', loteCodigo: 'LOT-1',
  cantidad: '3', costoUnitario: '12.50', moneda: 'CUP', tasaCambio: '', ubicacionId: '',
  fechaCorte: '', fechaVencimiento: '',
};

const renderSection = (rows: InitialInventoryDraft[], onChange = vi.fn()) => {
  render(
    <InitialInventoryOpeningSection
      rows={rows} products={[]} warehouses={[]} currencies={['CUP', 'USD']}
      functionalCurrency="CUP" onChange={onChange}
    />,
  );
  return onChange;
};

describe('InitialInventoryOpeningSection', () => {
  it('adds a blank inventory row with the draft defaults', async () => {
    const onChange = renderSection([]);

    fireEvent.click(screen.getByRole('button', { name: /agregar fila de inventario/i }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        productoId: '',
        almacenId: '',
        cantidad: '',
        costoUnitario: '',
        moneda: 'CUP',
      }),
    ]);
  });

  it('updates the selected row immutably when a field changes', () => {
    const onChange = renderSection([draft]);
    expect(screen.getByLabelText('Lote inicial')).not.toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByLabelText('Cantidad inicial')).toHaveAttribute('inputmode', 'decimal');

    fireEvent.change(screen.getByLabelText('Cantidad inicial'), {
      target: { value: '8' },
    });

    expect(onChange).toHaveBeenCalledWith([{ ...draft, cantidad: '8' }]);
    expect(draft.cantidad).toBe('3');
  });

  it('removes only the selected inventory row', () => {
    const secondDraft = { ...draft, referenciaFila: 'line-2' };
    const onChange = renderSection([draft, secondDraft]);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar existencia 1' }));

    expect(onChange).toHaveBeenCalledWith([secondDraft]);
  });
});
