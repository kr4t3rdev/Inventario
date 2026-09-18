import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  buildResumenCompleto: vi.fn(),
}));

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/features/contabilidad/actions-resumen', () => ({
  buildResumenCompleto: mocks.buildResumenCompleto,
}));

vi.mock('@/features/contabilidad/components/resumen-financiero', () => ({
  ResumenFinanciero: (props: Record<string, unknown>) => (
    <div data-testid="resumen-financiero" data-props={JSON.stringify({ periodo: props.periodo, showPeriodSelector: props.showPeriodSelector, hasInitialData: props.initialData != null })} />
  ),
}));

import { ResumenFinancieroServer } from './resumen-financiero-server';

const usuario = {
  userId: 'u1',
  role: 'user',
  tenantId: 'tenant-a',
  planFeatures: { contabilidad: true, 'prestamos-cash': true, 'deudas-cash': true },
};

describe('ResumenFinancieroServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('precarga el mes actual y pasa initialData al componente cliente', async () => {
    mocks.getCurrentUser.mockResolvedValue(usuario);
    mocks.buildResumenCompleto.mockResolvedValue({ resumen: { resumenPorMoneda: [] } });

    render(<>{await ResumenFinancieroServer()}</>);

    expect(mocks.buildResumenCompleto).toHaveBeenCalledTimes(1);
    const el = screen.getByTestId('resumen-financiero');
    const props = JSON.parse(el.dataset.props ?? '{}');
    expect(props.hasInitialData).toBe(true);
    expect(props.showPeriodSelector).toBe(true);
  });

  it('sin sesión degrada a componente cliente sin initialData', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    render(<>{await ResumenFinancieroServer()}</>);

    expect(mocks.buildResumenCompleto).not.toHaveBeenCalled();
    const props = JSON.parse(screen.getByTestId('resumen-financiero').dataset.props ?? '{}');
    expect(props.hasInitialData).toBe(false);
  });

  it('si el prefetch falla degrada a modo cliente sin romper la página', async () => {
    mocks.getCurrentUser.mockResolvedValue(usuario);
    mocks.buildResumenCompleto.mockRejectedValue(new Error('db caída'));

    render(<>{await ResumenFinancieroServer()}</>);

    const props = JSON.parse(screen.getByTestId('resumen-financiero').dataset.props ?? '{}');
    expect(props.hasInitialData).toBe(false);
  });
});
