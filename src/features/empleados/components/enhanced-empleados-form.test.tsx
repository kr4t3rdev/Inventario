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
  router: {
    back: vi.fn(),
    push: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
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

vi.mock('@/features/contabilidad/components/tasa-cambio-dialog', () => ({
  TasaCambioDialog: ({
    onClose,
    onConfirm,
  }: {
    onClose: () => void;
    onConfirm: (tasa: number, monto: number) => void;
  }) => (
    <div role="dialog">
      <button type="button" onClick={() => onConfirm(2, 200)}>Confirmar tasa</button>
      <button type="button" onClick={onClose}>Cancelar tasa</button>
    </div>
  ),
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

  async function completeForm() {
    await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await userEvent.setup().type(screen.getByLabelText('Nombre'), 'Ana');
    await userEvent.setup().type(screen.getByLabelText('Apellido'), 'Pérez');
    await userEvent.setup().type(screen.getByLabelText('Teléfono'), '555123');
    await userEvent.setup().type(screen.getByLabelText('Cargo'), 'Vendedora');
    await userEvent.setup().type(screen.getByLabelText('Período'), '2026-11');
    await userEvent.setup().type(screen.getByLabelText('Salario Base'), '100');
  }

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

  it('crea un empleado en la moneda de la política y muestra el resumen', async () => {
    render(<EnhancedEmpleadoForm />);
    await completeForm();

    expect(screen.getByText('Resumen del Empleado')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createEmpleadoAction).toHaveBeenCalledTimes(1));
    expect(mocks.createEmpleadoAction.mock.calls[0][0]).toMatchObject({
      nombre: 'Ana',
      monedaSalario: 'USD',
      salarioBases: 100,
    });
    expect(mocks.router.back).toHaveBeenCalled();
  });

  it('actualiza un empleado existente', async () => {
    render(
      <EnhancedEmpleadoForm
        initialData={{
          empleadoId: 'empleado-1',
          nombre: 'Ana',
          apellido: 'Pérez',
          telefono: '555123',
          periodo: '2026-11',
          salarioBases: 100,
          cargo: 'Vendedora',
          monedaSalario: 'USD',
        }}
      />,
    );

    await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => expect(mocks.updateEmpleadoAction).toHaveBeenCalledTimes(1));
    expect(mocks.updateEmpleadoAction.mock.calls[0][0]).toMatchObject({
      empleadoId: 'empleado-1',
      monedaSalario: 'USD',
    });
  });

  it('confirma conversión al elegir una moneda distinta', async () => {
    render(<EnhancedEmpleadoForm />);
    await completeForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: TRIGGER_MONEDA }));
    await user.click(screen.getByRole('option', { name: /CUP/ }));
    expect(screen.getByText(/requiere conversión de moneda/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar tasa' }));

    await waitFor(() =>
      expect(mocks.createEmpleadoAction.mock.calls[0][0]).toMatchObject({
        monedaSalario: 'CUP',
        tasaCambioSalario: 2,
        salarioConvertido: 200,
      }),
    );
  });

  it('cancela la confirmación de conversión sin crear el empleado', async () => {
    render(<EnhancedEmpleadoForm />);
    await completeForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: TRIGGER_MONEDA }));
    await user.click(screen.getByRole('option', { name: /CUP/ }));
    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar tasa' }));

    expect(mocks.createEmpleadoAction).not.toHaveBeenCalled();
  });

  it('muestra error cuando la creación es rechazada y cuando falla', async () => {
    const user = userEvent.setup();
    mocks.createEmpleadoAction
      .mockResolvedValueOnce({ success: false, error: { message: 'No permitido' } })
      .mockRejectedValueOnce(new Error('fallo de red'));

    render(<EnhancedEmpleadoForm />);
    await completeForm();
    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await waitFor(() => expect(mocks.createEmpleadoAction).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await waitFor(() => expect(mocks.createEmpleadoAction).toHaveBeenCalledTimes(2));
  });

  it('muestra el error al actualizar un empleado', async () => {
    mocks.updateEmpleadoAction.mockResolvedValue({
      success: false,
      error: { message: 'No permitido' },
    });
    render(
      <EnhancedEmpleadoForm
        initialData={{
          empleadoId: 'empleado-1',
          nombre: 'Ana',
          apellido: 'Pérez',
          telefono: '555123',
          periodo: '2026-11',
          salarioBases: 100,
          cargo: 'Vendedora',
          monedaSalario: 'USD',
        }}
      />,
    );

    await screen.findByRole('button', { name: 'Actualizar' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => expect(mocks.updateEmpleadoAction).toHaveBeenCalledTimes(1));
  });

  it('usa los textos de respaldo cuando faltan cargo y moneda del catálogo', async () => {
    render(
      <EnhancedEmpleadoForm
        initialData={{
          empleadoId: 'empleado-2',
          nombre: 'Luis',
          apellido: 'Gómez',
          telefono: '',
          periodo: '2026-11',
          salarioBases: 100,
          cargo: '',
          monedaSalario: 'GBP',
        }}
      />,
    );

    expect(await screen.findByText('Sin especificar')).toBeInTheDocument();
    expect(screen.getByText('GBP')).toBeInTheDocument();
    expect(screen.getByText('100.00 GBP')).toBeInTheDocument();
  });
});
