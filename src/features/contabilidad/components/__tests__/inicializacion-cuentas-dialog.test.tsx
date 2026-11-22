import { render, screen } from '@testing-library/react';
import { initializationDraftContract } from '@/features/contabilidad/services/initialization-contract';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const initializeMock = vi.hoisted(() => vi.fn());
const authUserMock = vi.hoisted(() => ({ current: { role: 'user', planFeatures: { contabilidad: true, 'multi-moneda': true } } }));
const productsMock = vi.hoisted(() => vi.fn());
const warehousesMock = vi.hoisted(() => vi.fn());
const clientsMock = vi.hoisted(() => vi.fn());
const vendorsMock = vi.hoisted(() => vi.fn());
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
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: authUserMock.current }) }));
vi.mock('@/features/productos/actions-crud', () => ({ getProductosAction: productsMock }));
vi.mock('@/features/almacenes/actions', () => ({ getAlmacenesAction: warehousesMock }));
vi.mock('@/features/clientes/actions', () => ({ getClientesAction: clientsMock }));
vi.mock('@/features/vendors/actions', () => ({ getVendorsAction: vendorsMock }));

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
    initializeMock.mockResolvedValue({ success: false, error: { message: 'Carga bloqueada' } });
    guardarBorradorMock.mockResolvedValue({ success: true, data: { idempotencyKey: 'request-1', estado: 'BORRADOR' } });
    obtenerActualMock.mockResolvedValue({ success: true, data: null });
    authUserMock.current = { role: 'user', planFeatures: { contabilidad: true, 'multi-moneda': true } };
    productsMock.mockResolvedValue({ success: true, data: [] });
    warehousesMock.mockResolvedValue({ success: true, data: [] });
    clientsMock.mockResolvedValue({ success: true, data: [] });
    vendorsMock.mockResolvedValue({ success: true, data: [] });
  });

  it('muestra apartados iniciales solo cuando el plan habilita sus módulos', async () => {
    authUserMock.current = {
      role: 'user',
      planFeatures: {
        contabilidad: true, 'multi-moneda': true, productos: true, 'cuentas-cobrar': true,
        clientes: true, 'inyeccion-capital': true,
      },
    };
    productsMock.mockResolvedValue({ success: true, data: [{ id: 'prod-1', nombre: 'Producto QA' }] });
    warehousesMock.mockResolvedValue({ success: true, data: [{ almacenId: 'wh-1', nombre: 'Almacén QA' }] });
    clientsMock.mockResolvedValue({ success: true, data: [{ clienteId: 'client-1', nombre: 'Cliente QA' }] });
    const user = userEvent.setup();
    await openDialog(user);

    expect(await screen.findByRole('button', { name: 'Agregar fila de inventario' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar cuenta por cobrar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar cuenta por pagar' })).not.toBeInTheDocument();
    await fillAccount(user, { nombre: 'Caja inicial', banco: 'Banco QA', numero: 'QA-01', saldo: '1000' });
    await user.click(screen.getAllByRole('combobox')[2]);
    expect(screen.getByRole('option', { name: 'Préstamo' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'No documentada' }));
    await user.click(screen.getByRole('button', { name: 'Agregar cuenta por cobrar' }));
    expect(screen.queryByRole('textbox', { name: 'Interés ordinario del préstamo' })).not.toBeInTheDocument();
  });

  it('preserva y guarda inventario, CxC y CxP en el mismo borrador', async () => {
    authUserMock.current = {
      role: 'user',
      planFeatures: {
        contabilidad: true, 'multi-moneda': true, productos: true,
        'cuentas-cobrar': true, clientes: true, 'cuentas-pagar': true,
      },
    };
    productsMock.mockResolvedValue({ success: true, data: [{ id: 'prod-1', nombre: 'Producto QA' }] });
    warehousesMock.mockResolvedValue({ success: true, data: [{ almacenId: 'wh-1', nombre: 'Almacén QA' }] });
    clientsMock.mockResolvedValue({ success: true, data: [{ clienteId: 'client-1', nombre: 'Cliente QA' }] });
    vendorsMock.mockResolvedValue({ success: true, data: [{ vendorId: 'vendor-1', nombre: 'Proveedor QA' }] });
    const user = userEvent.setup();
    await openDialog(user);
    await fillAccount(user, { nombre: 'Caja inicial', banco: 'Banco QA', numero: 'QA-01', saldo: '1000' });

    await user.click(screen.getByRole('button', { name: 'Agregar fila de inventario' }));
    await user.click(screen.getByRole('combobox', { name: 'Producto inicial' }));
    await user.click(screen.getByRole('option', { name: 'Producto QA' }));
    await user.click(screen.getByRole('combobox', { name: 'Almacén inicial' }));
    await user.click(screen.getByRole('option', { name: 'Almacén QA' }));
    await user.type(screen.getByRole('textbox', { name: 'Lote inicial' }), 'LOTE-1');
    await user.type(screen.getByRole('textbox', { name: 'Cantidad inicial' }), '4');
    await user.type(screen.getByRole('textbox', { name: 'Costo unitario inicial' }), '12.50');

    await user.click(screen.getByRole('button', { name: 'Agregar cuenta por cobrar' }));
    await user.click(screen.getByRole('combobox', { name: 'Cliente de cuenta por cobrar' }));
    await user.click(screen.getByRole('option', { name: 'Cliente QA' }));
    await user.type(screen.getByRole('textbox', { name: 'Saldo inicial de CxC' }), '250');

    await user.click(screen.getByRole('button', { name: 'Agregar cuenta por pagar' }));
    await user.click(screen.getByRole('combobox', { name: 'Proveedor de cuenta por pagar' }));
    await user.click(screen.getByRole('option', { name: 'Proveedor QA' }));
    await user.type(screen.getByRole('textbox', { name: 'Saldo inicial de CxP' }), '100');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    const payload = guardarBorradorMock.mock.calls[0][0].borrador;
    expect(payload.inventario[0]).toMatchObject({
      productoId: 'prod-1', almacenId: 'wh-1', loteCodigo: 'LOTE-1', cantidad: '4', costoUnitario: '12.50',
    });
    expect(payload.cuentasPorCobrar[0]).toMatchObject({ clienteId: 'client-1', saldo: '250' });
    expect(payload.cuentasPorPagar[0]).toMatchObject({ proveedorId: 'vendor-1', saldo: '100' });

    const selects = screen.getAllByRole('combobox');
    await user.click(selects[2]);
    await user.click(screen.getByRole('option', { name: 'No documentada' }));
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    await user.click(screen.getByRole('button', { name: 'Inicializar empresa' }));
    expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining({
      inventario: [expect.objectContaining({
        productoId: 'prod-1', almacenId: 'wh-1', loteCodigo: 'LOTE-1', cantidad: '4', costoUnitario: '12.50',
      })],
      cuentasPorCobrar: [expect.objectContaining({ clienteId: 'client-1', saldo: '250' })],
      cuentasPorPagar: [expect.objectContaining({ proveedorId: 'vendor-1', saldo: '100' })],
    }));
  });

  it('retomar y guardar no descarta las secciones iniciales', async () => {
    authUserMock.current = {
      role: 'user',
      planFeatures: {
        contabilidad: true, 'multi-moneda': true, productos: true,
        'cuentas-cobrar': true, clientes: true, 'cuentas-pagar': true,
      },
    };
    productsMock.mockResolvedValue({ success: true, data: [{ id: 'prod-1', nombre: 'Producto QA' }] });
    warehousesMock.mockResolvedValue({ success: true, data: [{ almacenId: 'wh-1', nombre: 'Almacén QA' }] });
    clientsMock.mockResolvedValue({ success: true, data: [{ clienteId: 'client-1', nombre: 'Cliente QA' }] });
    vendorsMock.mockResolvedValue({ success: true, data: [{ vendorId: 'vendor-1', nombre: 'Proveedor QA' }] });
    const existing = {
      ...draftResumed,
      borrador: {
        ...draftResumed.borrador,
        tasas: { USD: '375' },
        inventario: [{
          referenciaFila: 'stock-1', productoId: 'prod-1', almacenId: 'wh-1', ubicacionId: 'bin-1',
          loteCodigo: 'L1', cantidad: '2', costoUnitario: '3', moneda: 'CUP',
          fechaCorte: '2026-11-01', fechaVencimiento: '2027-03-01',
        }],
        cuentasPorCobrar: [{ referenciaFila: 'cxc-1', clienteId: 'client-1', moneda: 'CUP', saldo: '50' }],
        cuentasPorPagar: [{ referenciaFila: 'cxp-1', proveedorId: 'vendor-1', moneda: 'CUP', saldo: '40' }],
      },
    };
    obtenerActualMock.mockResolvedValue({ success: true, data: existing });
    const user = userEvent.setup();
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    const payload = guardarBorradorMock.mock.calls[0][0].borrador;
    expect(payload.inventario).toEqual(existing.borrador.inventario);
    expect(payload.tasas).toEqual({ USD: '375' });
    expect(payload.cuentasPorCobrar[0]).toMatchObject(existing.borrador.cuentasPorCobrar[0]);
    expect(payload.cuentasPorPagar[0]).toMatchObject(existing.borrador.cuentasPorPagar[0]);
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    await user.click(screen.getByRole('button', { name: 'Inicializar empresa' }));
    expect(initializeMock.mock.calls[0][0].inventario[0]).toMatchObject({
      ubicacionId: 'bin-1', fechaCorte: '2026-11-01', fechaVencimiento: '2027-03-01',
    });
  });

  it('retomar filas incompletas permite corregirlas sin interrumpir la revisión', async () => {
    obtenerActualMock.mockResolvedValue({
      success: true,
      data: {
        ...draftResumed,
        borrador: {
          ...draftResumed.borrador,
          inventario: [{ referenciaFila: 'stock-incompleto', productoId: 'prod-1' }],
          cuentasPorCobrar: [{ referenciaFila: 'cxc-incompleta', clienteId: 'client-1' }],
          cuentasPorPagar: [{ referenciaFila: 'cxp-incompleta', proveedorId: 'vendor-1' }],
        },
      },
    });
    const user = userEvent.setup();
    await openDialog(user);
    expect(obtenerActualMock).toHaveBeenCalled();
    expect(await screen.findByDisplayValue('Caja retomada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));

    expect(screen.getByText('Inventario 1: falta el lote')).toBeInTheDocument();
    expect(screen.getByText('CxC 1: falta el saldo')).toBeInTheDocument();
    expect(screen.getByText('CxP 1: falta el saldo')).toBeInTheDocument();
  });

  it('permite registrar un préstamo simple cuando no está habilitado el submayor de deuda', async () => {
    authUserMock.current = {
      role: 'user', planFeatures: { contabilidad: true, 'inyeccion-capital': true },
    };
    const user = userEvent.setup();
    await openDialog(user);
    await fillAccount(user, { nombre: 'Banco inicial', banco: 'Banco QA', numero: 'QA-02', saldo: '2500' });
    await user.click(screen.getAllByRole('combobox')[2]);
    await user.click(screen.getByRole('option', { name: 'Préstamo' }));
    await user.type(screen.getAllByRole('textbox')[4], 'Entidad financiera');
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    await user.click(screen.getByRole('button', { name: 'Inicializar empresa' }));

    expect(initializeMock.mock.calls[0][0].cuentas[0].origen).toMatchObject({
      tipo: 'PRESTAMO', tercero: 'Entidad financiera',
    });
    expect(initializeMock.mock.calls[0][0].cuentas[0].origen).not.toHaveProperty('proveedorId');
  });

  it('bloquea la confirmación cuando las cuentas bancarias declaran tasas distintas para la misma moneda', async () => {
    const user = userEvent.setup();
    await openDialog(user);
    await fillAccount(user, { nombre: 'Banco A', banco: 'Banco QA', numero: 'USD-1', saldo: '100' });
    await user.click(screen.getAllByRole('combobox')[1]);
    await user.click(screen.getByRole('option', { name: 'USD' }));
    await user.click(screen.getAllByRole('combobox')[2]);
    await user.click(screen.getByRole('option', { name: 'No documentada' }));
    await user.type(screen.getAllByRole('textbox')[4], '300');

    await user.click(screen.getByRole('button', { name: 'Agregar cuenta' }));
    const fields = screen.getAllByRole('textbox');
    await user.type(fields[5], 'Banco B');
    await user.type(fields[6], 'Banco QA');
    await user.type(fields[7], 'USD-2');
    await user.clear(fields[8]);
    await user.type(fields[8], '100');
    await user.click(screen.getAllByRole('combobox')[4]);
    await user.click(screen.getByRole('option', { name: 'USD' }));
    await user.click(screen.getAllByRole('combobox')[5]);
    await user.click(screen.getByRole('option', { name: 'No documentada' }));
    await user.type(screen.getAllByRole('textbox')[9], '400');
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));

    expect(screen.getByText('Unifica la tasa bancaria para USD antes de confirmar')).toBeInTheDocument();
    expect(screen.getByText('Total funcional: sin valorar (falta una tasa)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inicializar empresa' })).toBeDisabled();
  });

  it('impide guardar un borrador si perdería tasas por cuenta no documentada en conflicto', async () => {
    const user = userEvent.setup();
    await openDialog(user);
    await fillAccount(user, { nombre: 'Banco A', banco: 'Banco QA', numero: 'USD-1', saldo: '100' });
    await user.click(screen.getAllByRole('combobox')[1]);
    await user.click(screen.getByRole('option', { name: 'USD' }));
    await user.click(screen.getAllByRole('combobox')[2]);
    await user.click(screen.getByRole('option', { name: 'No documentada' }));
    await user.type(screen.getAllByRole('textbox')[4], '300');

    await user.click(screen.getByRole('button', { name: 'Agregar cuenta' }));
    const fields = screen.getAllByRole('textbox');
    await user.type(fields[5], 'Banco B');
    await user.type(fields[6], 'Banco QA');
    await user.type(fields[7], 'USD-2');
    await user.clear(fields[8]);
    await user.type(fields[8], '100');
    await user.click(screen.getAllByRole('combobox')[4]);
    await user.click(screen.getByRole('option', { name: 'USD' }));
    await user.click(screen.getAllByRole('combobox')[5]);
    await user.click(screen.getByRole('option', { name: 'No documentada' }));
    await user.type(screen.getAllByRole('textbox')[9], '400');

    expect(screen.getByText(/No se puede guardar el borrador: las tasas USD/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
    expect(guardarBorradorMock).not.toHaveBeenCalled();
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
    await user.click(screen.getByRole('button', { name: 'Inicializar empresa' }));

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
    await user.click(screen.getByRole('button', { name: 'Inicializar empresa' }));
    expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'draft-key-1' }));
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
    expect(screen.getByRole('button', { name: 'Inicializar empresa' })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: 'Inicializar empresa' })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: 'Inicializar empresa' })).toBeEnabled();
  });
});
