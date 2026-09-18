import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getMovimientosReportAction: vi.fn(),
  getCuentasBancariasAction: vi.fn(),
  getPrestamoCashHistorialAction: vi.fn(),
  getDeudaCashByIdAction: vi.fn(),
  getMonedasAction: vi.fn(),
}));
const { getMovimientosReportAction, getCuentasBancariasAction, getPrestamoCashHistorialAction, getDeudaCashByIdAction, getMonedasAction } = mocks;

vi.mock('@/features/contabilidad/actions', () => ({ getMovimientosReportAction: mocks.getMovimientosReportAction }));
vi.mock('@/features/contabilidad/actions-cuentas-bancarias', () => ({ getCuentasBancariasAction: mocks.getCuentasBancariasAction }));
vi.mock('@/features/contabilidad/actions-prestamos-cash', () => ({ getPrestamoCashHistorialAction: mocks.getPrestamoCashHistorialAction }));
vi.mock('@/features/contabilidad/actions-deudas-cash', () => ({ getDeudaCashByIdAction: mocks.getDeudaCashByIdAction }));
vi.mock('@/features/contabilidad/actions-exchange', () => ({ getMonedasAction: mocks.getMonedasAction }));
vi.mock('@/components/ui/animations', () => ({
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/contabilidad/utils/contabilidadUtils', () => ({
  formatCurrencySimple: (value: number) => String(value),
  formatDate: (value: string) => value,
}));

import { MovimientosTable } from './movimientos-table';

