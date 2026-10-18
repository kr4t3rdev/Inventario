import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { confirmSalesAgentPayoutAction } from '@/features/sales-agent/actions';
import { SalesAgentPayoutDialog } from '../sales-agent-payout-dialog';

vi.mock('@/features/sales-agent/actions', () => ({
  confirmSalesAgentPayoutAction: vi.fn(),
}));

/**
 * @description Primer argumento de la n-esima llamada de un mock tipado.
 *
 * `mock.calls` se tipa como `unknown[][]`, de modo que llamar directamente a
 * `calls[n][0].propiedad` falla con TS2532. El helper acota esa lectura y
 * devuelve el tipo del valor realmente registrado (el payload), evitando el
 * envoltorio ActionResponse. Las aserciones previas de `toHaveBeenCalledTimes`
 * garantizan la llamada.
 *
 * @param {Mock} mock - Mock tipado con `vi.mocked`.
 * @param {number} index - Indice de la llamada.
 * @returns {Arg} Primer argumento de esa llamada.
 */
function mockArgAt<Mock extends (...args: never[]) => unknown, Arg = Parameters<Mock>[0]>(
  mock: Mock,
  index: number,
): NonNullable<Arg> {
  const call = (mock as unknown as { mock: { calls: unknown[][] } }).mock.calls[index];
  if (!call) throw new Error(`El mock no registro la llamada ${index}`);
  const first = call[0];
  if (first === undefined) throw new Error(`La llamada ${index} no tiene argumentos`);
  return first as NonNullable<Arg>;
}

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
    const firstKey = mockArgAt(vi.mocked(confirmSalesAgentPayoutAction), 0).idempotencyKey;

    rejectFirstRequest?.(new Error('response lost'));
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(confirmSalesAgentPayoutAction).toHaveBeenCalledTimes(2));
    expect(mockArgAt(vi.mocked(confirmSalesAgentPayoutAction), 1).idempotencyKey)
      .toBe(firstKey);
  });
});
