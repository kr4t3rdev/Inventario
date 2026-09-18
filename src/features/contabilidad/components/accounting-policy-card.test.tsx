import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getStateMock = vi.hoisted(() => vi.fn());
const setPolicyMock = vi.hoisted(() => vi.fn());
const approvalMock = vi.hoisted(() => vi.fn());
const getCurrenciesMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad/actions-accounting-policy', () => ({
  getAccountingPolicyStateAction: getStateMock,
  setInitialAccountingPolicyAction: setPolicyMock,
  createTenantAccountingPolicyApprovalAction: approvalMock,
}));
vi.mock('@/features/contabilidad/actions-exchange', () => ({
  getMonedasAction: getCurrenciesMock,
}));

import { AccountingPolicyCard } from './accounting-policy-card';

describe('AccountingPolicyCard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('confirma explícitamente una moneda activa y anuncia el resultado', async () => {
    getStateMock.mockResolvedValue({
      success: true,
      data: { policy: null, evidence: 'NONE', canManage: true },
    });
    getCurrenciesMock.mockResolvedValue({
      success: true,
      data: [{ codigo: 'CUP', nombre: 'Peso cubano', isActive: true }],
    });
    setPolicyMock.mockResolvedValue({
      success: true,
      data: { result: 'CREATED', functionalCurrencyCode: 'CUP' },
    });
    const user = userEvent.setup();
    render(<AccountingPolicyCard />);

    await user.selectOptions(await screen.findByRole('combobox', {
      name: 'Moneda funcional contable',
    }), 'CUP');
    await user.type(
      screen.getByLabelText('Motivo de la decisión'),
      'CUP confirmada por la administración de la empresa',
    );
    await user.click(screen.getByRole('checkbox', {
      name: /Confirmo que esta será la moneda funcional contable/i,
    }));
    await user.click(screen.getByRole('button', { name: 'Guardar moneda funcional' }));

    await waitFor(() => expect(setPolicyMock).toHaveBeenCalledWith(expect.objectContaining({
      functionalCurrencyCode: 'CUP',
    })));
    expect(screen.getByRole('status')).toHaveTextContent('Moneda funcional configurada');
  });

  it('muestra solo lectura cuando la política ya existe', async () => {
    getStateMock.mockResolvedValue({
      success: true,
      data: {
        policy: { functionalCurrencyCode: 'CUP', createdAt: '2026-08-25', updatedBy: 'user-a' },
        evidence: null,
        canManage: true,
      },
    });
    getCurrenciesMock.mockResolvedValue({ success: true, data: [] });

    const { container } = render(<AccountingPolicyCard />);

    expect(await within(container).findByText('CUP')).toBeInTheDocument();
    expect(within(container).queryByRole('button', { name: 'Guardar moneda funcional' }))
      .not.toBeInTheDocument();
  });

  it('trata los envelopes fallidos de las cargas iniciales como un error neutral y permite reintentar', async () => {
    getStateMock.mockResolvedValueOnce({
      success: false,
      error: { message: 'No autorizado' },
    }).mockResolvedValueOnce({
      success: true,
      data: { policy: null, evidence: 'NONE', canManage: true },
    });
    getCurrenciesMock.mockResolvedValueOnce({
      success: false,
      error: { message: 'No disponible' },
    }).mockResolvedValueOnce({
      success: true,
      data: [{ codigo: 'CUP', nombre: 'Peso cubano', isActive: true }],
    });
    render(<AccountingPolicyCard />);

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('No se pudo cargar la configuración contable. Intenta nuevamente.');
    expect(screen.queryByText('Solo un administrador de esta empresa'))
      .not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Intenta nuevamente' }));

    expect(await screen.findByRole('combobox', { name: 'Moneda funcional contable' }))
      .toBeInTheDocument();
    expect(getStateMock).toHaveBeenCalledTimes(2);
    expect(getCurrenciesMock).toHaveBeenCalledTimes(2);
  });

  it('muestra un error y libera el formulario cuando el guardado rechaza la promesa', async () => {
    getStateMock.mockResolvedValue({
      success: true,
      data: { policy: null, evidence: 'NONE', canManage: true },
    });
    getCurrenciesMock.mockResolvedValue({
      success: true,
      data: [{ codigo: 'CUP', nombre: 'Peso cubano', isActive: true }],
    });
    setPolicyMock.mockRejectedValueOnce(new Error('network failure'));
    const user = userEvent.setup();
    render(<AccountingPolicyCard />);

    await user.selectOptions(await screen.findByRole('combobox', {
      name: 'Moneda funcional contable',
    }), 'CUP');
    await user.type(
      screen.getByLabelText('Motivo de la decisión'),
      'CUP confirmada por la administración de la empresa',
    );
    await user.click(screen.getByRole('checkbox', {
      name: /Confirmo que esta será la moneda funcional contable/i,
    }));
    const submit = screen.getByRole('button', { name: 'Guardar moneda funcional' });
    await user.click(submit);

    await waitFor(() => expect(screen.getByRole('status'))
      .toHaveTextContent('No se pudo guardar la moneda funcional. Intenta nuevamente.'));
    expect(submit).not.toBeDisabled();
  });
});
