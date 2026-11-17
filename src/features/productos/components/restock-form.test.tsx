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
}));

vi.mock('framer-motion', () => ({
  LazyMotion: ({ children }: { children: unknown }) => children,
  AnimatePresence: ({ children }: { children: unknown }) => children,
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

vi.mock('@/features/productos/components/product-photo-upload', () => ({
  ProductPhotoUpload: () => null,
}));

vi.mock('@/features/contabilidad/components/tasa-cambio-dialog', () => ({
  TasaCambioDialog: () => null,
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
});
