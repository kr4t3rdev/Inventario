import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/reportes-financieros/actions-rotacion', () => ({ getRotacionInventarioAction: vi.fn() }));
vi.mock('@/lib/export-utils', () => ({ exportToCsv: vi.fn() }));

import { getRotacionInventarioAction } from '@/features/reportes-financieros/actions-rotacion';
import { exportToCsv } from '@/lib/export-utils';
import { ReporteRotacion } from '../reporte-rotacion';

const rotacion = {
  periodo: { inicio: '2026-10-01T00:00:00.000Z', fin: '2026-11-01T00:00:00.000Z' },
  definicion: 'Salidas / existencias promedio',
  porProducto: [{ productoId: 'p1', productoNombre: 'Aceite', unidadesSalidas: 12, existenciasPromedio: 6, rotacion: 2, sinExistencias: false }],
};

describe('ReporteRotacion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta el periodo visible y exporta los valores del servidor', async () => {
    vi.mocked(getRotacionInventarioAction).mockResolvedValue({ success: true, data: rotacion } as never);
    render(<ReporteRotacion />);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByText('Aceite')).toBeInTheDocument();
    expect(screen.getByText('2×')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /csv/i }));
    expect(exportToCsv).toHaveBeenCalledWith([
      expect.objectContaining({ Producto: 'Aceite', 'Unidades salidas': 12, Rotación: 2 }),
    ], expect.stringContaining('Rotacion_Inventario'));
    expect(getRotacionInventarioAction).toHaveBeenCalledWith(expect.objectContaining({
      fechaDesde: expect.any(Date), fechaHasta: expect.any(Date),
    }));
  });

  it('presenta estado vacío cuando no hay filas', async () => {
    vi.mocked(getRotacionInventarioAction).mockResolvedValue({ success: true, data: { ...rotacion, porProducto: [] } } as never);
    render(<ReporteRotacion />);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText(/no hay productos con rotación/i)).toBeInTheDocument();
  });

  it('presenta el error de la consulta', async () => {
    vi.mocked(getRotacionInventarioAction).mockResolvedValue({ success: false, error: { message: 'Error de reporte' } });
    render(<ReporteRotacion />);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('Error de reporte')).toBeInTheDocument();
  });
});
