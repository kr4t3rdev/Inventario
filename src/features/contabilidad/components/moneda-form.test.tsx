import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/features/contabilidad/actions-exchange', () => ({
  createMonedaAction: vi.fn(),
  updateMonedaAction: vi.fn(),
}));

vi.mock('@/lib/sileo-shim', () => ({
  sileo: { success: vi.fn(), error: vi.fn() },
}));

import { MonedaForm } from './moneda-form';

describe('MonedaForm — marca del catálogo', () => {
  it('describe esPrincipal como base de tasas y no como moneda de la empresa', () => {
    render(<MonedaForm onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(
      screen.getByText('Moneda base para la formación del catálogo de tasas de cambio'),
    ).toBeInTheDocument();
    // La moneda de la empresa se cambia desde la política contable, no aquí.
    expect(screen.queryByText('Moneda Principal')).not.toBeInTheDocument();
  });
});
