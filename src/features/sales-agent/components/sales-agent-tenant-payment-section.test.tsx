import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  confirmSalesAgentPaymentAction,
  getAdminSalesAgentTenantPaymentsAction,
} from '../actions';
import { SalesAgentTenantPaymentSection } from './sales-agent-tenant-payment-section';

vi.mock('../actions', () => ({
  confirmSalesAgentPaymentAction: vi.fn(),
  getAdminSalesAgentTenantPaymentsAction: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('SalesAgentTenantPaymentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminSalesAgentTenantPaymentsAction).mockResolvedValue({
      success: true,
      data: [{
        referralId: 'referral-1',
        salesAgentUserId: 'agent-1',
        salesAgentName: 'Gestor Uno',
        tenantId: 'tenant-1',
        tenantName: 'Tenant Uno',
        tenantLicenseId: 'license-1',
        planName: 'Profesional',
        amountUsd: '100.00',
        cycleEndsAt: new Date('2030-01-01T00:00:00.000Z'),
        paymentStatus: 'pending',
      }],
    } as never);
    vi.mocked(confirmSalesAgentPaymentAction).mockResolvedValue({
      success: true,
      data: { credited: true, duplicate: false, ledgerId: 'ledger-1' },
    } as never);
  });

  it('wires tenant payment confirmation without replacing the payout surface', async () => {
    render(<SalesAgentTenantPaymentSection />);

    const openButton = await screen.findByRole('button', {
      name: /confirmar pago del tenant/i,
    });
    fireEvent.click(openButton);
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => {
      expect(confirmSalesAgentPaymentAction).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        tenantLicenseId: 'license-1',
        amountPaidUsd: 100,
        idempotencyKey: 'sales-agent:license-1:2030-01-01T00:00:00.000Z',
      });
    });
  });
});
