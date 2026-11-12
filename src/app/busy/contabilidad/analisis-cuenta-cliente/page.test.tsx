import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();
const useClientesMock = vi.fn();
const mockGetCuentasPorCobrar = vi.fn();
const mockGetEstadoDeCuenta = vi.fn();
const mockExportEstadoDeCuentaPdf = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/analisis-cuenta-cliente',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/features/clientes/hooks/use-clientes', () => ({
  useClientes: () => useClientesMock(),
}));

vi.mock('@/features/contabilidad', () => ({
  getCuentasPorCobrarAction: (...args: unknown[]) =>
    mockGetCuentasPorCobrar(...args),
  getEstadoDeCuentaClienteAction: (...args: unknown[]) =>
    mockGetEstadoDeCuenta(...args),
}));

vi.mock('@/features/contabilidad/utils/estado-cuenta-pdf', () => ({
  exportEstadoDeCuentaPdf: (...args: unknown[]) =>
    mockExportEstadoDeCuentaPdf(...args),
}));

vi.mock('@/features/facturas/actions', () => ({
  getFacturasAction: vi.fn().mockResolvedValue({ success: true, data: { data: [] } }),
}));

import AnalisisCuentaClientePage from './page';

describe('/busy/contabilidad/analisis-cuenta-cliente page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClientesMock.mockReturnValue({ clientes: [], isLoading: false });
  });

  it('redirige al dashboard de contabilidad cuando el plan es Básico', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'reportes-financieros': true },
      },
    });

    render(<AnalisisCuentaClientePage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/busy/contabilidad');
    });
  });

  it('F-6: Exportar PDF consulta el estado de cuenta y dispara el PDF', async () => {
    useAuthMock.mockReturnValue({ user: { role: 'admin' } });
    useClientesMock.mockReturnValue({
      clientes: [
        { clienteId: 'cli-1', nombre: 'Cliente Uno', telefono: '123-4567' },
      ],
      isLoading: false,
    });
    mockGetCuentasPorCobrar.mockResolvedValue({
      success: true,
      data: { cuentas: [] },
    });
    mockGetEstadoDeCuenta.mockResolvedValue({
      success: true,
      data: {
        empresa: { nombre: 'Empresa ACME' },
        cliente: { clienteId: 'cli-1', nombre: 'Cliente Uno' },
        generadoEn: '2026-09-28T12:00:00.000Z',
        resumen: {
          porMoneda: [{
            moneda: 'DOP',
            deudaTotal: 1000,
            deudaVencida: 1000,
            saldoAFavorAnticipos: 200,
            saldoAFavorNotasCredito: 100,
            saldoAFavor: 300,
            saldoNeto: 700,
          }],
        },
        cuentasPorCobrar: [],
        anticipos: [],
        notasCredito: [],
        facturas: [],
        pagos: [],
      },
    });

    render(<AnalisisCuentaClientePage />);

    // Selecciona un cliente en el combobox (pointerDown abre el Popover de Radix en jsdom).
    const trigger = screen.getByRole('combobox');
    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Cliente Uno'));

    // El botón ya no es decorativo: dispara action + PDF.
    fireEvent.click(screen.getByRole('button', { name: /exportar pdf/i }));

    await waitFor(() => {
      expect(mockGetEstadoDeCuenta).toHaveBeenCalledWith({ clienteId: 'cli-1' });
      expect(mockExportEstadoDeCuentaPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          cliente: expect.objectContaining({ clienteId: 'cli-1' }),
          resumen: expect.objectContaining({
            porMoneda: [expect.objectContaining({ moneda: 'DOP', saldoNeto: 700 })],
          }),
        }),
      );
    });
  });

  it('F-6: si el action falla, no se genera el PDF', async () => {
    useAuthMock.mockReturnValue({ user: { role: 'admin' } });
    useClientesMock.mockReturnValue({
      clientes: [
        { clienteId: 'cli-1', nombre: 'Cliente Uno', telefono: '123-4567' },
      ],
      isLoading: false,
    });
    mockGetCuentasPorCobrar.mockResolvedValue({
      success: true,
      data: { cuentas: [] },
    });
    mockGetEstadoDeCuenta.mockResolvedValue({
      success: false,
      error: { message: 'Cliente no encontrado', code: 'NOT_FOUND' },
    });

    render(<AnalisisCuentaClientePage />);

    const trigger = screen.getByRole('combobox');
    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Cliente Uno'));
    fireEvent.click(screen.getByRole('button', { name: /exportar pdf/i }));

    await waitFor(() => {
      expect(mockGetEstadoDeCuenta).toHaveBeenCalled();
    });
    expect(mockExportEstadoDeCuentaPdf).not.toHaveBeenCalled();
  });
});
