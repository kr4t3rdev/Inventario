import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/admin', () => ({
  createAdminPlanAction: vi.fn(),
  deleteAdminPlanAction: vi.fn(),
  getAdminPlanesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  updateAdminPlanAction: vi.fn(),
}));

import AdminPlanesPage from './page';

describe('AdminPlanesPage', () => {
  it('usa el encabezado común y conserva la acción para crear planes', async () => {
    render(<AdminPlanesPage />);

    const heading = screen.getByRole('heading', { name: 'Planes' });
    const header = heading.closest('header');
    const createButton = screen.getByRole('button', { name: 'Nuevo Plan' });

    expect(header).toContainElement(createButton);
    expect(
      screen.getByText('Gestión de planes de suscripción con módulos y límites'),
    ).toBeInTheDocument();
    expect(await screen.findByText('No hay planes configurados')).toBeInTheDocument();
  });
});
