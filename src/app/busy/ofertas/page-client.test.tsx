import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfertasPageContent } from './page-client';

vi.mock('@/features/ofertas/components/ofertas-table', () => ({
  OfertasTable: () => <div />,
}));

describe('OfertasPageContent', () => {
  it('mantiene el título y la acción en el mismo encabezado adaptable', () => {
    render(<OfertasPageContent ofertas={[]} />);

    const title = screen.getByRole('heading', { name: 'Ofertas' });
    const action = screen.getByRole('link', { name: 'Nueva Oferta' });
    const header = title.closest('header');

    expect(header).toContainElement(action);
    expect(header).toHaveClass('sm:justify-between');
  });
});
