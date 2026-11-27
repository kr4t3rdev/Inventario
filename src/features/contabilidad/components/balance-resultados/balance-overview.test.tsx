import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BalanceOverview } from './balance-overview';
import type { BalanceData } from './types';

const openingBalance: BalanceData = {
  activos: { efectivo: 99_900, inventario: 100, cuentasPorCobrar: 0, total: 100_000 },
  pasivos: { deudaExterna: 0, cuentasPorPagar: 0, total: 0 },
  patrimonio: {
    capitalSocial: 0,
    resultadosAcumulados: 100_000,
    utilidadEjercicio: 0,
    total: 100_000,
  },
  ecuacion: {
    assets: 100_000,
    liabilitiesAndEquity: 100_000,
    difference: 0,
    status: 'CUADRADO',
  },
  monedaFuncional: 'CUP',
};

describe('BalanceOverview source labels', () => {
  it('atribuye resultados acumulados a aperturas contabilizadas y cierres aprobados', () => {
    render(<BalanceOverview balance={openingBalance} />);

    const row = screen.getByRole('row', { name: /Resultados acumulados/ });
    expect(within(row).getByText(/Fuente: Aperturas contabilizadas y cierres aprobados/)).toBeInTheDocument();
  });

  it('describe el patrimonio como aportes y resultados contables', () => {
    render(<BalanceOverview balance={openingBalance} />);

    expect(screen.getByText('Fuente: Aportes y resultados contables')).toBeInTheDocument();
  });
});
