import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  createCuentaBancariaAction: vi.fn(),
  updateCuentaBancariaAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('@/features/contabilidad/actions-cuentas-bancarias', () => ({
  createCuentaBancariaAction: mocks.createCuentaBancariaAction,
  updateCuentaBancariaAction: mocks.updateCuentaBancariaAction,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    m: new Proxy({}, {
      get: () => ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
    }),
  };
});

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SidebarInset: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { CuentasPageClient } from '@/features/contabilidad/components/cuentas-page-client';

const cuentasMultiMoneda = [
  { cuentaId: 'c1', nombreBanco: 'Banco A', numeroCuenta: '111', tipoCuenta: 'AHORROS', moneda: 'CUP', saldo: 1000, isActive: true },
  { cuentaId: 'c2', nombreBanco: 'Banco B', numeroCuenta: '222', tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: 500, isActive: true },
  { cuentaId: 'c3', nombreBanco: 'Banco C', numeroCuenta: '333', tipoCuenta: 'EFECTIVO', moneda: 'USD', saldo: 300, isActive: false },
];

describe('CuentasPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('agrupa el saldo por moneda sin sumar divisas distintas', () => {
    render(<CuentasPageClient cuentas={cuentasMultiMoneda} />);

    // La tarjeta de saldos debe mostrar cada moneda con su subtotal
    const tarjeta = screen.getByText(/Saldos por moneda/i).closest('[data-slot="card"]');
    expect(tarjeta?.textContent).toMatch(/CUP/);
    expect(tarjeta?.textContent).toMatch(/USD/);

    // La suma incorrecta CUP+USD (1800) no debe aparecer en la tarjeta de saldos
    expect(tarjeta?.textContent).not.toMatch(/1.?800[,.]00/);
  });

  it('muestra error con reintento cuando el servidor falló', async () => {
    render(<CuentasPageClient cuentas={[]} error="Error de base de datos" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/error de base de datos/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /intentar nuevamente/i }));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('sin error, no muestra estado de error', () => {
    render(<CuentasPageClient cuentas={cuentasMultiMoneda} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
