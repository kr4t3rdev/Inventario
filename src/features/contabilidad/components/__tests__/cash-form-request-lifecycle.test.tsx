import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const actionMocks = vi.hoisted(() => ({
  createLoan: vi.fn(),
  createDebt: vi.fn(),
  payLoan: vi.fn(),
  payDebt: vi.fn(),
}));

vi.mock('@/features/contabilidad/actions-prestamos-cash', () => ({
  createPrestamoCashAction: actionMocks.createLoan,
  registrarPagoPrestamoAction: actionMocks.payLoan,
}));
vi.mock('@/features/contabilidad/actions-deudas-cash', () => ({
  createDeudaCashAction: actionMocks.createDebt,
  registrarPagoDeudaAction: actionMocks.payDebt,
}));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/plan-access', () => ({ hasPlanFeature: () => false }));
vi.mock('@/lib/upload/upload-asset', () => ({
  uploadAsset: vi.fn(),
  toCloudinaryAssetUploadResult: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/ui/select', async () => {
  const ReactModule = await import('react');
  type SelectNodeProps = { value?: string; children?: React.ReactNode };
  type ItemProps = { value: string; children?: React.ReactNode };
  const SelectItem = ({ value, children }: ItemProps) => <option value={value}>{children}</option>;
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
    SelectValue: ({ placeholder }: { placeholder?: string }) => (
      <option value="">{placeholder}</option>
    ),
  };
});

import { DeudaCashForm } from '@/features/contabilidad/components/deudas-cash/deuda-cash-form';
import {
  PrestamoCashForm,
} from '@/features/contabilidad/components/prestamos-cash/prestamo-cash-form';
import { PagoDeudaModal } from '@/features/contabilidad/components/deudas-cash/pago-deuda-modal';
import { PagoPrestamoModal } from '@/features/contabilidad/components/prestamos-cash/pago-prestamo-modal';

