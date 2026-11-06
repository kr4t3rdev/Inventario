import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { getAccountingPageTestState } from '@/features/contabilidad/test-utils/accounting-page-test-mocks';

import AjustesPage from './page';

const accountingPageTestState = getAccountingPageTestState();

describe('/busy/contabilidad/ajustes page', () => {
  beforeEach(() => {
    accountingPageTestState.replace.mockClear();
    accountingPageTestState.user = { role: 'admin' };
    accountingPageTestState.canAccess = false;
  });

  it('usa el shell contable y conserva el regreso al módulo', async () => {
    render(<AjustesPage />);

    expect(await screen.findByTestId('accounting-page-shell')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ajustes Bancarios' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Contabilidad' })).toHaveAttribute(
      'href',
      '/busy/contabilidad',
    );
    expect(screen.getByTestId('dynamic-accounting-content')).toBeInTheDocument();
  });

  it('redirige al usuario sin acceso a ajustes bancarios', async () => {
    accountingPageTestState.user = { role: 'user' };

    render(<AjustesPage />);

    await waitFor(() => expect(accountingPageTestState.replace).toHaveBeenCalledWith('/busy/contabilidad'));
    expect(screen.queryByTestId('accounting-page-shell')).not.toBeInTheDocument();
  });
});
