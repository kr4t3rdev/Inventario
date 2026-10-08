/**
 * @description Tests de accesibilidad y copy del reporte de comisiones
 * (tarea 6.3/6.4 del change remediacion-integridad-ventas-credito-fiscal):
 * sello «Cálculo actualizado», imputación de devoluciones al mes de la venta
 * original, región de estado aria-live, ausencia de semántica de liquidación
 * y proxy responsive para 320 px.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

expect.extend(matchers);

declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
}

const actionMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/empleados/actions-comisiones', () => ({
  getComisionesDelMesAction: actionMock,
}));

import { ComisionesMesClient } from '@/features/empleados/components/comisiones-mes';

const fila = {
  empleadoId: 'e-1',
  nombre: 'Ana Vendedora',
  comisionPct: 10,
  ventasElegibles: 4000,
  baseBruta: 5000,
  devolucionesElegibles: 1000,
  baseNeta: 4000,
  comisionCalculada: 400,
  meta: { metaMensual: 8000, progreso: 50, cumplida: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  actionMock.mockResolvedValue({ success: true, data: [fila] });
});

describe('ComisionesMesClient (6.3: sello, copy y a11y)', () => {
  it('muestra el sello «Cálculo actualizado» al cargar el reporte', async () => {
    render(<ComisionesMesClient />);

    const sello = await screen.findByText('Cálculo actualizado');
    expect(sello).toBeVisible();
  });

  it('explica la imputación: las devoluciones van al mes de su venta original', async () => {
    render(<ComisionesMesClient />);

    await screen.findByText('Ana Vendedora');
    expect(
      screen.getByText(/se imputan al mes de su venta original/i),
    ).toBeVisible();
  });

  it('expone el estado en una región aria-live (role=status)', async () => {
    render(<ComisionesMesClient />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeVisible();
    });
  });

  it('no usa semántica de liquidación en el reporte', async () => {
    render(<ComisionesMesClient />);

    await screen.findByText('Ana Vendedora');
    expect(screen.queryByText(/liquidad/i)).toBeNull();
    expect(screen.queryByText(/liquidaci/i)).toBeNull();
  });

  it('el selector de período envuelve (proxy responsive 320 px)', async () => {
    const { container } = render(<ComisionesMesClient />);

    await screen.findByText('Ana Vendedora');
    const filaSelectores = container.querySelector('.flex-wrap');
    expect(filaSelectores).not.toBeNull();
  });

  it('no tiene violaciones de accesibilidad con datos cargados', async () => {
    const { container } = render(<ComisionesMesClient />);

    await screen.findByText('Ana Vendedora');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('no tiene violaciones de accesibilidad en estado de carga', async () => {
    actionMock.mockReturnValue(new Promise(() => undefined));
    const { container } = render(<ComisionesMesClient />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
