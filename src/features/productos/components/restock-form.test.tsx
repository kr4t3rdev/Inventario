/**
 * @description Verifica que el formulario de restock use la política
 * contable del tenant como fuente de la moneda principal.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getMonedaPrincipalAction: vi.fn(),
  restockProductoAction: vi.fn(),
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('framer-motion', () => ({
  LazyMotion: ({ children }: { children: unknown }) => children,
  AnimatePresence: ({ children }: { children: unknown }) => children,
  motion: { span: 'span' },
  m: { div: 'div', span: 'span' },
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
        nombre: 'Dólar Estadounidense',
        simbolo: 'US$',
        esPrincipal: false,
        isActive: true,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/features/contabilidad/hooks/use-cuentas-bancarias', () => ({
  useCuentasBancarias: () => ({
    cuentas: [
      {
        cuentaId: 'cuenta-cup',
        nombreBanco: 'Banco CUP',
        numeroCuenta: '1111',
        moneda: 'CUP',
        isActive: true,
      },
      {
        cuentaId: 'cuenta-usd',
        nombreBanco: 'Banco USD',
        numeroCuenta: '2222',
        moneda: 'USD',
        isActive: true,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/features/productos/actions', () => ({
  restockProductoAction: mocks.restockProductoAction,
}));

vi.mock('@/lib/sileo-shim', () => ({
  sileo: mocks.sileo,
}));

vi.mock('@/features/productos/components/product-photo-upload', () => ({
  ProductPhotoUpload: () => null,
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

import { RestockForm } from './restock-form';

const producto = {
  id: 'producto-1',
  nombre: 'Harina',
  descripcion: null,
  precioCosto: 80,
  precioVenta: 100,
  stock: 10,
  unidad: { simbolo: 'kg' },
};

const politicaConfigurada = (moneda: string) => ({
  success: true,
  data: { estado: 'CONFIGURADA', moneda },
});

const politicaAusente = {
  success: true,
  data: { estado: 'AUSENTE', moneda: null },
};

describe('RestockForm - moneda principal desde la política contable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMonedaPrincipalAction.mockResolvedValue(politicaConfigurada('USD'));
    mocks.restockProductoAction.mockResolvedValue({ success: true, data: {} });
  });

  it('espera la política antes de mostrar el formulario', async () => {
    let resolverPolitica: (valor: unknown) => void = () => undefined;
    mocks.getMonedaPrincipalAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverPolitica = resolve;
        }),
    );

    render(<RestockForm producto={producto} />);

    expect(screen.queryByRole('combobox', { name: /Moneda de la Compra/ })).toBeNull();

    resolverPolitica(politicaConfigurada('USD'));

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /Moneda de la Compra/ })).toBeInTheDocument(),
    );
  });

  it('usa la moneda de la política como default y selecciona una cuenta de esa moneda', async () => {
    const user = userEvent.setup();
    render(<RestockForm producto={producto} />);

    const moneda = await screen.findByRole('combobox', { name: /Moneda de la Compra/ });
    await user.click(moneda);

    expect(screen.getByRole('option', { name: /USD/ })).toHaveAttribute('data-state', 'checked');
    expect(screen.getByRole('option', { name: /CUP/ })).toHaveAttribute('data-state', 'unchecked');
    await user.keyboard('{Escape}');

    const cuenta = screen.getByRole('combobox', { name: /Cuenta Bancaria/ });
    await user.click(cuenta);
    expect(screen.getByRole('option', { name: /Banco USD/ })).toHaveAttribute(
      'data-state',
      'checked',
    );
    expect(screen.queryByRole('option', { name: /Banco CUP/ })).toBeNull();
  });

  it('etiqueta la moneda del catálogo como base de tasas', async () => {
    const user = userEvent.setup();
    render(<RestockForm producto={producto} />);

    await user.click(await screen.findByRole('combobox', { name: /Moneda de la Compra/ }));

    expect(screen.getByText('Base de tasas')).toBeInTheDocument();
    expect(screen.queryByText('Principal')).toBeNull();
  });

  it('exige conversión al elegir una moneda distinta de la política', async () => {
    const user = userEvent.setup();
    render(<RestockForm producto={producto} />);

    const moneda = await screen.findByRole('combobox', { name: /Moneda de la Compra/ });
    await user.click(moneda);
    await user.click(screen.getByRole('option', { name: /CUP/ }));

    expect(
      screen.getByText('Esta compra requiere conversión de moneda. Se solicitará confirmación de la tasa de cambio.'),
    ).toBeInTheDocument();
  });

  it('no sustituye por CUP cuando la política está ausente', async () => {
    mocks.getMonedaPrincipalAction.mockResolvedValue(politicaAusente);
    const user = userEvent.setup();
    render(<RestockForm producto={producto} />);

    const moneda = await screen.findByRole('combobox', { name: /Moneda de la Compra/ });
    await user.click(moneda);
    expect(screen.getAllByRole('option').some((item) => item.getAttribute('data-state') === 'checked')).toBe(
      false,
    );
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('combobox', { name: /Cuenta Bancaria/ }));
    expect(screen.getByText(/No hay cuentas activas en/)).toBeInTheDocument();
  });

  it('realiza un restock completo y ejecuta el callback de éxito', async () => {
    const onSuccess = vi.fn();
    render(<RestockForm producto={producto} onSuccess={onSuccess} />);

    await screen.findByRole('button', { name: 'Realizar Restock' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Realizar Restock' }));

    await waitFor(() => expect(mocks.restockProductoAction).toHaveBeenCalledTimes(1));
    expect(mocks.restockProductoAction.mock.calls[0][0]).toMatchObject({
      productoId: 'producto-1',
      cantidad: 1,
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      cuentaId: 'cuenta-usd',
      tipoRestock: 'auto',
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('envía un restock parcial con estado pendiente', async () => {
    render(<RestockForm producto={producto} />);
    const user = userEvent.setup();

    await screen.findByRole('button', { name: 'Realizar Restock' });
    await user.click(screen.getByRole('combobox', { name: 'Forma de Pago' }));
    await user.click(screen.getByRole('option', { name: 'Pago parcial' }));
    await user.click(screen.getByRole('button', { name: 'Realizar Restock' }));

    await waitFor(() =>
      expect(mocks.restockProductoAction.mock.calls[0][0]).toMatchObject({
        formaPago: 'PAGO_PARCIAL',
        estado: 'PENDIENTE',
        cuentaId: 'cuenta-usd',
      }),
    );
  });

  it('permite elegir cómo aplicar un cambio de precios', async () => {
    const user = userEvent.setup();
    render(<RestockForm producto={producto} />);

    await screen.findByRole('button', { name: 'Realizar Restock' });
    await user.clear(screen.getByLabelText('Nuevo Precio de Costo'));
    await user.type(screen.getByLabelText('Nuevo Precio de Costo'), '90');
    await user.clear(screen.getByLabelText('Nuevo Precio de Venta'));
    await user.type(screen.getByLabelText('Nuevo Precio de Venta'), '110');
    await user.click(screen.getByRole('button', { name: 'Realizar Restock' }));

    expect(screen.getByText('¿Cómo desea realizar el restock?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Sumar al stock actual/ }));

    await waitFor(() => expect(mocks.restockProductoAction).toHaveBeenCalledTimes(1));
    expect(mocks.restockProductoAction.mock.calls[0][0]).toMatchObject({
      precioCosto: 90,
      precioVenta: 110,
      tipoRestock: 'sumar_stock',
    });
  });

  it('cancela la selección de tipo de restock', async () => {
    const user = userEvent.setup();
    render(<RestockForm producto={producto} />);

    await screen.findByRole('button', { name: 'Realizar Restock' });
    await user.clear(screen.getByLabelText('Nuevo Precio de Costo'));
    await user.type(screen.getByLabelText('Nuevo Precio de Costo'), '90');
    await user.clear(screen.getByLabelText('Nuevo Precio de Venta'));
    await user.type(screen.getByLabelText('Nuevo Precio de Venta'), '110');
    await user.click(screen.getByRole('button', { name: 'Realizar Restock' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(mocks.restockProductoAction).not.toHaveBeenCalled();
  });

  it('confirma conversión al comprar en una moneda distinta', async () => {
    const user = userEvent.setup();
    render(<RestockForm producto={producto} />);

    const moneda = await screen.findByRole('combobox', { name: /Moneda de la Compra/ });
    await user.click(moneda);
    await user.click(screen.getByRole('option', { name: /CUP/ }));
    await user.click(screen.getByRole('button', { name: 'Realizar Restock' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar tasa' }));

    await waitFor(() =>
      expect(mocks.restockProductoAction.mock.calls[0][0]).toMatchObject({
        moneda: 'CUP',
        tasaCambio: 2,
        montoConvertido: 200,
        monedaOriginal: 'CUP',
      }),
    );
  });

  it('convierte precios cuando cambia precios y moneda', async () => {
    const user = userEvent.setup();
    render(<RestockForm producto={producto} />);

    const moneda = await screen.findByRole('combobox', { name: /Moneda de la Compra/ });
    await user.click(moneda);
    await user.click(screen.getByRole('option', { name: /CUP/ }));
    await user.clear(screen.getByLabelText('Nuevo Precio de Costo'));
    await user.type(screen.getByLabelText('Nuevo Precio de Costo'), '90');
    await user.clear(screen.getByLabelText('Nuevo Precio de Venta'));
    await user.type(screen.getByLabelText('Nuevo Precio de Venta'), '110');
    await user.click(screen.getByRole('button', { name: 'Realizar Restock' }));
    await user.click(screen.getByRole('button', { name: /Sumar al stock actual/ }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar tasa' }));

    await waitFor(() =>
      expect(mocks.restockProductoAction.mock.calls[0][0]).toMatchObject({
        precioCosto: 180,
        precioVenta: 220,
        tipoRestock: 'sumar_stock',
      }),
    );
  });

  it('cancela la conversión y permite cancelar el formulario', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<RestockForm producto={producto} onCancel={onCancel} />);

    const moneda = await screen.findByRole('combobox', { name: /Moneda de la Compra/ });
    await user.click(moneda);
    await user.click(screen.getByRole('option', { name: /CUP/ }));
    await user.click(screen.getByRole('button', { name: 'Realizar Restock' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar tasa' }));
    expect(mocks.restockProductoAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('muestra el estado de carga y los errores del action', async () => {
    let resolveAction: (value: unknown) => void = () => undefined;
    mocks.restockProductoAction.mockImplementationOnce(
      () => new Promise((resolve) => { resolveAction = resolve; }),
    );
    render(<RestockForm producto={producto} />);

    await screen.findByRole('button', { name: 'Realizar Restock' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Realizar Restock' }));
    expect(screen.getByRole('button', { name: /Procesando/ })).toBeDisabled();
    resolveAction({ success: false, error: { message: 'No permitido' } });
    await waitFor(() => expect(mocks.sileo.error).toHaveBeenCalled());
  });

  it('usa unidades de respaldo cuando el producto no tiene unidad', async () => {
    const productoSinUnidad = { ...producto, unidad: undefined };
    render(<RestockForm producto={productoSinUnidad} />);

    await screen.findByRole('button', { name: 'Realizar Restock' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Realizar Restock' }));

    await waitFor(() => expect(mocks.restockProductoAction).toHaveBeenCalledTimes(1));
    expect(mocks.sileo.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('unidades') }),
    );
  });
});
