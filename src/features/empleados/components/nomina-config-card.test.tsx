import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@/features/empleados/actions-nomina-config', () => ({
  getNominaConfigAction: actions.get,
  upsertNominaConfigAction: actions.save,
}));

import { NominaConfigCard } from './nomina-config-card';

describe('NominaConfigCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.get.mockResolvedValue({
      success: true,
      data: { config: null, defaults: { tarifaHoraExtra: 1.5, horasMensualesEstandar: 192, monedaPago: 'CUP' } },
    });
    actions.save.mockResolvedValue({ success: true, data: {} });
  });

  it('oculta la configuración a usuarios sin permiso', () => {
    const { container } = render(<NominaConfigCard canConfigure={false} />);
    expect(container.firstChild).toBeNull();
    expect(actions.get).not.toHaveBeenCalled();
  });

  it('carga los valores predeterminados y guarda los cambios autorizados', async () => {
    render(<NominaConfigCard canConfigure />);
    const multiplier = screen.getByLabelText('Multiplicador de hora extra') as HTMLInputElement;
    await waitFor(() => expect(multiplier.disabled).toBe(false));
    fireEvent.change(multiplier, { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Horas estándar mensuales'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    await waitFor(() => expect(actions.save).toHaveBeenCalledWith({
      tarifaHoraExtra: 2,
      horasMensualesEstandar: 200,
      monedaPago: 'CUP',
    }));
  });
});
