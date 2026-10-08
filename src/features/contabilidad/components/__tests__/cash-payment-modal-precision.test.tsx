import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/features/contabilidad/actions-prestamos-cash', () => ({
  registrarPagoPrestamoAction: vi.fn(),
}));
vi.mock('@/features/contabilidad/actions-deudas-cash', () => ({
  registrarPagoDeudaAction: vi.fn(),
}));

import { PagoPrestamoModal } from '@/features/contabilidad/components/prestamos-cash/pago-prestamo-modal';
import { PagoDeudaModal } from '@/features/contabilidad/components/deudas-cash/pago-deuda-modal';

describe('cash payment modal precision', () => {
  it('permits and displays four decimal places for loan payments', () => {
    render(
      <PagoPrestamoModal
        open
        onOpenChange={vi.fn()}
        prestamo={{
          id: 'loan-1',
          idNumerico: 1,
          moneda: 'CUP',
          montoCapital: 123.4,
          cliente: { nombre: 'Cliente' },
          cuentaPorCobrar: { montoDeuda: 123.4, montoPagado: 0 },
        } as never}
        cuentasBancarias={[]}
        tiposPago={[]}
      />,
    );

    expect(screen.getByLabelText('Monto a pagar')).toHaveAttribute('step', '0.0001');
    expect(screen.getByText(/Saldo pendiente actual: 123\.4000 CUP/)).toBeInTheDocument();
    expect(screen.getByText(/Saldo restante tras este pago: 0\.0000 CUP/)).toBeInTheDocument();
  });

  it('permits and displays four decimal places for debt payments', () => {
    render(
      <PagoDeudaModal
        open
        onOpenChange={vi.fn()}
        deuda={{
          id: 'debt-1',
          idNumerico: 1,
          moneda: 'CUP',
          montoCapital: 98.7654,
          proveedor: { nombre: 'Proveedor' },
          cuentaPorPagar: { saldoPendiente: 98.7654 },
        } as never}
        cuentasBancarias={[]}
        tiposPago={[]}
      />,
    );

    expect(screen.getByLabelText('Monto a pagar')).toHaveAttribute('step', '0.0001');
    expect(screen.getByText(/Saldo: CUP 98\.7654/)).toBeInTheDocument();
  });
});
