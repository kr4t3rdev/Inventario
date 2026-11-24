import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { InitialPayableDraft } from '../services/initialization-additional-drafts';
import { InitialPayablesOpeningSection } from './initial-payables-opening-section';

const draft: InitialPayableDraft = {
  referenciaFila: 'payable-1', proveedorId: 'supplier-1', referenciaExterna: 'FAC-2',
  moneda: 'CUP', saldo: '325', fechaVencimiento: '', tasaCambio: '',
};

const renderSection = (rows: InitialPayableDraft[], onChange = vi.fn()) => {
  render(
    <InitialPayablesOpeningSection
      rows={rows} suppliers={[{ id: 'supplier-1', nombre: 'Proveedor 1' }]}
      currencies={['CUP', 'USD']} functionalCurrency="CUP" onChange={onChange}
    />,
  );
  return onChange;
};

describe('InitialPayablesOpeningSection', () => {
  it('adds a blank payable row in the functional currency', () => {
    const onChange = renderSection([]);
    fireEvent.click(screen.getByRole('button', { name: /agregar cuenta por pagar/i }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ proveedorId: '', referenciaExterna: '', saldo: '', moneda: 'CUP' }),
    ]);
  });

  it('updates and removes a payable row without mutating the original', () => {
    const onChange = renderSection([draft]);
    fireEvent.change(screen.getByLabelText('Saldo inicial de CxP'), { target: { value: '400' } });
    expect(onChange).toHaveBeenCalledWith([{ ...draft, saldo: '400' }]);
    expect(draft.saldo).toBe('325');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta por pagar 1' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('shows the exchange-rate field only for a nonfunctional currency', () => {
    renderSection([{ ...draft, moneda: 'USD' }]);
    expect(screen.getByLabelText('Tasa de cambio de CxP')).toBeInTheDocument();
  });
});
