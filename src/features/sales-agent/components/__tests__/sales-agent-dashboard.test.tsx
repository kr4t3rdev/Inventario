import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import QRCode from 'qrcode';
import { SalesAgentDashboard } from '../sales-agent-dashboard';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,local-qr') },
}));

const data = {
  referralCode: 'SA-OWNER',
  summary: {
    totalReferrals: 1,
    activeReferrals: 1,
    pendingReferrals: 0,
    tier: 'entry',
    commissionRate: '0.03',
    availableUsd: '3.00',
    paidUsd: '0.00',
    estimatedAvailableCup: '960.00',
    informationalRate: { cupPerUsd: '320', effectiveAt: new Date() },
  },
  referrals: [{
    salesAgentReferralId: 'ref-1',
    status: 'attributed',
    tenant: {
      commercialName: 'Comercial Demo',
      plan: 'Profesional',
      licenseStatus: 'active',
      licenseExpiration: new Date(),
      commissionBaseUsd: '100',
    },
  }],
  commissionHistory: [],
  paymentHistory: [],
  notifications: [],
};

describe('SalesAgentDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generates the QR locally from the first-party referral URL', async () => {
    render(<SalesAgentDashboard data={data} origin="https://finance.test" />);

    await waitFor(() => expect(QRCode.toDataURL).toHaveBeenCalledWith(
      'https://finance.test/register?ref=SA-OWNER',
      expect.objectContaining({ errorCorrectionLevel: 'M' }),
    ));
    expect(await screen.findByAltText('Código QR del enlace de referido'))
      .toHaveAttribute('src', 'data:image/png;base64,local-qr');
  });

  it('keeps WhatsApp text editable and displays only the commercial tenant view', async () => {
    render(<SalesAgentDashboard data={data} origin="https://finance.test" />);
    await screen.findByAltText('Código QR del enlace de referido');

    fireEvent.change(screen.getByLabelText('Mensaje de WhatsApp'), {
      target: { value: 'Mensaje elegido' },
    });
    expect(screen.getByRole('link', { name: /WhatsApp/i })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent('Mensaje elegido')),
    );
    expect(screen.getByText('Comercial Demo')).toBeInTheDocument();
    expect(screen.getByText(/Profesional · active/)).toBeInTheDocument();
  });
});
