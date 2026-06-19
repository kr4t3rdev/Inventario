import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  CuadresHistoryPageClient,
  type CuadreCerradoListItem,
} from '../components/cuadres-history-page-client';

const baseItems: CuadreCerradoListItem[] = [
  {
    turnoId: 'turno-1',
    puntoDeVentaNombre: 'PV Centro',
    empleadoNombre: 'Ana Pérez',
    fechaApertura: new Date('2026-06-19T08:00:00.000Z'),
    fechaCierre: new Date('2026-06-19T16:00:00.000Z'),
    totalVentas: 320,
    diferenciaCup: 12.5,
    arqueado: true,
    totalTickets: 4,
  },
  {
    turnoId: 'turno-2',
    puntoDeVentaNombre: 'PV Norte',
    empleadoNombre: null,
    fechaApertura: new Date('2026-06-18T08:00:00.000Z'),
    fechaCierre: new Date('2026-06-18T16:00:00.000Z'),
    totalVentas: 0,
    diferenciaCup: null,
    arqueado: false,
    totalTickets: 0,
  },
];

describe('CuadresHistoryPageClient', () => {
  it('renders settlement rows and links to the existing detail route', () => {
    render(<CuadresHistoryPageClient items={baseItems} />);

    expect(screen.getByText('Historial de cuadres cerrados')).toBeInTheDocument();
    expect(screen.getAllByText('PV Centro')).toHaveLength(2);
    expect(screen.getAllByText('Ana Pérez')).toHaveLength(2);
    expect(screen.getAllByText('Sin arqueo')).toHaveLength(2);

    const links = screen.getAllByRole('link', { name: /ver cuadre/i });

    expect(links).toHaveLength(4);
    expect(links.filter((link) => link.getAttribute('href') === '/busy/sales/cuadre/turno-1?from=history')).toHaveLength(2);
    expect(links.filter((link) => link.getAttribute('href') === '/busy/sales/cuadre/turno-2?from=history')).toHaveLength(2);
  });

  it('renders empty state when there are no closed shifts', () => {
    render(<CuadresHistoryPageClient items={[]} />);

    expect(screen.getByText('Aún no hay cuadres cerrados guardados')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir al punto de venta/i })).toHaveAttribute(
      'href',
      '/busy/sales/new',
    );
  });
});