const accounts = [{
  cuentaId: 'bank-1',
  nombreBanco: 'Banco',
  numeroCuenta: '123',
  moneda: 'CUP',
  tipoCuenta: 'Corriente',
}];
const clients = [{ clienteId: 'client-1', nombre: 'Cliente' }];
const providers = [{ vendorId: 'provider-1', nombre: 'Proveedor' }];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('cash create form request lifecycle', () => {
  it.each([
    [
      'loan',
      actionMocks.createLoan,
      (onOpenChange: (open: boolean) => void) => (
        <PrestamoCashForm
          open
          onOpenChange={onOpenChange}
          clientes={clients}
          cuentasBancarias={accounts}
        />
      ),
      'Crear Préstamo',
      'Monto del Préstamo',
      'client-1',
    ],
    [
      'debt',
      actionMocks.createDebt,
      (onOpenChange: (open: boolean) => void) => (
        <DeudaCashForm
          open
          onOpenChange={onOpenChange}
          proveedores={providers}
          cuentasBancarias={accounts}
        />
      ),
      'Registrar Deuda',
      'Monto de la Deuda',
      'provider-1',
    ],
  ] as const)('%s prevents duplicate submits and dismissal while the request is pending', async (
    _kind,
    action,
    component,
    submitLabel,
    amountLabel,
    entityId,
  ) => {
    const pending = deferred<{ success: boolean; data: Record<string, never> }>();
    const onOpenChange = vi.fn();
    action.mockReturnValueOnce(pending.promise);
    render(component(onOpenChange));

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: entityId } });
    fireEvent.change(screen.getByLabelText(amountLabel), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Tasa anual ordinaria (%)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Tasa anual moratoria (%)'), { target: { value: '0' } });
    const submit = screen.getByRole('button', { name: submitLabel });
    const form = submit.closest('form');
    expect(form).not.toBeNull();
    act(() => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
    });
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    expect(submit).toBeDisabled();
    expect(cancel).toBeDisabled();

    fireEvent.click(submit);
    fireEvent.click(cancel);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(action).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    pending.resolve({ success: true, data: {} });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('reuses the same create key after a network failure when payload is unchanged', async () => {
    actionMocks.createLoan.mockReset();
    actionMocks.createLoan
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ success: true, data: {} });
    const onOpenChange = vi.fn();
    render(
      <PrestamoCashForm
        open
        onOpenChange={onOpenChange}
        clientes={clients}
        cuentasBancarias={accounts}
      />,
    );

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Monto del Préstamo'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Tasa anual ordinaria (%)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Tasa anual moratoria (%)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Préstamo' }));
    await waitFor(() => expect(actionMocks.createLoan).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(
      screen.getByRole('button', { name: 'Crear Préstamo' }),
    ).not.toBeDisabled());

    const firstKey = actionMocks.createLoan.mock.calls[0][0].idempotencyKey;
    expect(firstKey).toEqual(expect.any(String));
    fireEvent.click(screen.getByRole('button', { name: 'Crear Préstamo' }));
    await waitFor(() => expect(actionMocks.createLoan).toHaveBeenCalledTimes(2));
    expect(actionMocks.createLoan.mock.calls[1][0].idempotencyKey).toBe(firstKey);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('reuses the same debt create key after an ambiguous failure with unchanged payload', async () => {
    actionMocks.createDebt.mockReset();
    actionMocks.createDebt
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ success: true, data: {} });
    const onOpenChange = vi.fn();
    render(
      <DeudaCashForm
        open
        onOpenChange={onOpenChange}
        proveedores={providers}
        cuentasBancarias={accounts}
      />,
    );

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'provider-1' } });
    fireEvent.change(screen.getByLabelText('Monto de la Deuda'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Tasa anual ordinaria (%)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Tasa anual moratoria (%)'), { target: { value: '0' } });
    const submit = screen.getByRole('button', { name: 'Registrar Deuda' });
    fireEvent.click(submit);
    await waitFor(() => expect(actionMocks.createDebt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submit).not.toBeDisabled());

    const firstKey = actionMocks.createDebt.mock.calls[0][0].idempotencyKey;
    expect(firstKey).toEqual(expect.any(String));
    fireEvent.click(submit);
    await waitFor(() => expect(actionMocks.createDebt).toHaveBeenCalledTimes(2));
    expect(actionMocks.createDebt.mock.calls[1][0].idempotencyKey).toBe(firstKey);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it.each(['debt', 'loan'] as const)(
    'reuses the payment key after a network failure for an unchanged %s request',
    async (kind) => {
      const action = kind === 'debt' ? actionMocks.payDebt : actionMocks.payLoan;
      action.mockReset();
      action
        .mockRejectedValueOnce(new Error('network unavailable'))
        .mockResolvedValueOnce({ success: true, data: {} });
      const onOpenChange = vi.fn();
      const payment = kind === 'debt'
        ? <PagoDeudaModal
            deuda={{
              id: 'debt-1', idNumerico: 1, moneda: 'CUP', montoCapital: 1,
              proveedor: { nombre: 'Proveedor' }, cuentaPorPagar: { saldoPendiente: 1 },
            } as never}
            open onOpenChange={onOpenChange} cuentasBancarias={accounts} tiposPago={[{ tipoId: 'cash', nombre: 'Efectivo' }]}
          />
        : <PagoPrestamoModal
            prestamo={{
              id: 'loan-1', idNumerico: 1, moneda: 'CUP', montoCapital: 1,
              cliente: { nombre: 'Cliente' }, cuentaPorCobrar: { montoDeuda: 1, montoPagado: 0 },
            } as never}
            open onOpenChange={onOpenChange} cuentasBancarias={accounts} tiposPago={[{ tipoId: 'cash', nombre: 'Efectivo' }]}
          />;
      render(payment);
      fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bank-1' } });
      fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'cash' } });
      fireEvent.change(screen.getByLabelText('Monto a pagar'), { target: { value: '0.0123' } });
      const submit = screen.getByRole('button', { name: 'Registrar Pago' });
      fireEvent.click(submit);
      await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(submit).not.toBeDisabled());
      const firstKey = action.mock.calls[0][0].idempotencyKey;
      expect(firstKey).toEqual(expect.any(String));

      fireEvent.click(submit);
      await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
      expect(action.mock.calls[1][0].idempotencyKey).toBe(firstKey);
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    },
  );
});
