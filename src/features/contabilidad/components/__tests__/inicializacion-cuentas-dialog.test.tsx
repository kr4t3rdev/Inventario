import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const initializeMock = vi.hoisted(() => vi.fn());
const paymentTypesMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: toastErrorMock } }));
vi.mock('@/features/contabilidad/actions-cuentas-bancarias', () => ({ initializeBankAccountsAction: initializeMock }));
vi.mock('@/features/contabilidad/actions-tipos-pago', () => ({ getTiposPagoAction: paymentTypesMock }));

import { InicializacionCuentasDialog } from '../inicializacion-cuentas-dialog';

describe('InicializacionCuentasDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('crypto', { randomUUID: () => 'request-1' });
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: ResizeObserverMock });
    paymentTypesMock.mockResolvedValue({ success: true, data: { data: [] } });
    initializeMock.mockResolvedValue({ success: false, error: { message: 'Carga bloqueada' } });
  });

  it('envía saldo positivo sin asignarlo a capital, deuda o anticipo si el origen es desconocido', async () => {
    const user = userEvent.setup();
    render(<InicializacionCuentasDialog />);

    await user.click(screen.getByRole('button', { name: 'Inicializar saldos' }));
    const fields = screen.getAllByRole('textbox');
    await user.type(fields[0], 'Caja principal');
    await user.type(fields[1], 'Banco QA');
    await user.type(fields[2], 'QA-01');
    await user.clear(fields[3]);
    await user.type(fields[3], '100000');

    const selects = screen.getAllByRole('combobox');
    await user.click(selects[2]);
    await user.click(screen.getByRole('option', { name: 'No documentada' }));
    expect(screen.getByRole('note')).toHaveTextContent(/No se clasifica como capital, préstamo o anticipo/);
    await user.click(screen.getByRole('button', { name: 'Inicializar cuentas' }));

    expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'request-1',
      cuentas: [expect.objectContaining({
        nombreCuenta: 'Caja principal',
        saldoInicial: '100000',
        origenNoDocumentado: true,
      })],
    }));
    expect(initializeMock.mock.calls[0][0].cuentas[0]).not.toHaveProperty('origen');
    expect(toastErrorMock).toHaveBeenCalledWith('Carga bloqueada');
  });
});
