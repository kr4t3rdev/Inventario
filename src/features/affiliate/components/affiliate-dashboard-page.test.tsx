import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  generateReferralCodeAction,
  getAffiliateDashboardAction,
  getReferralPerkCatalogAction,
} from '@/features/affiliate';
import { AffiliateDashboardPage } from './affiliate-dashboard-page';

vi.mock('@/features/affiliate', () => ({
  generateReferralCodeAction: vi.fn(),
  getAffiliateDashboardAction: vi.fn(),
  getReferralPerkCatalogAction: vi.fn(),
  requestCustomReferralPerkAction: vi.fn(),
}));

const summary = {
  tenantId: 'tenant-1',
  referralCode: 'REF123',
  confirmedSalesCount: 2,
  currentTier: 'tier-1' as const,
  currentRate: 0.05,
  creditAvailableUsd: 10,
  totalPerkSlots: 1,
  assignedPerksCount: 0,
  pendingPerkSlots: 1,
  nextLicensePreview: null,
  referralLink: 'https://example.test/ref/REF123',
  referredTenants: [],
  perkGrants: [],
  customRequests: [],
};

describe('AffiliateDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(generateReferralCodeAction).mockResolvedValue({ success: true } as never);
    vi.mocked(getAffiliateDashboardAction).mockResolvedValue({
      success: true,
      data: summary,
    } as never);
    vi.mocked(getReferralPerkCatalogAction).mockResolvedValue({
      success: true,
      data: [],
    } as never);
  });

  it('usa el encabezado común y conserva el enlace de referido', async () => {
    render(<AffiliateDashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Referidos' })).toBeInTheDocument();
    });

    expect(screen.getByText('Obtén crédito para tu próxima licencia y beneficios exclusivos del programa.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeInTheDocument();
    expect(screen.getByText('Beneficios')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Título de la idea' })).toBeInTheDocument();
  });
});
