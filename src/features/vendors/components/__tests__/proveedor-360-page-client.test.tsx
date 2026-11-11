import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { getProveedor360Action } = vi.hoisted(() => ({
  getProveedor360Action: vi.fn(),
}));

vi.mock('@/features/vendors/pricelist', () => ({ getProveedor360Action }));
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock('lucide-react', () => ({ ArrowLeft: () => null, Building2: () => null, RefreshCw: () => null }));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, asChild: _asChild, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <section>{children}</section>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <header>{children}</header>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/components/ui/badge', () => ({ Badge: ({ children }: any) => <span>{children}</span> }));

import { Proveedor360PageClient } from '../proveedor-360-page-client';

const fixture = {
  vendor: { vendorId: 'vendor-1', nombre: 'Distribuidora Centro', contacto: 'Ana', telefono: '555-0100', direccion: 'Calle 1' },
  pricelist: [{ proveedorProductoId: 'pp-1', costoUnitario: 12500, moneda: 'CUP', esPreferente: true, producto: { nombre: 'Arroz' } }],
  comprasRecientes: [{ compraDocumentoId: 'c-1', numeroFactura: 'F-10', estado: 'PAGADA', total: 25000, moneda: 'CUP', createdAt: '2026-10-01T00:00:00Z' }],
  cuentasPorPagar: [{ cuentaPorPagarId: 'cxp-1', saldoPendiente: 7000, moneda: 'CUP', estado: 'PENDIENTE' }],
  anticipos: [{ anticipoId: 'a-1', monto: 3000, moneda: 'CUP', estado: 'PENDIENTE' }],
  deudasCash: [{ deudaCashId: 'd-1', montoPendiente: 1500, moneda: 'CUP' }],
  contratos: [{ contratoId: 'ct-1', numeroContrato: 'CT-09', estado: 'VIGENTE' }],
  metricas: { totalComprado12Meses: 42000, ultimaCompra: '2026-10-01T00:00:00Z' },
};

describe('Proveedor360PageClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra datos comerciales, pricelist y todas las secciones financieras', async () => {
    getProveedor360Action.mockResolvedValue({ success: true, data: fixture });
    render(<Proveedor360PageClient vendorId="vendor-1" />);

    expect(await screen.findByRole('heading', { name: 'Distribuidora Centro' })).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('555-0100')).toBeInTheDocument();
    expect(screen.getByText('Arroz')).toBeInTheDocument();
    expect(screen.getByText('F-10')).toBeInTheDocument();
    expect(screen.getByText('Cuentas por pagar')).toBeInTheDocument();
    expect(screen.getByText('Anticipos')).toBeInTheDocument();
    expect(screen.getByText('Deudas en efectivo')).toBeInTheDocument();
    expect(screen.getByText('Contratos')).toBeInTheDocument();
    expect(screen.getByText('CT-09')).toBeInTheDocument();
  });

  it('permite reintentar cuando falla la carga', async () => {
    const user = userEvent.setup();
    getProveedor360Action.mockResolvedValueOnce({ success: false, error: { message: 'Sin acceso' } })
      .mockResolvedValueOnce({ success: true, data: fixture });
    render(<Proveedor360PageClient vendorId="vendor-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin acceso');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('Arroz')).toBeInTheDocument());
    expect(getProveedor360Action).toHaveBeenCalledTimes(2);
  });
});
