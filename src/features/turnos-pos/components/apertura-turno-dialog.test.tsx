/**
 * @description Pruebas del diálogo de apertura de turno: el selector de cajeros
 * debe distinguir una empresa sin empleados de un fallo de consulta (permiso o
 * plan) en lugar de dejarlo vacío y ambiguo (caso CT-1).
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getEmpleadosMock = vi.hoisted(() => vi.fn());
const abrirTurnoMock = vi.hoisted(() => vi.fn());
vi.mock('@/features/empleados/actions', () => ({
  getEmpleadosAction: getEmpleadosMock,
}));
vi.mock('@/features/turnos-pos/actions', () => ({
  abrirTurnoAction: abrirTurnoMock,
}));

import { AperturaTurnoDialog } from './apertura-turno-dialog';

describe('AperturaTurnoDialog — selector de cajeros', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('indica que la empresa no tiene empleados registrados', async () => {
    getEmpleadosMock.mockResolvedValue({ success: true, data: [] });
    render(
      <AperturaTurnoDialog
        open
        onOpenChange={vi.fn()}
        puntoDeVentaId="pv-1"
        puntoDeVentaNombre="PV 1"
      />,
    );

    expect(await screen.findByText(
      'No hay empleados registrados en esta empresa.',
    )).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra el error de la consulta en lugar de un selector vacío ambiguo', async () => {
    getEmpleadosMock.mockResolvedValue({
      success: false,
      error: { message: 'No tienes acceso al módulo de empleados' },
    });
    render(
      <AperturaTurnoDialog
        open
        onOpenChange={vi.fn()}
        puntoDeVentaId="pv-1"
        puntoDeVentaNombre="PV 1"
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tienes acceso al módulo de empleados',
    );
    expect(screen.queryByText(
      'No hay empleados registrados en esta empresa.',
    )).not.toBeInTheDocument();
  });
});
