import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const initializeMock = vi.hoisted(() => vi.fn());
const paymentTypesMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const guardarBorradorMock = vi.hoisted(() => vi.fn());
const obtenerActualMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock('sonner', () => ({ toast: { success: toastSuccessMock, error: toastErrorMock } }));
vi.mock('@/features/contabilidad/actions-cuentas-bancarias', () => ({ initializeBankAccountsAction: initializeMock }));
vi.mock('@/features/contabilidad/actions-tipos-pago', () => ({ getTiposPagoAction: paymentTypesMock }));
vi.mock('@/features/contabilidad/actions-inicializacion-borrador', () => ({
  guardarBorradorInicializacionAction: guardarBorradorMock,
  obtenerBorradorActualInicializacionAction: obtenerActualMock,
}));

import { InicializacionCuentasDialog } from '../inicializacion-cuentas-dialog';

const draftResumed = {
  idempotencyKey: 'draft-key-1',
  payloadHash: 'b'.repeat(64),
  borrador: {
    fechaCorte: '2026-11-01',
    monedaFuncional: 'CUP',
    cuentas: [{
      nombreCuenta: 'Caja retomada',
      nombreBanco: 'Banco QA',
      numeroCuenta: 'QA-01',
      tipoCuenta: 'CORRIENTE',
      moneda: 'CUP',
      saldoInicial: '50000',
      origenNoDocumentado: true,
    }],
  },
};

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<InicializacionCuentasDialog />);
  await user.click(screen.getByRole('button', { name: 'Inicializar saldos' }));
}

async function fillAccount(user: ReturnType<typeof userEvent.setup>, values: { nombre: string; banco: string; numero: string; saldo: string }) {
  const fields = screen.getAllByRole('textbox');
  await user.type(fields[0], values.nombre);
  await user.type(fields[1], values.banco);
  await user.type(fields[2], values.numero);
  await user.clear(fields[3]);
  await user.type(fields[3], values.saldo);
}

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
    guardarBorradorMock.mockResolvedValue({ success: true, data: { idempotencyKey: 'request-1', estado: 'BORRADOR' } });
    obtenerActualMock.mockResolvedValue({ success: true, data: null });
  });

  it('envía saldo positivo sin asignarlo a capital, deuda o anticipo si el origen es desconocido', async () => {
    const user = userEvent.setup();
    await openDialog(user);
    await fillAccount(user, { nombre: 'Caja principal', banco: 'Banco QA', numero: 'QA-01', saldo: '100000' });

    const selects = screen.getAllByRole('combobox');
    await user.click(selects[2]);
    await user.click(screen.getByRole('option', { name: 'No documentada' }));
    expect(screen.getByRole('note')).toHaveTextContent(/No se clasifica como capital, préstamo o anticipo/);
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    expect(screen.getByText(/Total funcional: 100000 CUP/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inicializar cuentas' }));

    expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'request-1',
      fechaCorte: expect.any(String),
      monedaFuncional: 'CUP',
      cuentas: [expect.objectContaining({
        nombreCuenta: 'Caja principal',
        saldoInicial: '100000',
        origenNoDocumentado: true,
      })],
    }));
    expect(initializeMock.mock.calls[0][0].cuentas[0]).not.toHaveProperty('origen');
    expect(toastErrorMock).toHaveBeenCalledWith('Carga bloqueada');
  });

  it('al abrir retoma el borrador actual y confirma con su clave', async () => {
    const user = userEvent.setup();
    obtenerActualMock.mockResolvedValue({ success: true, data: draftResumed });
    await openDialog(user);
    expect(await screen.findByDisplayValue('Caja retomada')).toBeInTheDocument();
    expect(screen.getByText(/Borrador retomado/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    await user.click(screen.getByRole('button', { name: 'Inicializar cuentas' }));
    expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'draft-key-1' }));
  });

  it('guarda el borrador con la carga parcial del formulario', async () => {
    const user = userEvent.setup();
    await openDialog(user);
    await fillAccount(user, { nombre: 'Caja principal', banco: 'Banco QA', numero: 'QA-01', saldo: '100000' });
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(guardarBorradorMock).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'request-1',
      borrador: expect.objectContaining({
        monedaFuncional: 'CUP',
        cuentas: [expect.objectContaining({ nombreCuenta: 'Caja principal', saldoInicial: '100000' })],
      }),
    }));
    expect(toastSuccessMock).toHaveBeenCalledWith('Borrador guardado');
  });

  it('la revisión muestra los faltantes y bloquea la confirmación', async () => {
    const user = userEvent.setup();
    await openDialog(user);
    await fillAccount(user, { nombre: 'Caja USD', banco: 'Banco QA', numero: 'QA-02', saldo: '100' });
    const selects = screen.getAllByRole('combobox');
    await user.click(selects[1]);
    await user.click(screen.getByRole('option', { name: 'USD' }));
    await user.click(selects[2]);
    await user.click(screen.getByRole('option', { name: 'No documentada' }));
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    expect(screen.getByText(/falta la tasa a moneda funcional \(USD → CUP\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inicializar cuentas' })).toBeDisabled();
    expect(initializeMock).not.toHaveBeenCalled();
  });

  it('la revisión con datos completos muestra el total y permite confirmar', async () => {
    const user = userEvent.setup();
    await openDialog(user);
    await fillAccount(user, { nombre: 'Caja USD', banco: 'Banco QA', numero: 'QA-02', saldo: '100' });
    const selects = screen.getAllByRole('combobox');
    await user.click(selects[1]);
    await user.click(screen.getByRole('option', { name: 'USD' }));
    const fields = screen.getAllByRole('textbox');
    await user.type(fields[4], '24');
    await user.click(selects[2]);
    await user.click(screen.getByRole('option', { name: 'No documentada' }));
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    expect(screen.getByText(/Total funcional: 2400 CUP/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inicializar cuentas' })).toBeEnabled();
  });
});
