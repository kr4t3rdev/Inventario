import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/reportes-financieros/actions-valorizado', () => ({
  getValorizadoAFechaAction: vi.fn(),
}));
vi.mock('@/lib/export-utils', () => ({ exportToCsv: vi.fn() }));

import { ReporteValorizado } from '../reporte-valorizado';
import { getValorizadoAFechaAction } from '@/features/reportes-financieros/actions-valorizado';
import { exportToCsv } from '@/lib/export-utils';

const datos = {
  porProducto: [{
    productoId: 'p1', productoNombre: 'Aceite de oliva', unidadesFifo: 2, unidadesEstimadas: 1,
    costoUnitarioFifo: 10, valorFifo: 30, tieneEstimado: true, escalado: false,
  }],
  valorTotalFifo: 30, valorTotalEstimado: 10, tieneEstimado: true,
};

describe('ReporteValorizado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra fecha de corte, cantidades y total, y exporta las filas visibles', async () => {
    vi.mocked(getValorizadoAFechaAction).mockResolvedValue({ success: true, data: datos });
    render(<ReporteValorizado />);

    expect(await screen.findByText('Aceite de oliva')).toBeInTheDocument();
    const fechaCorte = screen.getByLabelText('Fecha de corte') as HTMLInputElement;
    expect(fechaCorte.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByText('3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /csv/i }));

    expect(exportToCsv).toHaveBeenCalledTimes(1);
    expect(vi.mocked(exportToCsv).mock.calls[0][0]).toEqual([{
      'Fecha de corte': expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      Producto: 'Aceite de oliva', Cantidad: 3, 'Costo unitario': 10, 'Total valorizado': 30,
    }]);
  });

  it('muestra estado vacío cuando no hay existencias al corte', async () => {
    vi.mocked(getValorizadoAFechaAction).mockResolvedValue({ success: true, data: { ...datos, porProducto: [] } });
    render(<ReporteValorizado />);

    expect(await screen.findByText(/no hay existencias valorizadas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /csv/i })).toBeDisabled();
  });

  it('muestra estado de error cuando la consulta falla', async () => {
    vi.mocked(getValorizadoAFechaAction).mockResolvedValue({ success: false, error: { message: 'Sin permisos' } });
    render(<ReporteValorizado />);

    expect(await screen.findByText('Sin permisos')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
