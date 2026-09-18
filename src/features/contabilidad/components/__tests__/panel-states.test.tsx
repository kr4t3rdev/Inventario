import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PanelSkeleton, PanelError } from '../panel-states';

describe('PanelSkeleton', () => {
  it('anuncia el estado de carga con aria-busy y label accesible', () => {
    render(<PanelSkeleton rows={3} />);

    const region = screen.getByLabelText('Cargando');
    expect(region).toHaveAttribute('aria-busy', 'true');
  });

  it('renderiza tantas filas como se indique', () => {
    const { container } = render(<PanelSkeleton rows={4} />);

    const filas = container.querySelectorAll('[data-slot="skeleton"]');
    expect(filas.length).toBeGreaterThanOrEqual(4);
  });

  it('acepta un título opcional para dar contexto mientras carga', () => {
    render(<PanelSkeleton rows={2} title="Deudas en Efectivo" />);

    expect(screen.getByText('Deudas en Efectivo')).toBeInTheDocument();
  });
});

describe('PanelError', () => {
  it('expone role=alert con el mensaje del fallo', () => {
    render(<PanelError message="No se pudieron cargar las estadísticas." />);

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudieron cargar las estadísticas.');
  });

  it('muestra botón de reintento y lo invoca al hacer click', async () => {
    const onRetry = vi.fn();
    render(<PanelError message="Error al cargar" onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: /intentar nuevamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sin onRetry no renderiza botón (estado informativo puro)', () => {
    render(<PanelError message="Sin conexión" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('LastUpdatedLabel', () => {
  it('muestra la hora de actualización en formato corto', async () => {
    const { LastUpdatedLabel } = await import('../panel-states');
    render(<LastUpdatedLabel date={new Date(2026, 7, 12, 14, 32)} />);

    expect(screen.getByText('Actualizado a las 14:32')).toBeInTheDocument();
  });
});
