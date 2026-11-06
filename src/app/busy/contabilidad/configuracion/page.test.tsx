import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/contabilidad-formal/components/plan-contable-card', () => ({
  PlanContableCard: () => <div>Plan contable</div>,
}));

import { getAccountingPageTestState } from '@/features/contabilidad/test-utils/accounting-page-test-mocks';

import ConfiguracionPage from './page';

const accountingPageTestState = getAccountingPageTestState();

describe('/busy/contabilidad/configuracion page', () => {
  beforeEach(() => {
    accountingPageTestState.replace.mockClear();
    accountingPageTestState.user = { role: 'admin' };
  });

  it('usa el shell contable y conserva contenido y regreso', async () => {
    render(<ConfiguracionPage />);

    expect(await screen.findByTestId('accounting-page-shell')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Políticas contables')).toBeInTheDocument());
    expect(screen.getByTestId('dynamic-accounting-content')).toBeInTheDocument();
    expect(screen.getByText('Plan contable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Contabilidad' })).toHaveAttribute(
      'href',
      '/busy/contabilidad',
    );
  });
});
