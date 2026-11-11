import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  create: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/features/compras-productos/devoluciones', () => ({
  crearDevolucionCompraAction: mocks.create,
  completarDevolucionCompraAction: mocks.complete,
  anularDevolucionCompraAction: mocks.cancel,
}));

import { DevolucionesCompraPage } from './devoluciones-compra-page';

const compras = [{
  compraDocumentoId: 'compra-1',
  numeroFactura: 'FC-101',
  fechaCompra: '2026-11-01T00:00:00.000Z',
  moneda: 'CUP',
  proveedor: { nombre: 'Proveedor Norte' },
  items: [{
    compraDocumentoItemId: 'linea-1',
    cantidad: 10,
    precioUnitario: 20,
    producto: { nombre: 'Arroz' },
  }],
}];

const devoluciones = [{
  devolucionId: 'devolucion-1',
  numero: 'DV-0001',
  estado: 'PENDIENTE',
  formaImputacion: 'IMPUTACION_CXP',
  montoTotal: 40,
  montoImputado: 0,
  saldoAFavor: 0,
  moneda: 'CUP',
  createdAt: '2026-11-02T00:00:00.000Z',
  proveedor: { nombre: 'Proveedor Norte' },
  compraDocumento: { numeroFactura: 'FC-101' },
  items: [{ id: 'item-1', cantidad: 2, total: 40, producto: { nombre: 'Arroz' } }],
}];

describe('DevolucionesCompraPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ success: true, data: {} });
    mocks.complete.mockResolvedValue({ success: true, data: {} });
    mocks.cancel.mockResolvedValue({ success: true, data: {} });
  });

  it('muestra la devolución y permite completarla', async () => {
    render(<DevolucionesCompraPage devoluciones={devoluciones} compras={compras} />);

    expect(screen.getByText('DV-0001')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }));

    await waitFor(() => expect(mocks.complete).toHaveBeenCalledWith('devolucion-1'));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('envía las cantidades seleccionadas al crear una devolución', async () => {
    render(<DevolucionesCompraPage devoluciones={[]} compras={compras} />);

    fireEvent.change(screen.getByLabelText('Compra de origen'), { target: { value: 'compra-1' } });
    fireEvent.change(screen.getByLabelText('Cantidad a devolver: Arroz'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear devolución pendiente' }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      compraDocumentoId: 'compra-1',
      formaImputacion: 'IMPUTACION_CXP',
      items: [{ compraDocumentoItemId: 'linea-1', cantidad: 2 }],
    })));
  });
});