describe('MovimientosTable — contrato de filtros Fase 0', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMovimientosReportAction.mockResolvedValue({
      success: true,
      data: { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } },
    });
    getCuentasBancariasAction.mockResolvedValue({ success: true, data: { cuentas: [] } });
    getPrestamoCashHistorialAction.mockResolvedValue({ success: true, data: null });
    getDeudaCashByIdAction.mockResolvedValue({ success: true, data: null });
    getMonedasAction.mockResolvedValue({ success: true, data: [] });
  });

  it('propaga los filtros locales reales al contenedor sin mezclar cuenta global', async () => {
    const onLocalFiltersChange = vi.fn();
    const user = userEvent.setup();
    render(<MovimientosTable onLocalFiltersChange={onLocalFiltersChange} />);

    await user.type(await screen.findByPlaceholderText('Buscar por descripción...'), 'servicio');

    await waitFor(() => {
      expect(onLocalFiltersChange).toHaveBeenCalledWith(expect.objectContaining({
        busqueda: 'servicio',
        tipoMovimiento: 'all',
        moneda: 'all',
        page: 1,
        limit: 10,
      }));
    });
    expect(onLocalFiltersChange.mock.calls.at(-1)?.[0]).not.toHaveProperty('cuentaId');
  });

  it('resincroniza fecha y cuenta global cuando cambian sus props', async () => {
    const { rerender } = render(
      <MovimientosTable cuentaId="cta-1" fechaInicio="2026-04-01" fechaFin="2026-04-30" />,
    );
    await waitFor(() => expect(getMovimientosReportAction).toHaveBeenCalledWith(expect.objectContaining({
      cuentaId: 'cta-1', fechaInicio: '2026-04-01', fechaFin: '2026-04-30', page: 1,
    })));

    rerender(<MovimientosTable cuentaId="cta-2" fechaInicio="" fechaFin="" />);

    await waitFor(() => expect(getMovimientosReportAction).toHaveBeenCalledWith(expect.objectContaining({
      cuentaId: 'cta-2', fechaInicio: undefined, fechaFin: undefined, page: 1,
    })));
  });

  it('restablece filtros locales y paginación al recibir una señal de reset', async () => {
    const onLocalFiltersChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <MovimientosTable onLocalFiltersChange={onLocalFiltersChange} resetKey={0} />,
    );
    await user.type(await screen.findByPlaceholderText('Buscar por descripción...'), 'gasto');
    onLocalFiltersChange.mockClear();

    rerender(<MovimientosTable onLocalFiltersChange={onLocalFiltersChange} resetKey={1} />);

    await waitFor(() => expect(onLocalFiltersChange).toHaveBeenCalledWith({
      busqueda: '', tipoMovimiento: 'all', moneda: 'all', page: 1, limit: 10,
    }));
    expect(screen.getByPlaceholderText('Buscar por descripción...')).toHaveValue('');
  });

  it('muestra el estado de error cuando falla la consulta', async () => {
    getMovimientosReportAction.mockResolvedValueOnce({
      success: false,
      error: { message: 'fallo de prueba' },
    });

    render(<MovimientosTable />);

    expect(await screen.findByText('Error al cargar los movimientos')).toBeInTheDocument();
  });

  it('muestra el estado vacío y permite avanzar de página', async () => {
    getMovimientosReportAction.mockResolvedValue({
      success: true,
      data: { data: [], pagination: { page: 1, limit: 10, total: 11, totalPages: 2 } },
    });
    const onLocalFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(<MovimientosTable onLocalFiltersChange={onLocalFiltersChange} onExport={vi.fn()} />);

    expect(await screen.findByText('No se encontraron movimientos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(getMovimientosReportAction).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
    })));
    expect(onLocalFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('renderiza una fila completa de movimientos', async () => {
    getMovimientosReportAction.mockResolvedValueOnce({
      success: true,
      data: {
        data: [{
          id: 'mov-1', fecha: '2026-04-15', cuenta: 'Banco principal', tipo: 'venta',
          descripcion: 'Venta de prueba', referencia: 'FAC-1', moneda: 'CUP', monto: 100,
          tasaCambio: 1, montoConvertido: 100,
        }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    render(<MovimientosTable />);
    expect(await screen.findByText('Venta de prueba')).toBeInTheDocument();
    expect(screen.getByText('Venta')).toBeInTheDocument();
  });

  it('declara nueve columnas en el estado vacío', async () => {
    render(<MovimientosTable />);
    const emptyCell = await screen.findByText('No se encontraron movimientos');
    expect(emptyCell.closest('td')).toHaveAttribute('colspan', '9');
  });

});

describe('MovimientosTable — Fase 2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMovimientosReportAction.mockResolvedValue({
      success: true,
      data: { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } },
    });
    getCuentasBancariasAction.mockResolvedValue({ success: true, data: { cuentas: [] } });
    getPrestamoCashHistorialAction.mockResolvedValue({ success: true, data: null });
    getDeudaCashByIdAction.mockResolvedValue({ success: true, data: null });
    getMonedasAction.mockResolvedValue({
      success: true,
      data: [
        { id: 'm1', codigo: 'CUP', nombre: 'Peso Cubano', singular: 'Peso' },
        { id: 'm2', codigo: 'USD', nombre: 'Dólar', singular: 'Dólar' },
        { id: 'm3', codigo: 'EUR', nombre: 'Euro', singular: 'Euro' },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cambia de página a 1 al modificar tipo de movimiento', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    getMovimientosReportAction.mockResolvedValue({
      success: true,
      data: { data: [{ id: 'm1', fecha: '2026-01-01', cuenta: 'Banco', tipo: 'venta', descripcion: 'Test', referencia: '', moneda: 'CUP', monto: 100, tasaCambio: 1, montoConvertido: 100 }],
        pagination: { page: 1, limit: 10, total: 11, totalPages: 2 } },
    });
    render(<MovimientosTable />);

    await screen.findByText('Test');
    const page2Btn = screen.getByRole('button', { name: 'Siguiente' });
    await user.click(page2Btn);
    await waitFor(() => {
      expect(getMovimientosReportAction).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });

    const selects = screen.getAllByRole('combobox');
    await user.click(selects[0]);
    await user.click(screen.getByText('Ventas'));

    await waitFor(() => {
      const calls = getMovimientosReportAction.mock.calls.map(c => c[0].page);
      expect(calls).toContain(1);
    });
  });

  it('cambia de página a 1 al modificar moneda', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    getMovimientosReportAction.mockResolvedValue({
      success: true,
      data: { data: [{ id: 'm1', fecha: '2026-01-01', cuenta: 'Banco', tipo: 'venta', descripcion: 'Test', referencia: '', moneda: 'CUP', monto: 100, tasaCambio: 1, montoConvertido: 100 }],
        pagination: { page: 1, limit: 10, total: 11, totalPages: 2 } },
    });
    render(<MovimientosTable />);

    await screen.findByText('Test');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => {
      expect(getMovimientosReportAction).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });

    const selects = screen.getAllByRole('combobox');
    await user.click(selects[1]);
    await user.click(screen.getByText('USD'));

    await waitFor(() => {
      const lastCall = getMovimientosReportAction.mock.calls.at(-1)?.[0];
      expect(lastCall.page).toBe(1);
    });
  });

  it('usa debounce en búsqueda: no consulta por cada pulsación', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MovimientosTable />);

    const input = await screen.findByPlaceholderText('Buscar por descripción...');
    await user.type(input, 'abc');

    const callsAfterType = getMovimientosReportAction.mock.calls.length;
    expect(callsAfterType).toBe(1);

    act(() => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(getMovimientosReportAction.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('carga monedas del catálogo y las muestra en el select al abrirlo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MovimientosTable />);

    await waitFor(() => expect(getMonedasAction).toHaveBeenCalledTimes(1));

    const selects = screen.getAllByRole('combobox');
    const monedaSelect = selects[1];
    await user.click(monedaSelect);

    await waitFor(() => {
      expect(screen.getByText('CUP')).toBeInTheDocument();
      expect(screen.getByText('USD')).toBeInTheDocument();
      expect(screen.getByText('EUR')).toBeInTheDocument();
    });
  });

  it('no muestra monedas hardcodeadas cuando el catálogo tiene otras', async () => {
    getMonedasAction.mockResolvedValue({
      success: true,
      data: [
        { id: 'm1', codigo: 'CUP', nombre: 'Peso Cubano', singular: 'Peso' },
      ],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MovimientosTable />);

    await waitFor(() => expect(getMonedasAction).toHaveBeenCalled());

    const selects = screen.getAllByRole('combobox');
    await user.click(selects[1]);

    await waitFor(() => {
      expect(screen.getByText('CUP')).toBeInTheDocument();
      expect(screen.queryByText('USD')).not.toBeInTheDocument();
      expect(screen.queryByText('EUR')).not.toBeInTheDocument();
    });
  });

  it('omite monedas inactivas del catálogo de filtros', async () => {
    getMonedasAction.mockResolvedValue({
      success: true,
      data: [
        { id: 'm1', codigo: 'CUP', nombre: 'Peso Cubano', isActive: true },
        { id: 'm2', codigo: 'USD', nombre: 'Dólar', isActive: false },
      ],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MovimientosTable />);

    await waitFor(() => expect(getMonedasAction).toHaveBeenCalled());
    await user.click(screen.getAllByRole('combobox')[1]);

    expect(screen.getByText('CUP')).toBeInTheDocument();
    expect(screen.queryByText('USD')).not.toBeInTheDocument();
  });

  it('exporta con los filtros visibles actuales (cuenta, fechas, búsqueda, tipo, moneda)', async () => {
    const onExport = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <MovimientosTable
        cuentaId="cta-1"
        fechaInicio="2026-01-01"
        fechaFin="2026-12-31"
        onExport={onExport}
      />,
    );

    await screen.findByPlaceholderText('Buscar por descripción...');
    await user.type(screen.getByPlaceholderText('Buscar por descripción...'), 'servicio');

    const selects = screen.getAllByRole('combobox');
    await user.click(selects[0]);
    await user.click(screen.getByText('Servicios'));

    await user.click(screen.getByRole('button', { name: 'CSV' }));

    expect(onExport).toHaveBeenCalledWith('csv');
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('CSV y PDF invocan la misma función onExport con diferente tipo', async () => {
    const onExport = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MovimientosTable onExport={onExport} />);

    await screen.findByPlaceholderText('Buscar por descripción...');
    await user.click(screen.getByRole('button', { name: 'CSV' }));
    await user.click(screen.getByRole('button', { name: 'PDF' }));

    expect(onExport).toHaveBeenCalledTimes(2);
    expect(onExport).toHaveBeenNthCalledWith(1, 'csv');
    expect(onExport).toHaveBeenNthCalledWith(2, 'pdf');
  });

  it('skeleton de loading declara nueve columnas', async () => {
    getMovimientosReportAction.mockReturnValue(new Promise(() => {}));
    render(<MovimientosTable />);

    await waitFor(() => {
      const rows = document.querySelectorAll('table tbody tr');
      expect(rows.length).toBeGreaterThan(0);
    });

    const firstRow = document.querySelector('table tbody tr');
    expect(firstRow?.querySelectorAll('td').length).toBe(9);
  });

  it('tabla tiene role="table" y encabezados accesibles', async () => {
    render(<MovimientosTable />);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBe(9);
    expect(headers.map(h => h.textContent)).toEqual([
      'Fecha', 'Cuenta', 'Tipo', 'Descripción', 'Referencia',
      'Moneda', 'Monto Original', 'Tasa', 'Monto Convertido',
    ]);
  });

  it('estado vacío declara colspan 9 en la celda', async () => {
    render(<MovimientosTable />);
    const cell = await screen.findByText('No se encontraron movimientos');
    expect(cell.closest('td')).toHaveAttribute('colspan', '9');
  });

  it('la tabla tiene overflow-x-auto para móvil', async () => {
    render(<MovimientosTable />);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const scrollContainer = document.querySelector('.overflow-x-auto');
    expect(scrollContainer).toBeInTheDocument();
  });

  it('mantiene una sola exportación mientras la anterior está pendiente', async () => {
    let resolveExport!: () => void;
    const onExport = vi.fn(() => new Promise<void>((resolve) => {
      resolveExport = resolve;
    }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MovimientosTable onExport={onExport} />);

    await screen.findByText('No se encontraron movimientos');
    const csv = screen.getByRole('button', { name: 'CSV' });
    await user.click(csv);
    await waitFor(() => expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled());
    await user.click(screen.getByRole('button', { name: 'CSV' }));

    expect(onExport).toHaveBeenCalledTimes(1);
    resolveExport();
    await waitFor(() => expect(screen.getByRole('button', { name: 'CSV' })).not.toBeDisabled());
  });

  it('descarta una respuesta antigua cuando cambia el filtro', async () => {
    let resolveInitial!: (value: unknown) => void;
    let resolveLatest!: (value: unknown) => void;
    getMovimientosReportAction
      .mockImplementationOnce(() => new Promise((resolve) => { resolveInitial = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLatest = resolve; }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MovimientosTable />);

    const input = await screen.findByPlaceholderText('Buscar por descripción...');
    await user.type(input, 'nuevo');
    act(() => {
      vi.advanceTimersByTime(350);
    });
    await waitFor(() => expect(getMovimientosReportAction).toHaveBeenCalledTimes(2));

    resolveLatest({
      success: true,
      data: {
        data: [{ id: 'latest', fecha: '2026-01-02', cuenta: 'Banco', tipo: 'venta', descripcion: 'Resultado actual', referencia: '', moneda: 'CUP', monto: 2, montoConvertido: 2 }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    expect(await screen.findByText('Resultado actual')).toBeInTheDocument();

    resolveInitial({
      success: true,
      data: {
        data: [{ id: 'stale', fecha: '2026-01-01', cuenta: 'Banco', tipo: 'venta', descripcion: 'Resultado antiguo', referencia: '', moneda: 'CUP', monto: 1, montoConvertido: 1 }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('Resultado antiguo')).not.toBeInTheDocument();
    expect(screen.getByText('Resultado actual')).toBeInTheDocument();
  });

  it('expone nombres accesibles en búsqueda, tipo y moneda', async () => {
    render(<MovimientosTable />);
    expect(await screen.findByRole('textbox', { name: 'Buscar movimientos' })).toBeInTheDocument();
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes[0]).toHaveAccessibleName('Filtrar por tipo de movimiento');
    expect(comboboxes[1]).toHaveAccessibleName('Filtrar por moneda');
  });

  it('muestra 0 a 0 cuando el resultado paginado está vacío', async () => {
    render(<MovimientosTable />);
    expect(await screen.findByText(/Mostrando 0 a 0 de 0 movimientos/)).toBeInTheDocument();
  });

});
