import { render, screen } from '@testing-library/react';
import { initializationDraftContract } from '@/features/contabilidad/services/initialization-contract';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const initializeMock = vi.hoisted(() => vi.fn());
const paymentTypesMock = vi.hoisted(() => vi.fn());
const authUserMock = vi.hoisted(() => vi.fn());
const getProductsMock = vi.hoisted(() => vi.fn());
const getWarehousesMock = vi.hoisted(() => vi.fn());
const getClientsMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const guardarBorradorMock = vi.hoisted(() => vi.fn());
const obtenerActualMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: authUserMock }));
vi.mock('sonner', () => ({ toast: { success: toastSuccessMock, error: toastErrorMock } }));
vi.mock('@/features/contabilidad/actions-cuentas-bancarias', () => ({ initializeBankAccountsAction: initializeMock }));
vi.mock('@/features/contabilidad/actions-tipos-pago', () => ({ getTiposPagoAction: paymentTypesMock }));
vi.mock('@/features/productos/actions-crud', () => ({ getProductosAction: getProductsMock }));
vi.mock('@/features/almacenes/actions', () => ({ getAlmacenesAction: getWarehousesMock }));
vi.mock('@/features/clientes/actions', () => ({ getClientesAction: getClientsMock }));
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

const draftResumedIncomplete = {
  idempotencyKey: 'draft-key-2',
  payloadHash: 'c'.repeat(64),
  borrador: {
    monedaFuncional: 'CUP',
    cuentas: [{
      nombreCuenta: 'Caja sin saldo',
      nombreBanco: 'Banco QA',
      numeroCuenta: 'QA-09',
      tipoCuenta: 'CORRIENTE',
      moneda: 'CUP',
    }],
  },
};

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<InicializacionCuentasDialog />);
  await user.click(screen.getByRole('button', { name: 'Cargar saldos iniciales' }));
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
    authUserMock.mockReturnValue({ user: { role: 'manager', planFeatures: {} } });
    getProductsMock.mockResolvedValue({ success: true, data: [] });
    getWarehousesMock.mockResolvedValue({ success: true, data: [] });
    getClientsMock.mockResolvedValue({ success: true, data: [] });
    initializeMock.mockResolvedValue({ success: false, error: { message: 'Carga bloqueada' } });
    guardarBorradorMock.mockResolvedValue({ success: true, data: { idempotencyKey: 'request-1', estado: 'BORRADOR' } });
    obtenerActualMock.mockResolvedValue({ success: true, data: null });
  });

  it('envía saldo positivo sin asignarlo a capital, deuda o anticipo si el origen es desconocido', async () => {
    const user = userEvent.setup();
    await openDialog(user);
    expect(screen.queryByRole('region', { name: 'Inventario inicial' })).not.toBeInTheDocument();
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

  it('no restaura ni envía inventario de un borrador si el plan no permite productos', async () => {
    const user = userEvent.setup();
    obtenerActualMock.mockResolvedValue({
      success: true,
      data: { idempotencyKey: 'draft-key-3', borrador: { inventario: [{ referenciaFila: 'line-1' }] } },
    });
    await openDialog(user);
    expect(screen.queryByRole('region', { name: 'Inventario inicial' })).not.toBeInTheDocument();
    expect(getProductsMock).not.toHaveBeenCalled();
    expect(getWarehousesMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(guardarBorradorMock.mock.calls[0][0].borrador).not.toHaveProperty('inventario');
  });

  it('retomar un borrador sin fecha ni saldo preserva la omisión y los marca pendientes', async () => {
    const user = userEvent.setup();
    obtenerActualMock.mockResolvedValue({ success: true, data: draftResumedIncomplete });
    guardarBorradorMock.mockResolvedValue({ success: true, data: { idempotencyKey: 'draft-key-2', estado: 'BORRADOR', borrador: {} } });
    await openDialog(user);
    expect(await screen.findByDisplayValue('Caja sin saldo')).toBeInTheDocument();
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput.value).toBe('');
    const fields = screen.getAllByRole('textbox');
    expect((fields[3] as HTMLInputElement).value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    const borrador = guardarBorradorMock.mock.calls[0][0].borrador as Record<string, unknown>;
    expect(borrador).not.toHaveProperty('fechaCorte');
    const cuenta = (borrador.cuentas as Array<Record<string, unknown>>)[0];
    expect(cuenta).not.toHaveProperty('saldoInicial');
    expect(initializationDraftContract.safeParse({ ...borrador, idempotencyKey: 'draft-key-2' }).success).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    expect(screen.getByText(/Falta la fecha de corte/)).toBeInTheDocument();
    expect(screen.getByText(/Cuenta 1: falta el saldo inicial/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inicializar cuentas' })).toBeDisabled();
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

  it('guarda el borrador vacío sin enviar campos de cuenta vacíos', async () => {
    const user = userEvent.setup();
    guardarBorradorMock.mockResolvedValue({ success: true, data: { idempotencyKey: 'request-1', estado: 'BORRADOR', borrador: {} } });
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(guardarBorradorMock).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'request-1',
      borrador: expect.objectContaining({
        cuentas: [expect.objectContaining({ tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0' })],
      }),
    }));
    const cuenta = guardarBorradorMock.mock.calls[0][0].borrador.cuentas[0] as Record<string, unknown>;
    expect(cuenta).not.toHaveProperty('nombreCuenta');
    expect(cuenta).not.toHaveProperty('nombreBanco');
    expect(cuenta).not.toHaveProperty('numeroCuenta');
    expect(cuenta).not.toHaveProperty('origen');
    expect(toastSuccessMock).toHaveBeenCalledWith('Borrador guardado');
  });

  it('guarda el borrador con la fecha de corte borrada sin enviarla vacía', async () => {
    const user = userEvent.setup();
    guardarBorradorMock.mockResolvedValue({ success: true, data: { idempotencyKey: 'request-1', estado: 'BORRADOR', borrador: {} } });
    await openDialog(user);
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.clear(dateInput);
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    const borrador = guardarBorradorMock.mock.calls[0][0].borrador as Record<string, unknown>;
    expect(borrador).not.toHaveProperty('fechaCorte');
    expect(initializationDraftContract.safeParse({ ...borrador, idempotencyKey: 'request-1' }).success).toBe(true);
    expect(toastSuccessMock).toHaveBeenCalledWith('Borrador guardado');
  });

  it('guarda el borrador con el saldo borrado sin enviarlo vacío', async () => {
    const user = userEvent.setup();
    guardarBorradorMock.mockResolvedValue({ success: true, data: { idempotencyKey: 'request-1', estado: 'BORRADOR', borrador: {} } });
    await openDialog(user);
    const fields = screen.getAllByRole('textbox');
    await user.clear(fields[3]);
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    const borrador = guardarBorradorMock.mock.calls[0][0].borrador as Record<string, unknown>;
    const cuenta = (borrador.cuentas as Array<Record<string, unknown>>)[0];
    expect(cuenta).not.toHaveProperty('saldoInicial');
    expect(initializationDraftContract.safeParse({ ...borrador, idempotencyKey: 'request-1' }).success).toBe(true);
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

  it('persiste y confirma las existencias iniciales con el tenant habilitado', async () => {
    const user = userEvent.setup();
    authUserMock.mockReturnValue({ user: { role: 'manager', planFeatures: { productos: true } } });
    getProductsMock.mockResolvedValue({ success: true, data: [{ id: 'product-1', nombre: 'Aceite' }] });
    getWarehousesMock.mockResolvedValue({ success: true, data: [{ almacenId: 'warehouse-1', nombre: 'Central' }] });
    initializeMock.mockResolvedValue({ success: true, data: { replayed: false } });
    await openDialog(user);
    await screen.findByRole('region', { name: 'Inventario inicial' });
    await user.click(screen.getByRole('button', { name: 'Agregar fila de inventario' }));
    await user.click(screen.getByLabelText('Producto inicial'));
    await user.click(await screen.findByRole('option', { name: 'Aceite' }));
    await user.click(screen.getByLabelText('Almacén inicial'));
    await user.click(await screen.findByRole('option', { name: 'Central' }));
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Existencia 1: falta una cantidad mayor que cero');
    await user.click(screen.getByRole('button', { name: 'Volver al formulario' }));
    await user.type(screen.getByLabelText('Lote inicial'), 'LOTE-1');
    await user.type(screen.getByLabelText('Cantidad inicial'), '2');
    await user.type(screen.getByLabelText('Costo unitario inicial'), '50');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    const draft = guardarBorradorMock.mock.calls[0][0].borrador;
    expect(draft.inventario[0]).toMatchObject({ productoId: 'product-1', almacenId: 'warehouse-1', cantidad: '2' });
    await fillAccount(user, { nombre: 'Caja', banco: 'Banco QA', numero: 'QA-03', saldo: '0' });
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    await user.click(screen.getByRole('button', { name: 'Inicializar cuentas' }));
    expect(initializeMock.mock.calls[0][0].inventario[0]).toMatchObject({
      productoId: 'product-1', almacenId: 'warehouse-1', loteCodigo: 'LOTE-1',
      cantidad: '2', costoUnitario: '50', moneda: 'CUP',
    });
  });

  it('incluye las CxC externas en el borrador y la confirmación con plan habilitado', async () => {
    const user = userEvent.setup();
    authUserMock.mockReturnValue({ user: { role: 'manager', planFeatures: { clientes: true, 'cuentas-cobrar': true, 'multi-moneda': true } } });
    getClientsMock.mockResolvedValue({ success: true, data: [{ clienteId: 'client-1', nombre: 'Cliente QA' }] });
    initializeMock.mockResolvedValue({ success: true, data: { replayed: false } });
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Agregar cuenta por cobrar' }));
    await user.click(screen.getByLabelText('Cliente de cuenta por cobrar'));
    await user.click(await screen.findByRole('option', { name: 'Cliente QA' }));
    await user.type(screen.getByLabelText('Saldo inicial de CxC'), '250');
    await user.click(screen.getByLabelText('Moneda de CxC'));
    await user.click(screen.getByRole('option', { name: 'USD' }));
    await user.type(screen.getByLabelText('Tasa de cambio de CxC'), '24');
    await user.click(screen.getByLabelText('Moneda de CxC'));
    await user.click(screen.getByRole('option', { name: 'CUP' }));
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(guardarBorradorMock.mock.calls[0][0].borrador.cuentasPorCobrar[0]).toMatchObject({ clienteId: 'client-1', saldo: '250', moneda: 'CUP' });
    expect(guardarBorradorMock.mock.calls[0][0].borrador.cuentasPorCobrar[0]).not.toHaveProperty('tasaCambio');
    await fillAccount(user, { nombre: 'Caja', banco: 'Banco QA', numero: 'QA-04', saldo: '0' });
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    expect(screen.getByText(/Total funcional: 250 CUP/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inicializar cuentas' }));
    expect(initializeMock.mock.calls[0][0].cuentasPorCobrar[0]).toMatchObject({ clienteId: 'client-1', saldo: '250', moneda: 'CUP' });
    expect(initializeMock.mock.calls[0][0].cuentasPorCobrar[0]).not.toHaveProperty('tasaCambio');
  });

  it('bloquea guardar si el plan perdió acceso a las CxC del borrador', async () => {
    const user = userEvent.setup();
    obtenerActualMock.mockResolvedValue({ success: true, data: { idempotencyKey: 'restricted', borrador: {
      cuentasPorCobrar: [{ referenciaFila: 'row-1', clienteId: 'client-1', saldo: '250', moneda: 'CUP' }],
    } } });
    await openDialog(user);
    expect(await screen.findByText(/El plan actual ya no permite confirmar las CxC/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
    expect(guardarBorradorMock).not.toHaveBeenCalled();
  });

  it('bloquea guardar intereses restaurados sin acceso a préstamos', async () => {
    const user = userEvent.setup();
    authUserMock.mockReturnValue({ user: { role: 'manager', planFeatures: { clientes: true, 'cuentas-cobrar': true } } });
    obtenerActualMock.mockResolvedValue({ success: true, data: { idempotencyKey: 'loan', borrador: {
      cuentasPorCobrar: [{ referenciaFila: 'loan-1', clienteId: 'client-1', saldo: '300', moneda: 'CUP', tasaInteres: '5', tasaInteresMoratorio: '2' }],
    } } });
    getClientsMock.mockResolvedValue({ success: true, data: [{ clienteId: 'client-1', nombre: 'Cliente QA' }] });
    await openDialog(user);
    expect(await screen.findByText(/El plan actual ya no permite préstamos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
  });

  it('preserva tasas de préstamo parciales en el borrador y bloquea confirmar', async () => {
    const user = userEvent.setup();
    authUserMock.mockReturnValue({ user: { role: 'manager', planFeatures: { clientes: true, 'cuentas-cobrar': true, 'prestamos-cash': true } } });
    getClientsMock.mockResolvedValue({ success: true, data: [{ clienteId: 'client-1', nombre: 'Cliente QA' }] });
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Agregar cuenta por cobrar' }));
    await user.click(screen.getByLabelText('Cliente de cuenta por cobrar'));
    await user.click(await screen.findByRole('option', { name: 'Cliente QA' }));
    await user.type(screen.getByLabelText('Saldo inicial de CxC'), '300');
    await user.type(screen.getByLabelText('Interés ordinario del préstamo'), '5');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(guardarBorradorMock.mock.calls[0][0].borrador.cuentasPorCobrar[0].tasaInteres).toBe('5');
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('verifica las tasas de interés del préstamo');
  });

  it('rechaza saldos y tasas CxC que no cumplen el formato decimal', async () => {
    const user = userEvent.setup();
    authUserMock.mockReturnValue({ user: { role: 'manager', planFeatures: { clientes: true, 'cuentas-cobrar': true, 'multi-moneda': true, 'prestamos-cash': true } } });
    getClientsMock.mockResolvedValue({ success: true, data: [{ clienteId: 'client-1', nombre: 'Cliente QA' }] });
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Agregar cuenta por cobrar' }));
    await user.click(screen.getByLabelText('Cliente de cuenta por cobrar'));
    await user.click(await screen.findByRole('option', { name: 'Cliente QA' }));
    await user.type(screen.getByLabelText('Saldo inicial de CxC'), '1e2');
    await user.click(screen.getByLabelText('Moneda de CxC'));
    await user.click(screen.getByRole('option', { name: 'USD' }));
    await user.type(screen.getByLabelText('Tasa de cambio de CxC'), 'abc');
    await user.type(screen.getByLabelText('Interés ordinario del préstamo'), '1e2');
    await user.type(screen.getByLabelText('Interés moratorio del préstamo'), '-1');
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/falta un saldo mayor que cero[\s\S]*falta una tasa de cambio mayor que cero[\s\S]*verifica las tasas de interés/);
    expect(screen.getByRole('button', { name: 'Inicializar cuentas' })).toBeDisabled();
  });
});
