import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { getAccountingPageTestState } from '@/features/contabilidad/test-utils/accounting-page-test-mocks';

import ExchangePage from './page';

const accountingPageTestState = getAccountingPageTestState();

describe('/busy/contabilidad/exchange page', () => {
  beforeEach(() => {
    accountingPageTestState.replace.mockClear();
    accountingPageTestState.user = { role: 'admin' };
  });

  it('usa el shell contable y conserva la navegación y el contenido', async () => {
    render(<ExchangePage />);

    expect(await screen.findByTestId('accounting-page-shell')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Exchange y Monedas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Contabilidad' })).toHaveAttribute(
      'href',
      '/busy/contabilidad',
    );
    expect(screen.getByTestId('dynamic-accounting-content')).toBeInTheDocument();
  });

  it('redirige cuando la función multi-moneda está deshabilitada', async () => {
    accountingPageTestState.user = { role: 'user', planFeatures: { 'multi-moneda': false } };

    render(<ExchangePage />);

    await waitFor(() => expect(accountingPageTestState.replace).toHaveBeenCalledWith('/busy/contabilidad'));
    expect(screen.queryByTestId('accounting-page-shell')).not.toBeInTheDocument();
  });
});
