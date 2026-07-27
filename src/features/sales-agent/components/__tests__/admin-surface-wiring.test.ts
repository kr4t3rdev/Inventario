import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('sales-agent payout admin surface wiring', () => {
  it('wires Confirmar pago into Admin Gestión de usuarios', () => {
    const table = readFileSync(
      'src/features/admin/components/admin-users-table.tsx',
      'utf8',
    );
    const page = readFileSync(
      'src/features/admin/components/admin-users-page-client.tsx',
      'utf8',
    );

    expect(table).toContain('onConfirmSalesAgentPayout');
    expect(table).toContain('Confirmar pago');
    expect(page).toContain('<SalesAgentPayoutDialog');
  });

  it('keeps the Sales Agent section separate from tenant affiliate UI', () => {
    const page = readFileSync('src/app/admin/referidos/page.tsx', 'utf8');

    expect(page).toContain('<SalesAgentAdminPayoutSection />');
    expect(page).toContain('getAffiliateAdminSummaryAction');
  });
});
