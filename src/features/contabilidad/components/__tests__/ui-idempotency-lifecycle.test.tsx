import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const actionMocks = vi.hoisted(() => ({
  registerLoanPayment: vi.fn(),
  registerDebtPayment: vi.fn(),
  createServiceSale: vi.fn(),
  createLoan: vi.fn(),
  createDebt: vi.fn(),
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock('@/features/contabilidad/actions-prestamos-cash', () => ({
  registrarPagoPrestamoAction: actionMocks.registerLoanPayment,
  createPrestamoCashAction: actionMocks.createLoan,
}));
vi.mock('@/features/contabilidad/actions-deudas-cash', () => ({
  registrarPagoDeudaAction: actionMocks.registerDebtPayment,
  createDeudaCashAction: actionMocks.createDebt,
}));
vi.mock('@/features/venta-servicios/actions', () => ({
  createVentaServicioAction: actionMocks.createServiceSale,
}));
vi.mock('@/features/clientes/hooks/use-clientes', () => ({
  useClientes: () => ({ clientes: [{ clienteId: 'client-1', nombre: 'Cliente' }], isLoading: false }),
}));
vi.mock('@/features/vendors/hooks/use-vendors', () => ({ useVendors: () => ({ vendors: [] }) }));
vi.mock('@/lib/sileo-shim', () => ({
  sileo: { success: actionMocks.successToast, error: actionMocks.errorToast },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/plan-access', () => ({ hasPlanFeature: () => false }));
vi.mock('@/lib/upload/upload-asset', () => ({
  uploadAsset: vi.fn(),
  toCloudinaryAssetUploadResult: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('framer-motion', () => ({
  LazyMotion: ({ children }: { children: React.ReactNode }) => children,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, { get: () => ({ children }: { children: React.ReactNode }) => children }),
  m: new Proxy({}, { get: () => ({ children }: { children: React.ReactNode }) => children }),
}));
vi.mock('@/features/contabilidad/components/anticipos/anticipo-selector', () => ({
  AnticipoSelector: () => null,
}));
vi.mock('@/components/ui/select', async () => {
  const ReactModule = await import('react');
  type SelectNodeProps = { value?: string; children?: React.ReactNode };
  type ItemProps = { value: string; children?: React.ReactNode };
  const SelectItem = ({ children }: ItemProps) => <>{children}</>;
  const findItems = (node: React.ReactNode): React.ReactNode[] =>
    ReactModule.Children.toArray(node).reduce<React.ReactNode[]>((items, child) => {
      if (!ReactModule.isValidElement<SelectNodeProps>(child)) return items;
      if (child.type === SelectItem) {
        const value = child.props.value ?? '';
        items.push(<option key={value} value={value}>{child.props.children}</option>);
        return items;
      }
      items.push(...findItems(child.props.children));
      return items;
    }, []);
  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode;
      value?: string;
      onValueChange: (value: string) => void;
    }) => (
      <select value={value ?? ''} onChange={(event) => onValueChange(event.target.value)}>
        {findItems(children)}
      </select>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
  };
});

import { PagoPrestamoModal } from '@/features/contabilidad/components/prestamos-cash/pago-prestamo-modal';
import { PagoDeudaModal } from '@/features/contabilidad/components/deudas-cash/pago-deuda-modal';
import { PrestamoCashForm } from '@/features/contabilidad/components/prestamos-cash/prestamo-cash-form';
import { DeudaCashForm } from '@/features/contabilidad/components/deudas-cash/deuda-cash-form';
import { ServiciosPrestadosForm } from '@/features/servicios/components/servicios-prestados-form';
import ServiciosCart from '@/features/servicios/components/servicios-cart';

const loan = {
  id: 'loan-1',
  idNumerico: 1,
  moneda: 'CUP',
  montoCapital: 100,
  cliente: { nombre: 'Cliente' },
  cuentaPorCobrar: { montoDeuda: 100, montoPagado: 0 },
} as never;
const debt = {
  id: 'debt-1',
  idNumerico: 1,
  moneda: 'CUP',
  montoCapital: 100,
  proveedor: { nombre: 'Proveedor' },
  cuentaPorPagar: { saldoPendiente: 100 },
} as never;
const account = [{ cuentaId: 'bank-1', nombreBanco: 'Banco', numeroCuenta: '123', moneda: 'CUP' }];
const paymentType = [{ tipoId: 'cash-1', nombre: 'Efectivo' }];
const provider = [{ vendorId: 'provider-1', nombre: 'Proveedor' }];
const servicio = [{ servicioId: 'service-1', nombre: 'Servicio', precio: 20, moneda: 'CUP' }] as never;

function response(success: boolean) {
  return success ? { success: true, data: {} } : { success: false, error: { message: 'Temporal' } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('originalG5 UI idempotency-key lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['loan', () => <PagoPrestamoModal open onOpenChange={vi.fn()} prestamo={loan} cuentasBancarias={account} tiposPago={paymentType} />, actionMocks.registerLoanPayment],
    ['debt', () => <PagoDeudaModal open onOpenChange={vi.fn()} deuda={debt} cuentasBancarias={account} tiposPago={paymentType} />, actionMocks.registerDebtPayment],
  ] as const)('%s payment keeps one nonempty key for an identical failed retry', async (_kind, component, action) => {
    action.mockResolvedValueOnce(response(false)).mockResolvedValueOnce(response(true));
    render(component());

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'cash-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Pago' }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Pago' }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));

    const firstKey = action.mock.calls[0][0].idempotencyKey;
    expect(firstKey).toEqual(expect.any(String));
    expect(firstKey).not.toHaveLength(0);
    expect(action.mock.calls[1][0]).toEqual({ ...action.mock.calls[0][0] });
    expect(action.mock.calls[1][0].idempotencyKey).toBe(firstKey);
  });

  it('rotates a payment key when the modal is closed and opened for a new payment', async () => {
    const onOpenChange = vi.fn();
    actionMocks.registerDebtPayment.mockResolvedValue(response(true));
    const props = { open: true, onOpenChange, deuda: debt, cuentasBancarias: account, tiposPago: paymentType };
    const view = render(<PagoDeudaModal {...props} />);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'cash-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Pago' }));
    await waitFor(() => expect(actionMocks.registerDebtPayment).toHaveBeenCalledTimes(1));

    view.rerender(<PagoDeudaModal {...props} open={false} />);
    view.rerender(<PagoDeudaModal {...props} open />);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'cash-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Pago' }));
    await waitFor(() => expect(actionMocks.registerDebtPayment).toHaveBeenCalledTimes(2));

    expect(actionMocks.registerDebtPayment.mock.calls[1][0].idempotencyKey)
      .not.toBe(actionMocks.registerDebtPayment.mock.calls[0][0].idempotencyKey);
  });

  it('rotates a loan-payment key when the modal is closed and opened for a new payment', async () => {
    const onOpenChange = vi.fn();
    actionMocks.registerLoanPayment.mockResolvedValue(response(true));
    const props = { open: true, onOpenChange, prestamo: loan, cuentasBancarias: account, tiposPago: paymentType };
    const view = render(<PagoPrestamoModal {...props} />);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'cash-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Pago' }));
    await waitFor(() => expect(actionMocks.registerLoanPayment).toHaveBeenCalledTimes(1));

    view.rerender(<PagoPrestamoModal {...props} open={false} />);
    view.rerender(<PagoPrestamoModal {...props} open />);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'cash-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Pago' }));
    await waitFor(() => expect(actionMocks.registerLoanPayment).toHaveBeenCalledTimes(2));

    expect(actionMocks.registerLoanPayment.mock.calls[1][0].idempotencyKey)
      .not.toBe(actionMocks.registerLoanPayment.mock.calls[0][0].idempotencyKey);
  });

  it('reuses the failed service-sale key, then creates a new key after success resets the form', async () => {
    actionMocks.createServiceSale.mockResolvedValueOnce(response(false)).mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response(true));
    render(<ServiciosPrestadosForm initialServicios={servicio} />);

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'service-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Servicio' }));
    await waitFor(() => expect(actionMocks.createServiceSale).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Servicio' }));
    await waitFor(() => expect(actionMocks.createServiceSale).toHaveBeenCalledTimes(2));

    const failedKey = actionMocks.createServiceSale.mock.calls[0][0].idempotencyKey;
    expect(failedKey).toEqual(expect.any(String));
    expect(failedKey).not.toHaveLength(0);
    expect(actionMocks.createServiceSale.mock.calls[1][0]).toEqual(actionMocks.createServiceSale.mock.calls[0][0]);

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'service-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Servicio' }));
    await waitFor(() => expect(actionMocks.createServiceSale).toHaveBeenCalledTimes(3));
    expect(actionMocks.createServiceSale.mock.calls[2][0].idempotencyKey).not.toBe(failedKey);
  });

  it('fails closed with the same key if a service sale is edited after an uncertain failure', async () => {
    actionMocks.createServiceSale.mockResolvedValueOnce(response(false)).mockResolvedValueOnce({
      success: false,
      error: { code: 'IDEMPOTENCY_CONFLICT', message: 'La clave ya fue usada con datos diferentes.' },
    });
    render(<ServiciosPrestadosForm initialServicios={servicio} />);

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'service-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Servicio' }));
    await waitFor(() => expect(actionMocks.createServiceSale).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Servicio' }));
    await waitFor(() => expect(actionMocks.createServiceSale).toHaveBeenCalledTimes(2));

    expect(actionMocks.createServiceSale.mock.calls[1][0].idempotencyKey)
      .toBe(actionMocks.createServiceSale.mock.calls[0][0].idempotencyKey);
    expect(actionMocks.createServiceSale.mock.calls[1][0].cantidad).toBe(2);
    expect(actionMocks.createServiceSale.mock.calls[1][0].cantidad)
      .not.toBe(actionMocks.createServiceSale.mock.calls[0][0].cantidad);
    expect(actionMocks.errorToast).toHaveBeenCalledWith({
      title: 'No se pudo registrar el servicio prestado.',
    });
  });

  it('retries a cart sale with its original key and rotates after success for a new sale', async () => {
    actionMocks.createServiceSale.mockResolvedValueOnce(response(false))
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response(true));
    const cart = [{
      cartItemId: 'cart-item-1',
      servicioId: 'service-1',
      nombre: 'Servicio',
      precio: 20,
      costo: 5,
      descripcion: 'Servicio de prueba',
      cantidad: 1,
      moneda: 'CUP',
    }];
    const setCart = vi.fn();
    const onOpenChange = vi.fn();
    const view = render(
      <ServiciosCart cart={cart} setCart={setCart} isOpen onOpenChange={onOpenChange} />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'client-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Venta' }));
    await waitFor(() => expect(actionMocks.createServiceSale).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Venta' }));
    await waitFor(() => expect(actionMocks.createServiceSale).toHaveBeenCalledTimes(2));

    const firstKey = actionMocks.createServiceSale.mock.calls[0][0].idempotencyKey;
    expect(firstKey).toEqual(expect.any(String));
    expect(actionMocks.createServiceSale.mock.calls[1][0])
      .toEqual(actionMocks.createServiceSale.mock.calls[0][0]);

    view.rerender(
      <ServiciosCart cart={cart} setCart={setCart} isOpen onOpenChange={onOpenChange} />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'client-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Venta' }));
    await waitFor(() => expect(actionMocks.createServiceSale).toHaveBeenCalledTimes(3));
    expect(actionMocks.createServiceSale.mock.calls[2][0].idempotencyKey).not.toBe(firstKey);
  });

  it.each([
    [
      'loan',
      actionMocks.createLoan,
      <PrestamoCashForm
        open
        onOpenChange={vi.fn()}
        clientes={[{ clienteId: 'client-1', nombre: 'Cliente' }]}
        cuentasBancarias={account.map((item) => ({ ...item, tipoCuenta: 'Corriente' }))}
      />,
      'Crear Préstamo',
      'Monto del Préstamo',
    ],
    [
      'debt',
      actionMocks.createDebt,
      <DeudaCashForm
        open
        onOpenChange={vi.fn()}
        proveedores={provider}
        cuentasBancarias={account.map((item) => ({ ...item, tipoCuenta: 'Corriente' }))}
      />,
      'Registrar Deuda',
      'Monto de la Deuda',
    ],
  ] as const)('%s create form reuses its key across failed and uncertain retries, then rotates on success', async (_kind, action, component, submitLabel, amountLabel) => {
    action.mockResolvedValueOnce(response(false))
      .mockRejectedValueOnce(new Error('Network response lost'))
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response(true));
    const view = render(component);

    const submit = async () => {
      fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
      fireEvent.change(screen.getAllByRole('combobox')[1], {
        target: { value: _kind === 'loan' ? 'client-1' : 'provider-1' },
      });
      fireEvent.change(screen.getByLabelText(amountLabel), { target: { value: '150' } });
      fireEvent.click(screen.getByRole('button', { name: submitLabel }));
    };

    await submit();
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: submitLabel })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: submitLabel }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: submitLabel })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: submitLabel }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByRole('button', { name: submitLabel })).not.toBeDisabled());

    const firstPayload = action.mock.calls[0][0];
    const firstKey = firstPayload.idempotencyKey;
    expect(firstKey).toEqual(expect.any(String));
    expect(firstKey).not.toHaveLength(0);
    expect(action.mock.calls[1][0]).toEqual(firstPayload);
    expect(action.mock.calls[2][0]).toEqual(firstPayload);

    await submit();
    await waitFor(() => expect(action).toHaveBeenCalledTimes(4));
    expect(action.mock.calls[3][0].idempotencyKey).not.toBe(firstKey);

    view.unmount();
  });

  it.each([
    [
      'loan',
      actionMocks.createLoan,
      <PrestamoCashForm
        open
        onOpenChange={vi.fn()}
        clientes={[{ clienteId: 'client-1', nombre: 'Cliente' }]}
        cuentasBancarias={account.map((item) => ({ ...item, tipoCuenta: 'Corriente' }))}
      />,
      'Crear Préstamo',
      'Monto del Préstamo',
    ],
    [
      'debt',
      actionMocks.createDebt,
      <DeudaCashForm
        open
        onOpenChange={vi.fn()}
        proveedores={provider}
        cuentasBancarias={account.map((item) => ({ ...item, tipoCuenta: 'Corriente' }))}
      />,
      'Registrar Deuda',
      'Monto de la Deuda',
    ],
  ] as const)('%s create form discards a pending key when the user closes and starts a new intent', async (_kind, action, component, submitLabel, amountLabel) => {
    action.mockResolvedValueOnce(response(false)).mockResolvedValueOnce(response(true));
    const view = render(component);
    const submit = () => {
      fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
      fireEvent.change(screen.getAllByRole('combobox')[1], {
        target: { value: _kind === 'loan' ? 'client-1' : 'provider-1' },
      });
      fireEvent.change(screen.getByLabelText(amountLabel), { target: { value: '150' } });
      fireEvent.click(screen.getByRole('button', { name: submitLabel }));
    };

    submit();
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const firstKey = action.mock.calls[0][0].idempotencyKey;
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    view.rerender(React.cloneElement(component, { open: false }));
    view.rerender(component);
    submit();
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));

    expect(firstKey).toEqual(expect.any(String));
    expect(action.mock.calls[1][0].idempotencyKey).not.toBe(firstKey);
  });

  it.each([
    [
      'loan',
      actionMocks.createLoan,
      <PrestamoCashForm
        open
        onOpenChange={vi.fn()}
        clientes={[{ clienteId: 'client-1', nombre: 'Cliente' }]}
        cuentasBancarias={account.map((item) => ({ ...item, tipoCuenta: 'Corriente' }))}
      />,
      'Crear Préstamo',
      'Monto del Préstamo',
    ],
    [
      'debt',
      actionMocks.createDebt,
      <DeudaCashForm
        open
        onOpenChange={vi.fn()}
        proveedores={provider}
        cuentasBancarias={account.map((item) => ({ ...item, tipoCuenta: 'Corriente' }))}
      />,
      'Registrar Deuda',
      'Monto de la Deuda',
    ],
  ] as const)('%s create form prevents cancel/dismiss while a request is pending', async (_kind, action, component, submitLabel, amountLabel) => {
    const pending = deferred<ReturnType<typeof response>>();
    const onOpenChange = vi.fn();
    action.mockReturnValueOnce(pending.promise);
    render(React.cloneElement(component, { onOpenChange }));

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], {
      target: { value: _kind === 'loan' ? 'client-1' : 'provider-1' },
    });
    fireEvent.change(screen.getByLabelText(amountLabel), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: submitLabel }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const firstKey = action.mock.calls[0][0].idempotencyKey;
    expect(firstKey).toEqual(expect.any(String));
    expect(firstKey).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: submitLabel })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0][0].idempotencyKey).toBe(firstKey);

    pending.resolve(response(true));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0][0].idempotencyKey).toBe(firstKey);
  });
});
