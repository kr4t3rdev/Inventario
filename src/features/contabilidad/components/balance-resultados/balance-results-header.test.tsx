import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BalanceResultsHeader } from './balance-results-header';

describe('BalanceResultsHeader', () => {
  it('no presenta CUP ni fechas ficticias mientras falta el reporte', () => {
    const { container } = render(
      <BalanceResultsHeader
        data={null}
        activeView="balance"
        year="2026"
        yearOptions={[2026]}
        currentYear={2026}
        isLoading={false}
        onYearChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('Sin configurar')).toBeInTheDocument();
    expect(screen.getAllByText('Sin cálculo')).toHaveLength(2);
    expect(screen.getAllByText('Pendiente')).toHaveLength(2);
    expect(within(container).queryByText('CUP')).not.toBeInTheDocument();
  });
});
