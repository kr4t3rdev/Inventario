/**
 * @description Tests de la fuente de verdad de la moneda principal en el
 * formulario de venta: la politica contable del tenant (no el catalogo
 * `esPrincipal`) determina la moneda por defecto, la comparacion de
 * conversion de tasa y la etiqueta mostrada en el selector.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getMonedaPrincipalAction: vi.fn(),
  getProductosAction: vi.fn(),
  usePuntosDeVenta: vi.fn(),
  createVentaAction: vi.fn(),
  updateVentaAction: vi.fn(),
  router: {
    push: vi.fn(),
    refresh: vi.fn(),
  },
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('@/lib/sileo-shim', () => ({
  sileo: mocks.sileo,
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

vi.mock('@/features/productos/actions', () => ({
  getProductosAction: mocks.getProductosAction,
}));

vi.mock('@/features/puntos-venta/hooks/use-puntos-de-venta', () => ({
  usePuntosDeVenta: mocks.usePuntosDeVenta,
}));

vi.mock('@/features/ventas/actions', () => ({
  createVentaAction: mocks.createVentaAction,
  updateVentaAction: mocks.updateVentaAction,
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

import { EnhancedVentaForm } from './enhanced-venta-form';

const TRIGGER_MONEDA = /Moneda de la Venta/;

const politicaConfigurada = (moneda: string) => ({
  success: true,
  data: { estado: 'CONFIGURADA', moneda },
});

const politicaAusente = {
  success: true,
  data: { estado: 'AUSENTE', moneda: null },
};

describe('EnhancedVentaForm - moneda principal desde la politica contable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMonedaPrincipalAction.mockResolvedValue(politicaConfigurada('USD'));
    mocks.getProductosAction.mockResolvedValue({
      success: true,
      data: [{ id: 'p1', nombre: 'Harina', stock: 10, precioVenta: 100, unidad: { simbolo: 'kg' } }],
    });
    mocks.usePuntosDeVenta.mockReturnValue({
      puntosDeVenta: [{ pvId: 'pv1', nombre: 'Sucursal 1' }],
      isLoading: false,
    });
    mocks.createVentaAction.mockResolvedValue({ success: true, data: {} });
    mocks.updateVentaAction.mockResolvedValue({ success: true, data: {} });
  });

  async function completeForm() {
    const user = userEvent.setup();
    await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await user.click(screen.getByRole('combobox', { name: 'Producto' }));
    await user.click(screen.getByRole('option', { name: /Harina/ }));
    await user.click(screen.getByRole('combobox', { name: 'Punto de Venta' }));
    await user.click(screen.getByRole('option', { name: /Sucursal 1/ }));
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '2');
    return user;
  }

  it('carga el catalogo de productos y deja de mostrar el skeleton', async () => {
    render(<EnhancedVentaForm />);

    await waitFor(() => expect(mocks.getProductosAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('combobox', { name: TRIGGER_MONEDA })).toBeInTheDocument();
  });

  it('consulta la politica contable del tenant para resolver la moneda principal', async () => {
    render(<EnhancedVentaForm />);

    await waitFor(() => expect(mocks.getMonedaPrincipalAction).toHaveBeenCalledTimes(1));
  });

  it('no muestra el formulario mientras la politica contable esta pendiente', async () => {
    let resolverPolitica: (valor: unknown) => void = () => undefined;
    mocks.getMonedaPrincipalAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverPolitica = resolve;
        }),
    );

    render(<EnhancedVentaForm />);

    await waitFor(() => expect(mocks.getMonedaPrincipalAction).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('combobox', { name: TRIGGER_MONEDA })).toBeNull();

    resolverPolitica(politicaConfigurada('USD'));

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: TRIGGER_MONEDA })).toBeInTheDocument(),
    );
  });

  it('usa la moneda de la politica contable como valor por defecto', async () => {
    const user = userEvent.setup();
    render(<EnhancedVentaForm />);

    const trigger = await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await user.click(trigger);

    expect(screen.getByRole('option', { name: /USD/ })).toHaveAttribute('data-state', 'checked');
    expect(screen.getByRole('option', { name: /CUP/ })).toHaveAttribute('data-state', 'unchecked');
  });

  it('etiqueta la moneda del catalogo como base de tasas, no como principal', async () => {
    const user = userEvent.setup();
    render(<EnhancedVentaForm />);

    const trigger = await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await user.click(trigger);

    expect(screen.getByText('Base de tasas')).toBeInTheDocument();
    expect(screen.queryByText('Principal')).toBeNull();
  });

  it('no exige confirmacion de tasa cuando la moneda es la de la politica', async () => {
    const user = userEvent.setup();
    render(<EnhancedVentaForm />);

    const trigger = await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: /USD/ }));

    expect(screen.queryByText(/Se solicitará confirmación de tasa de cambio/)).toBeNull();
  });

  it('no sustituye por CUP cuando la politica contable esta ausente', async () => {
    mocks.getMonedaPrincipalAction.mockResolvedValue(politicaAusente);

    const user = userEvent.setup();
    render(<EnhancedVentaForm />);

    const trigger = await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await user.click(trigger);

    const opciones = screen.getAllByRole('option');
    expect(opciones.some((opcion) => opcion.getAttribute('data-state') === 'checked')).toBe(false);

    await user.keyboard('{Escape}');
    expect(trigger).toHaveTextContent('Seleccione la moneda');
  });

  it('crea una venta con el producto seleccionado y muestra el resumen', async () => {
    render(<EnhancedVentaForm />);
    const user = await completeForm();

    expect(screen.getByText('Resumen de la Venta')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(1));
    expect(mocks.createVentaAction.mock.calls[0][0]).toMatchObject({
      puntoDeVentaId: 'pv1',
      items: [{ productoId: 'p1', cantidad: 2, precioUnitario: 100 }],
    });
    expect(mocks.router.refresh).toHaveBeenCalled();
  });

  it('actualiza una venta existente', async () => {
    render(
      <EnhancedVentaForm
        initialData={{
          ventaId: 'venta-1',
          productoId: 'p1',
          cantidad: 1,
          puntoDeVentaId: 'pv1',
          moneda: 'USD',
        }}
      />,
    );

    await screen.findByRole('combobox', { name: TRIGGER_MONEDA });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => expect(mocks.updateVentaAction).toHaveBeenCalledTimes(1));
    expect(mocks.updateVentaAction).toHaveBeenCalledWith({ ventaId: 'venta-1' });
  });

  it('confirma conversión al vender en una moneda distinta', async () => {
    render(<EnhancedVentaForm />);
    const user = await completeForm();
    await user.click(screen.getByRole('combobox', { name: TRIGGER_MONEDA }));
    await user.click(screen.getByRole('option', { name: /CUP/ }));

    expect(screen.getByText(/requiere conversión de moneda/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar tasa' }));

    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(1));
  });

  it('cancela la confirmación de conversión sin crear la venta', async () => {
    render(<EnhancedVentaForm />);
    const user = await completeForm();
    await user.click(screen.getByRole('combobox', { name: TRIGGER_MONEDA }));
    await user.click(screen.getByRole('option', { name: /CUP/ }));
    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar tasa' }));

    expect(mocks.createVentaAction).not.toHaveBeenCalled();
  });

  it('muestra error si crear o actualizar la venta falla', async () => {
    mocks.createVentaAction
      .mockResolvedValueOnce({ success: false, error: { message: 'No permitido' } })
      .mockRejectedValueOnce(new Error('fallo de red'));
    const user = userEvent.setup();

    render(<EnhancedVentaForm />);
    await completeForm();
    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(2));
    expect(mocks.sileo.error).toHaveBeenCalled();
  });

  it('muestra el error al actualizar una venta', async () => {
    mocks.updateVentaAction.mockResolvedValue({
      success: false,
      error: { message: 'No permitido' },
    });
    render(
      <EnhancedVentaForm
        initialData={{
          ventaId: 'venta-1',
          productoId: 'p1',
          cantidad: 1,
          puntoDeVentaId: 'pv1',
          moneda: 'USD',
        }}
      />,
    );

    await screen.findByRole('button', { name: 'Actualizar' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => expect(mocks.updateVentaAction).toHaveBeenCalledTimes(1));
    expect(mocks.sileo.error).toHaveBeenCalled();
  });

  it('maneja un error al cargar productos y la cancelación del formulario', async () => {
    mocks.getProductosAction.mockRejectedValueOnce(new Error('catalogo caído'));
    render(<EnhancedVentaForm />);

    await waitFor(() => expect(mocks.getProductosAction).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(mocks.router.push).toHaveBeenCalledWith('/busy/sales');
  });

  it('ignora resultados de productos después de desmontar el formulario', async () => {
    let resolverProductos: (valor: unknown) => void = () => undefined;
    mocks.getProductosAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolverProductos = resolve;
        }),
    );

    const { unmount } = render(<EnhancedVentaForm />);
    unmount();
    resolverProductos({
      success: true,
      data: [{ id: 'p2', nombre: 'Arroz', stock: 4, precioVenta: 50 }],
    });

    await waitFor(() => expect(mocks.getProductosAction).toHaveBeenCalledTimes(1));
  });

  it('mantiene el formulario vacío cuando el catálogo responde sin éxito', async () => {
    mocks.getProductosAction.mockResolvedValueOnce({ success: false, data: [] });
    render(<EnhancedVentaForm />);

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: TRIGGER_MONEDA })).toBeInTheDocument(),
    );
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Producto' }));
    expect(screen.queryByRole('option', { name: /Harina/ })).toBeNull();
  });

  it('usa una lista vacía cuando el catálogo exitoso no incluye datos', async () => {
    mocks.getProductosAction.mockResolvedValueOnce({ success: true });
    render(<EnhancedVentaForm />);

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: TRIGGER_MONEDA })).toBeInTheDocument(),
    );
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Producto' }));
    expect(screen.queryByRole('option', { name: /Harina/ })).toBeNull();
  });

  it('usa el precio de venta opcional al crear una venta', async () => {
    render(<EnhancedVentaForm />);
    const user = await completeForm();
    await user.type(screen.getByLabelText('Precio de Venta (Opcional)'), '125');
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() =>
      expect(mocks.createVentaAction.mock.calls[0][0].items[0]).toMatchObject({
        precioUnitario: 125,
      }),
    );
  });

  it('usa el mensaje predeterminado cuando crear devuelve un error sin detalle', async () => {
    mocks.createVentaAction.mockResolvedValueOnce({ success: false });
    render(<EnhancedVentaForm />);
    const user = await completeForm();
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.sileo.error).toHaveBeenCalled());
  });
});
