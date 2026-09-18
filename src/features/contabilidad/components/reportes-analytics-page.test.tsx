import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const fetchMock = vi.fn(async () =>
  new Response(new Blob(['csv-data'], { type: 'text/csv' }), { status: 200 }),
);

vi.mock('@/features/contabilidad/actions-exchange', () => ({
  getMonedasAction: vi.fn().mockResolvedValue({
    success: true,
    data: [{ codigo: 'CUP', esPrincipal: true }],
  }),
}));

beforeEach(() => {
  fetchMock.mockClear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  if (!window.URL.createObjectURL) {
    Object.defineProperty(window.URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:mock'),
    });
  }
  if (!window.URL.revokeObjectURL) {
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });
  }
});

afterEach(() => {
  vi.useRealTimers();
});

vi.mock('@/features/contabilidad/hooks/use-cuentas-bancarias', () => ({
  useCuentasBancarias: () => ({
    cuentas: [
      { cuentaId: 'cta-aaa', nombreBanco: 'Banco A', numeroCuenta: '1111', moneda: 'CUP' },
      { cuentaId: 'cta-bbb', nombreBanco: 'Banco B', numeroCuenta: '2222', moneda: 'USD' },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/features/contabilidad/components/resumen-financiero', () => ({
  ResumenFinanciero: (props: Record<string, unknown>) => (
    <div
      data-testid="resumen-financiero"
      data-fecha-inicio={(props.fechaInicio as string) ?? ''}
      data-fecha-fin={(props.fechaFin as string) ?? ''}
      data-cuenta-id={(props.cuentaId as string) ?? ''}
      data-refresh-token={(props.refreshToken as number) ?? 0}
    />
  ),
}));

vi.mock('@/features/contabilidad/components/movimientos-table', () => ({
  MovimientosTable: (props: Record<string, unknown>) => (
    <div
      data-testid="movimientos-table"
      data-fecha-inicio={(props.fechaInicio as string) ?? ''}
      data-fecha-fin={(props.fechaFin as string) ?? ''}
      data-cuenta-id={(props.cuentaId as string) ?? ''}
    >
      <button
        type="button"
        data-testid="trigger-local-busqueda"
        onClick={() =>
          (props.onLocalFiltersChange as ((f: Record<string, unknown>) => void) | undefined)?.({
            busqueda: 'servicio',
          })
        }
      >
        Cambiar búsqueda
      </button>
      <button
        type="button"
        data-testid="trigger-local-moneda"
        onClick={() =>
          (props.onLocalFiltersChange as ((f: Record<string, unknown>) => void) | undefined)?.({
            moneda: 'USD',
          })
        }
      >
        Cambiar moneda
      </button>
      <button
        type="button"
        data-testid="trigger-local-tipo"
        onClick={() =>
          (props.onLocalFiltersChange as ((f: Record<string, unknown>) => void) | undefined)?.({
            tipoMovimiento: 'venta',
          })
        }
      >
        Cambiar tipo
      </button>
      <button type="button" onClick={() => (props.onExport as ((t: 'csv' | 'pdf') => void) | undefined)?.('csv')}>
        CSV
      </button>
      <button type="button" onClick={() => (props.onExport as ((t: 'csv' | 'pdf') => void) | undefined)?.('pdf')}>
        PDF
      </button>
    </div>
  ),
}));

vi.mock('@/features/contabilidad/components/account-transaction-history', () => ({
  AccountTransactionHistory: (props: Record<string, unknown>) => (
    <div
      data-testid="account-transaction-history"
      data-fecha-inicio={(props.fechaInicio as string) ?? ''}
      data-fecha-fin={(props.fechaFin as string) ?? ''}
      data-cuenta-id={(props.cuentaId as string) ?? ''}
    />
  ),
}));

vi.mock('@/features/contabilidad/components/date-range-picker', () => ({
  DateRangePicker: ({ fechaInicio, fechaFin, onChange }: {
    fechaInicio?: string;
    fechaFin?: string;
    onChange: (fechaInicio: string, fechaFin: string) => void;
  }) => (
    <div data-testid="date-range-picker">
      <button
        type="button"
        data-testid="date-range-april"
        onClick={() => onChange('2026-04-01', '2026-04-30')}
      >
        Abril 2026
      </button>
      <button
        type="button"
        data-testid="date-range-may"
        onClick={() => onChange('2026-05-01', '2026-05-31')}
      >
        Mayo 2026
      </button>
      <span data-testid="date-range-current">
        {fechaInicio || ''}___{fechaFin || ''}
      </span>
    </div>
  ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/token', () => ({
  getAuthToken: () => null,
}));

import { ReportesAnalyticsPage } from './reportes-analytics-page';

describe('ReportesAnalyticsPage — Contrato de filtros (Fase 0)', () => {
  async function renderPage() {
    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<ReportesAnalyticsPage />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return result;
  }

  it('renderiza Resumen, Movimientos y Por cuenta con los filtros globales iniciales', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('resumen-financiero')).toBeInTheDocument();
    });

    const resumen = screen.getByTestId('resumen-financiero');
    expect(resumen.getAttribute('data-fecha-inicio')).toBe('');
    expect(resumen.getAttribute('data-fecha-fin')).toBe('');
    expect(resumen.getAttribute('data-cuenta-id')).toBe('');

    const tabResumen = screen.getByRole('tab', { name: /resumen/i });
    const tabMovimientos = screen.getByRole('tab', { name: /movimientos/i });
    const tabCuenta = screen.getByRole('tab', { name: /por cuenta/i });

    await userEvent.setup().click(tabMovimientos);
    expect(screen.getByTestId('movimientos-table')).toBeInTheDocument();
    expect(screen.getByTestId('movimientos-table').getAttribute('data-fecha-inicio')).toBe('');
    expect(screen.getByTestId('movimientos-table').getAttribute('data-fecha-fin')).toBe('');

    await userEvent.setup().click(tabCuenta);
    expect(screen.queryByTestId('account-transaction-history')).not.toBeInTheDocument();
  });

  it('cambiar el rango de fechas globales propaga a Resumen, Movimientos y Por cuenta', async () => {
    await renderPage();

    const user = userEvent.setup();
    const picker = await screen.findByTestId('date-range-picker');
    expect(picker).toBeInTheDocument();

    await user.click(screen.getByTestId('date-range-april'));

    await waitFor(() => {
      expect(screen.getByTestId('date-range-current').textContent).toBe(
        '2026-04-01___2026-04-30',
      );
    });

    await user.click(screen.getByRole('tab', { name: /resumen/i }));
    const resumen = await screen.findByTestId('resumen-financiero');
    expect(resumen.getAttribute('data-fecha-inicio')).toBe('2026-04-01');
    expect(resumen.getAttribute('data-fecha-fin')).toBe('2026-04-30');
    expect(resumen.getAttribute('data-cuenta-id')).toBe('');

    await user.click(screen.getByRole('tab', { name: /movimientos/i }));
    const movimientos = await screen.findByTestId('movimientos-table');
    expect(movimientos.getAttribute('data-fecha-inicio')).toBe('2026-04-01');
    expect(movimientos.getAttribute('data-fecha-fin')).toBe('2026-04-30');

    await user.click(screen.getByRole('tab', { name: /por cuenta/i }));
    await user.click(screen.getByRole('combobox', { name: /filtrar reportes por cuenta bancaria/i }));
    await user.click(await screen.findByRole('option', { name: /Banco A/i }));
    const cuenta = await screen.findByTestId('account-transaction-history');
    expect(cuenta.getAttribute('data-fecha-inicio')).toBe('2026-04-01');
    expect(cuenta.getAttribute('data-fecha-fin')).toBe('2026-04-30');
  });

  it('cambiar la cuenta global actualiza Resumen, Movimientos y Por cuenta', async () => {
    await renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: /filtrar reportes por cuenta bancaria/i }));
    await user.click(await screen.findByRole('option', { name: /Banco B/i }));

    await user.click(screen.getByRole('tab', { name: /resumen/i }));
    const resumen = await screen.findByTestId('resumen-financiero');
    expect(resumen.getAttribute('data-cuenta-id')).toBe('cta-bbb');

    await user.click(screen.getByRole('tab', { name: /movimientos/i }));
    const movimientos = await screen.findByTestId('movimientos-table');
    expect(movimientos.getAttribute('data-cuenta-id')).toBe('cta-bbb');

    await user.click(screen.getByRole('tab', { name: /por cuenta/i }));
    const cuenta = await screen.findByTestId('account-transaction-history');
    expect(cuenta.getAttribute('data-cuenta-id')).toBe('cta-bbb');
  });

  it('Movimientos resincroniza sus filtros locales cuando los globales se actualizan', async () => {
    await renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /movimientos/i }));
    const movimientos = await screen.findByTestId('movimientos-table');
    expect(movimientos.getAttribute('data-cuenta-id')).toBe('');
    expect(movimientos.getAttribute('data-fecha-inicio')).toBe('');

    await user.click(screen.getByTestId('date-range-may'));
    await waitFor(() => {
      expect(screen.getByTestId('movimientos-table').getAttribute('data-fecha-inicio')).toBe(
        '2026-05-01',
      );
    });
    expect(screen.getByTestId('movimientos-table').getAttribute('data-fecha-fin')).toBe(
      '2026-05-31',
    );

    expect(screen.getByTestId('movimientos-table').getAttribute('data-cuenta-id')).toBe('');
  });

  it('Por cuenta recibe las fechas globales aunque tenga su propio selector de período', async () => {
    await renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: /filtrar reportes por cuenta bancaria/i }));
    await user.click(await screen.findByRole('option', { name: /Banco A/i }));
    await user.click(screen.getByRole('tab', { name: /por cuenta/i }));

    await user.click(screen.getByTestId('date-range-april'));

    const cuenta = await screen.findByTestId('account-transaction-history');
    expect(cuenta.getAttribute('data-fecha-inicio')).toBe('2026-04-01');
    expect(cuenta.getAttribute('data-fecha-fin')).toBe('2026-04-30');
  });

  it('limpiar filtros restablece las tres pestañas a estado inicial', async () => {
    await renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByTestId('date-range-april'));

    await user.click(screen.getByRole('combobox', { name: /filtrar reportes por cuenta bancaria/i }));
    await user.click(await screen.findByRole('option', { name: /Banco B/i }));

    await waitFor(() => {
      expect(screen.getByTestId('date-range-current').textContent).toBe(
        '2026-04-01___2026-04-30',
      );
    });

    await user.click(screen.getByRole('button', { name: /limpiar filtros/i }));

    await waitFor(() => {
      expect(screen.getByTestId('date-range-current').textContent).toBe('___');
    });

    await user.click(screen.getByRole('tab', { name: /resumen/i }));
    const resumen = await screen.findByTestId('resumen-financiero');
    expect(resumen.getAttribute('data-fecha-inicio')).toBe('');
    expect(resumen.getAttribute('data-fecha-fin')).toBe('');
    expect(resumen.getAttribute('data-cuenta-id')).toBe('');

    await user.click(screen.getByRole('tab', { name: /movimientos/i }));
    const movimientos = await screen.findByTestId('movimientos-table');
    expect(movimientos.getAttribute('data-fecha-inicio')).toBe('');
    expect(movimientos.getAttribute('data-fecha-fin')).toBe('');
    expect(movimientos.getAttribute('data-cuenta-id')).toBe('');
  });

  it('el botón Actualizar dispara una recarga real del resumen', async () => {
    await renderPage();
    const user = userEvent.setup();
    expect(screen.getByTestId('resumen-financiero')).toHaveAttribute('data-refresh-token', '0');
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(screen.getByTestId('resumen-financiero')).toHaveAttribute('data-refresh-token', '1'));
  });

  it('la exportación recibe los filtros globales y los locales activos', async () => {
    await renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByTestId('date-range-april'));

    await user.click(screen.getByRole('combobox', { name: /filtrar reportes por cuenta bancaria/i }));
    await user.click(await screen.findByRole('option', { name: /Banco A/i }));

    await user.click(screen.getByRole('tab', { name: /movimientos/i }));
    await screen.findByTestId('movimientos-table');
    await user.click(screen.getByTestId('trigger-local-busqueda'));
    await user.click(screen.getByTestId('trigger-local-tipo'));
    await user.click(screen.getByTestId('trigger-local-moneda'));

    const exportCsv = await screen.findByRole('button', { name: /^CSV$/ });
    await user.click(exportCsv);

    const lastCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const [url] = lastCall as [string, RequestInit];
    expect(url).toContain('/api/contabilidad/reportes/movimientos');
    expect(url).toContain('formato=csv');
    expect(url).toContain('fechaInicio=2026-04-01');
    expect(url).toContain('fechaFin=2026-04-30');
    expect(url).toContain('cuentaId=cta-aaa');
    expect(url).toContain('busqueda=servicio');
    expect(url).toContain('tipoMovimiento=venta');
    expect(url).toContain('moneda=USD');
  });
});
