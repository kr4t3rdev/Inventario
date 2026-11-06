import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/reportes-financieros/actions-forecast', () => ({ getForecastQuiebreAction: vi.fn() }));
vi.mock('@/lib/export-utils', () => ({ exportToCsv: vi.fn() }));

import { getForecastQuiebreAction } from '@/features/reportes-financieros/actions-forecast';
import { exportToCsv } from '@/lib/export-utils';
import { ReporteForecast } from '../reporte-forecast';

const forecast = {
  fechaCorte: '2026-10-31T00:00:00.000Z',
  ventana: { dias: 90, inicio: '2026-08-03T00:00:00.000Z', fin: '2026-11-01T00:00:00.000Z', minDias: 7, maxDias: 180 },
  supuestos: 'Tasa diaria = salidas de ventas / días de ventana; disponibilidad neta de reservas.',
  porProducto: [
    { productoId: 'p1', productoNombre: 'Aceite', disponibilidad: 20, consumoTotal: 30, diasActivos: 8, tasaDiaria: 1, diasHastaQuiebre: 20, fechaQuiebre: '2026-11-20T00:00:00.000Z', estado: 'estimado' },
    { productoId: 'p2', productoNombre: 'Arroz', disponibilidad: 8, consumoTotal: 5, diasActivos: 1, tasaDiaria: 0.16, diasHastaQuiebre: null, fechaQuiebre: null, estado: 'datos_insuficientes' },
  ],
};

describe('ReporteForecast', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta con los filtros y exporta la misma ventana y resultados', async () => {
    vi.mocked(getForecastQuiebreAction).mockResolvedValue({ success: true, data: forecast } as never);
    render(<ReporteForecast />);
    await userEvent.clear(screen.getByLabelText('Ventana (días)'));
    await userEvent.type(screen.getByLabelText('Ventana (días)'), '45');
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByText('Aceite')).toBeInTheDocument();
    expect(screen.getByText('20 días')).toBeInTheDocument();
    expect(screen.getByText('Datos insuficientes')).toBeInTheDocument();
    expect(screen.getByText(/disponibilidad neta de reservas/i)).toBeInTheDocument();
    expect(getForecastQuiebreAction).toHaveBeenCalledWith({ fechaCorte: expect.any(Date), ventanaDias: 45 });
    await userEvent.click(screen.getByRole('button', { name: /csv/i }));
    expect(exportToCsv).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ Producto: 'Aceite', 'Días hasta quiebre': 20 }),
      expect.objectContaining({ Producto: 'Arroz', 'Días hasta quiebre': 'Sin estimación confiable' }),
    ]), expect.stringContaining('Forecast_Quiebre'));
  });

  it('explica demanda cero cuando la respuesta no contiene productos', async () => {
    vi.mocked(getForecastQuiebreAction).mockResolvedValue({ success: true, data: { ...forecast, porProducto: [] } } as never);
    render(<ReporteForecast />);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText(/no hay productos para estimar/i)).toBeInTheDocument();
  });

  it('presenta el error devuelto por la acción', async () => {
    vi.mocked(getForecastQuiebreAction).mockResolvedValue({ success: false, error: { message: 'Error del forecast' } });
    render(<ReporteForecast />);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('Error del forecast')).toBeInTheDocument();
  });
});
