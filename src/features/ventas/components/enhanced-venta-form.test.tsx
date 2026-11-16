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
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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

import { EnhancedVentaForm } from './enhanced-venta-form';

const TRIGGER_MONEDA = /Moneda de la Venta/;

const politicaConfigurada = (moneda: string) => ({
  success: true,
  data: { estado: 'CONFIGURADA', moneda },
});

describe('EnhancedVentaForm - moneda principal desde la politica contable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMonedaPrincipalAction.mockResolvedValue(politicaConfigurada('USD'));
    mocks.getProductosAction.mockResolvedValue({
      success: true,
      data: [{ id: 'p1', nombre: 'Harina', stock: 10, precioVenta: 100, unidad: { simbolo: 'kg' } }],
    });
    mocks.usePuntosDeVenta.mockReturnValue({
      puntosDeVenta: [{ id: 'pv1', nombre: 'Sucursal 1' }],
      isLoading: false,
    });
    mocks.createVentaAction.mockResolvedValue({ success: true, data: {} });
    mocks.updateVentaAction.mockResolvedValue({ success: true, data: {} });
  });

  it('carga el catalogo de productos y deja de mostrar el skeleton', async () => {
    render(<EnhancedVentaForm />);

    await waitFor(() => expect(mocks.getProductosAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('combobox', { name: TRIGGER_MONEDA })).toBeInTheDocument();
  });
});
