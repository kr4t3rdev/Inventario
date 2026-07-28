import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingAffiliateProgram } from '@/features/landing/components/affiliate-program';

describe('LandingAffiliateProgram', () => {
  it('starts with the tenant path and switches to the sales-agent path', async () => {
    const user = userEvent.setup();
    render(<LandingAffiliateProgram />);

    expect(screen.getByRole('tab', { name: /ya uso financemdm/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Tu próxima licencia puede costarte menos')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /quiero recomendarlo/i }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /quiero recomendarlo/i })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByText('Cobrá por cada renovación confirmada')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /registrarme como gestor/i })).toBeInTheDocument();
  });
});
