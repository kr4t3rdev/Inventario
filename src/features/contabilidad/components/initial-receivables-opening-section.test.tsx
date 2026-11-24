import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { InitialReceivableDraft } from '../services/initialization-additional-drafts';
import { InitialReceivablesOpeningSection } from './initial-receivables-opening-section';

const draft: InitialReceivableDraft = {
  referenciaFila: 'receivable-1', clienteId: 'client-1', referenciaExterna: 'FAC-1',
  moneda: 'CUP', saldo: '250', fechaVencimiento: '', tasaCambio: '',
  tasaInteres: '', tasaInteresMoratorio: '',
};

const renderSection = (
  rows: InitialReceivableDraft[],
  onChange = vi.fn(),
  canLoanReceivable = false,
) => {
  render(
    <InitialReceivablesOpeningSection
      rows={rows} clients={[{ id: 'client-1', nombre: 'Cliente 1' }]}
      currencies={['CUP', 'USD']} functionalCurrency="CUP"
      canLoanReceivable={canLoanReceivable} onChange={onChange}
    />,
  );
  return onChange;
};

describe('InitialReceivablesOpeningSection', () => {
  it('adds a blank receivable row with CUP as default', () => {
    const onChange = renderSection([]);
    expect(screen.queryByLabelText('Interés ordinario del préstamo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /agregar cuenta por cobrar/i }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ clienteId: '', referenciaExterna: '', saldo: '', moneda: 'CUP' }),
    ]);
  });

  it('updates and removes a receivable row without mutating the original', () => {
    const onChange = renderSection([draft]);
    fireEvent.change(screen.getByLabelText('Saldo inicial de CxC'), { target: { value: '300' } });
    expect(onChange).toHaveBeenCalledWith([{ ...draft, saldo: '300' }]);
    expect(draft.saldo).toBe('250');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta por cobrar 1' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('shows loan interest fields only when the plan enables loans', () => {
    renderSection([{ ...draft, moneda: 'USD' }], vi.fn(), true);
    expect(screen.getByLabelText('Interés ordinario del préstamo')).toBeInTheDocument();
    expect(screen.getByLabelText('Interés moratorio del préstamo')).toBeInTheDocument();
    expect(screen.getByLabelText('Tasa de cambio de CxC')).toBeInTheDocument();
  });
});
