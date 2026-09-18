import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAdminSalesAgentPayoutsAction } from '@/features/sales-agent/actions';
import { SalesAgentAdminPayoutSection } from '../sales-agent-admin-payout-section';

vi.mock('@/features/sales-agent/actions', () => ({
  getAdminSalesAgentPayoutsAction: vi.fn(),
  confirmSalesAgentPayoutAction: vi.fn(),
}));

describe('SalesAgentAdminPayoutSection', () => {
  beforeEach(() => {
    vi.mocked(getAdminSalesAgentPayoutsAction).mockResolvedValue({
      success: true,
      data: [{
        userId: 'agent-1',
        name: 'Ana',
        isActive: true,
        salesAgentProfile: { phone: '+53 5555', status: 'active' },
        salesAgentBalance: { availableUsd: '40.00', paidUsd: '10.00' },
        salesAgentReferrals: [{ salesAgentReferralId: 'ref-1' }],
        activeReferralCount: 1,
        commissionRate: '0.03',
        salesAgentPayouts: [],
      }],
    } as never);
  });

  it('shows the separated Sales Agent payout surface in Admin Referidos', async () => {
    render(<SalesAgentAdminPayoutSection />);

    expect(await screen.findByText('Gestores de Ventas · Pagos presenciales')).toBeVisible();
    expect(screen.getByText('+53 5555')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirmar pago' })).toBeVisible();
  });
});
