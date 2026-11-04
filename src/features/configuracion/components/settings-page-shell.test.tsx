import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Building2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { SettingsPageShell } from './settings-page-shell';

describe('SettingsPageShell', () => {
  it('presenta título, descripción, acción y contenido en una estructura de página común', () => {
    render(
      <SettingsPageShell
        icon={Building2}
        title="Mi Empresa"
        description="Administra la información de tu empresa."
        actions={<button type="button">Guardar</button>}
      >
        <p>Configuración general</p>
      </SettingsPageShell>,
    );

    const heading = screen.getByRole('heading', { name: 'Mi Empresa' });
    const header = heading.closest('header');

    expect(header).toContainElement(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('Administra la información de tu empresa.')).toBeInTheDocument();
    expect(screen.getByText('Configuración general')).toBeInTheDocument();
  });
});
