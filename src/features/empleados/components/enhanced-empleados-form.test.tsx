/**
 * @description Tests de la fuente de verdad de la moneda principal en el
 * formulario de empleados: la politica contable del tenant (no el catalogo
 * `esPrincipal`) determina la moneda del salario por defecto, la comparacion
 * de conversion de tasa y la etiqueta mostrada en el selector.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getMonedaPrincipalAction: vi.fn(),
  createEmpleadoAction: vi.fn(),
  updateEmpleadoAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/features/contabilidad/actions-accounting-policy', () => ({
  getMonedaPrincipalAction: mocks.getMonedaPrincipalAction,
}));

vi.mock('@/features/contabilidad/hooks/use-monedas', () => ({
  useMonedas: () => ({
    monedas: [
      { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true, isActive: true },
      {
        codigo: 'USD',
        nombre: 'Dolar Estadounidense',
        simbolo: 'US$',
        esPrincipal: false,
        isActive: true,
      },
      { codigo: 'EUR', nombre: 'Euro', simbolo: 'EUR', esPrincipal: false, isActive: true },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/features/empleados/actions', () => ({
  createEmpleadoAction: mocks.createEmpleadoAction,
  updateEmpleadoAction: mocks.updateEmpleadoAction,
}));

import { EnhancedEmpleadoForm } from './enhanced-empleados-form';

const TRIGGER_MONEDA = /Moneda del Salario/;

const politicaConfigurada = (moneda: string) => ({
  success: true,
  data: { estado: 'CONFIGURADA', moneda },
});

const politicaAusente = {
  success: true,
  data: { estado: 'AUSENTE', moneda: null },
};

describe('EnhancedEmpleadoForm - moneda principal desde la politica contable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMonedaPrincipalAction.mockResolvedValue(politicaConfigurada('USD'));
    mocks.createEmpleadoAction.mockResolvedValue({ success: true, data: {} });
    mocks.updateEmpleadoAction.mockResolvedValue({ success: true, data: {} });
  });

  it('no muestra el formulario mientras la politica contable esta pendiente', async () => {
    let resolverPolitica: (valor: unknown) => void = () => undefined;
    mocks.getMonedaPrincipalAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverPolitica = resolve;
        }),
    );

    render(<EnhancedEmpleadoForm />);

    expect(screen.queryByRole('combobox', { name: TRIGGER_MONEDA })).toBeNull();

    resolverPolitica(politicaConfigurada('USD'));

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: TRIGGER_MONEDA })).toBeInTheDocument(),
    );
  });

  it('consulta la politica contable del tenant para resolver la moneda principal', async () => {
    render(<EnhancedEmpleadoForm />);

    await waitFor(() => expect(mocks.getMonedaPrincipalAction).toHaveBeenCalledTimes(1));
  });

  it('usa la moneda de la politica contable como valor por defecto', async () => {
    const user = userEvent.setup();
    render(<EnhancedEmpleadoForm />);

    const trigger = await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await user.click(trigger);

    expect(screen.getByRole('option', { name: /USD/ })).toHaveAttribute('data-state', 'checked');
    expect(screen.getByRole('option', { name: /CUP/ })).toHaveAttribute('data-state', 'unchecked');
  });

  it('etiqueta la moneda del catalogo como base de tasas, no como principal', async () => {
    const user = userEvent.setup();
    render(<EnhancedEmpleadoForm />);

    const trigger = await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await user.click(trigger);

    expect(screen.getByText('Base de tasas')).toBeInTheDocument();
    expect(screen.queryByText('Principal')).toBeNull();
  });

  it('no exige confirmacion de tasa cuando la moneda es la de la politica', async () => {
    const user = userEvent.setup();
    render(<EnhancedEmpleadoForm />);

    const trigger = await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: /USD/ }));

    expect(screen.queryByText(/Se solicitará confirmación de tasa de cambio/)).toBeNull();
  });

  it('no sustituye por CUP cuando la politica contable esta ausente', async () => {
    mocks.getMonedaPrincipalAction.mockResolvedValue(politicaAusente);

    const user = userEvent.setup();
    render(<EnhancedEmpleadoForm />);

    const trigger = await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await user.click(trigger);

    const opciones = screen.getAllByRole('option');
    expect(opciones.some((opcion) => opcion.getAttribute('data-state') === 'checked')).toBe(false);

    await user.keyboard('{Escape}');
    expect(trigger).toHaveTextContent('Seleccione la moneda');
  });
});
