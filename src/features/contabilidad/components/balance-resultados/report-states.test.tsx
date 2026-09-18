import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { AccountingPolicyRequiredState } from './report-states';

describe('AccountingPolicyRequiredState', () => {
  it('muestra CTA accesible solo con capacidad confirmada por servidor', async () => {
    const onRetry = vi.fn();
    const { container } = render(
      <AccountingPolicyRequiredState
        canManage
        configurationHref="/busy/contabilidad/configuracion"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Define la moneda funcional para consultar este reporte',
    );
    expect(screen.getByRole('link', { name: 'Configurar moneda funcional' })).toHaveAttribute(
      'href',
      '/busy/contabilidad/configuracion',
    );
    expect(screen.getByText(/independiente de la moneda principal del catálogo/i))
      .toBeInTheDocument();
    expect(screen.queryByText(/sin movimientos|0,00/i)).not.toBeInTheDocument();
    expect((await axe(container)).violations).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('orienta a contactar al administrador sin exponer CTA ejecutable', async () => {
    const { container } = render(
      <AccountingPolicyRequiredState
        canManage={false}
        configurationHref={null}
        onRetry={vi.fn()}
      />,
    );

    expect(within(container).queryByRole('link', { name: 'Configurar moneda funcional' }))
      .not.toBeInTheDocument();
    expect(screen.getByText(/Solicita a un administrador de esta empresa/i))
      .toBeInTheDocument();
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
