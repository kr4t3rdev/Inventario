import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { confirmSalesAgentPayoutAction } from '@/features/sales-agent/actions';
import { SalesAgentPayoutDialog } from '../sales-agent-payout-dialog';

vi.mock('@/features/sales-agent/actions', () => ({
  confirmSalesAgentPayoutAction: vi.fn(),
}));

describe('SalesAgentPayoutDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('supports full payout and shows the CUP preview without making it authoritative', () => {
    render(
      <SalesAgentPayoutDialog
        open
        agent={{ userId: 'agent-1', name: 'Ana', availableUsd: 40, phone: '+53 5555' }}
        onOpenChange={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );

    expect(screen.getByText(/Ana.*\+53 5555.*40\.00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /usar saldo total/i }));
    fireEvent.change(screen.getByLabelText(/tasa cup\/usd/i), { target: { value: '320' } });
    expect(screen.getByText(/12,800.00 CUP/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar pago' })).toBeVisible();
  });

  it('reuses one idempotency key for double submit and retry after a lost response', async () => {
    let rejectFirstRequest: ((reason?: unknown) => void) | undefined;
    vi.mocked(confirmSalesAgentPayoutAction)
      .mockImplementationOnce(() => new Promise((_, reject) => {
        rejectFirstRequest = reject;
      }))
      .mockResolvedValueOnce({
        success: true,
        data: { amountCup: 8000 },
      } as never);

    render(
      <SalesAgentPayoutDialog
        open
        agent={{ userId: 'agent-1', name: 'Ana', availableUsd: 40, phone: null }}
        onOpenChange={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/monto usd/i), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText(/tasa cup\/usd/i), { target: { value: '320' } });
    const submit = screen.getByRole('button', { name: /confirmar pago/i });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(confirmSalesAgentPayoutAction).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();
    const firstKey = vi.mocked(confirmSalesAgentPayoutAction).mock.calls[0][0].idempotencyKey;

    rejectFirstRequest?.(new Error('response lost'));
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(confirmSalesAgentPayoutAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(confirmSalesAgentPayoutAction).mock.calls[1][0].idempotencyKey)
      .toBe(firstKey);
  });
});
